// Notion → Blue Consult sync (Fase 1.2)
// Lê as 3 bases do Notion, faz upsert nas tabelas raw, dispara match e
// consolidação. Pode rodar via cron ou ser disparada manualmente pela UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

const DS_INFO = "1d52e840-ab4f-80ee-ac8a-d56aed5b5b6e";
const DS_CRM = "1a52e840-ab4f-81f1-b2e5-ffa0784e5f75";
const DS_2026 = "2a22e840-ab4f-8086-b4bf-c7d1859a30b1";

interface NotionPage {
  id: string;
  last_edited_time: string;
  properties: Record<string, any>;
}

// ---------------- helpers de extração de propriedades Notion ----------------
function pTitle(p: any): string | null {
  const arr = p?.title ?? [];
  return arr.map((x: any) => x.plain_text).join("").trim() || null;
}
function pRich(p: any): string | null {
  const arr = p?.rich_text ?? [];
  return arr.map((x: any) => x.plain_text).join("").trim() || null;
}
function pSelect(p: any): string | null {
  return p?.select?.name ?? null;
}
function pMultiSelect(p: any): string[] {
  return (p?.multi_select ?? []).map((x: any) => x.name);
}
function pCheckbox(p: any): boolean {
  return !!p?.checkbox;
}
function pNumber(p: any): number | null {
  return p?.number ?? null;
}
function pEmail(p: any): string | null {
  return p?.email ?? null;
}
function pPhone(p: any): string | null {
  return p?.phone_number ?? null;
}
function pDateStart(p: any): string | null {
  return p?.date?.start ?? null;
}
function pDateEnd(p: any): string | null {
  return p?.date?.end ?? null;
}
function pPeopleNames(p: any): string | null {
  const arr = p?.people ?? [];
  return arr.map((x: any) => x.name).filter(Boolean).join(", ") || null;
}

async function notionQueryAll(
  dataSourceId: string,
  token: string,
): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let cursor: string | null = null;
  let safety = 0;
  do {
    safety++;
    if (safety > 200) throw new Error("Notion pagination safety break");
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(
      `${NOTION_API}/databases/${dataSourceId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Notion query failed (${res.status}): ${txt}`);
    }
    const data = await res.json();
    out.push(...(data.results as NotionPage[]));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return out;
}

// -------------------- transformadores por base ------------------------------
function mapInfo(page: NotionPage) {
  const p = page.properties;
  return {
    notion_page_id: page.id,
    notion_last_edited: page.last_edited_time,
    nome_cliente: pTitle(p["Nome do Cliente"]),
    cpf_cnpj: pRich(p["CPF/CNPJ"]),
    email_principal: pEmail(p["E-mail Principal"]),
    email_secundario: pEmail(p["E-mail Secundário"]),
    telefone_1: pPhone(p["Telefone 1"]) ?? pRich(p["Telefone 1"]),
    telefone_2: pPhone(p["Telefone 2"]) ?? pRich(p["Telefone 2"]),
    uf: pRich(p["UF"]) ?? pSelect(p["UF"]),
    cidade: pRich(p["Cidade"]),
    cep: pRich(p["CEP"]),
    endereco: pRich(p["Endereço"]),
    data_nascimento: pDateStart(p["Data de Nascimento"]),
    perfil_cliente: pMultiSelect(p["Perfil do cliente"]),
    produtos: pMultiSelect(p["Produtos"]),
    cliente_inativo: pCheckbox(p["Cliente inativo?"]),
    data_cancelamento: pDateStart(p["Data de Cancelamento"]),
    motivo_cancelamento: pSelect(p["Motivo de cancelamento"]),
    vencimento_procuracao: pDateStart(p["Vencimento Procuração"]),
    apuracao_b3: pSelect(p["Apuração B3?"]),
    preenchimento_ir_geral: pSelect(p["Preenchimento IR Geral"]),
    historico_acessorias: pRich(p["Histórico Acessórias"]),
    historico_pier: pRich(p["Histórico Pier"]),
    raw_payload: p,
  };
}

function mapCrm(page: NotionPage) {
  const p = page.properties;
  return {
    notion_page_id: page.id,
    notion_last_edited: page.last_edited_time,
    cliente: pTitle(p["Cliente"]),
    nivel: pNumber(p["Nivel "]) ?? pNumber(p["Nivel"]),
    prioridade: pSelect(p["Prioridade"]),
    responsavel: pSelect(p["Responsável"]),
    status_2021: pSelect(p["Status 2021"]),
    status_2022: pSelect(p["Status 2022"]),
    status_2023: pSelect(p["Status 2023"]),
    status_2024: pSelect(p["Status 2024"]),
    status_2025: pSelect(p["Status 2025"]),
    preenchimento_ir_geral_2026: pSelect(p["Preenchimento IR Geral 2026"]),
    apuracao_b3: pSelect(p["Apuração de B3"]),
    cronograma_inicio: pDateStart(p["Cronograma"]),
    cronograma_fim: pDateEnd(p["Cronograma"]),
    fim: pCheckbox(p["FIM"]),
    irpf_cripto_preenchido: pCheckbox(p["IRPF Cripto Preenchido"]),
    validou_dez_2025: pCheckbox(p["Validou Dez/2025"]),
    formalizou_sol_docs: pCheckbox(p["Formalizou sol. de docs? "]),
    raw_payload: p,
  };
}

function map2026(page: NotionPage) {
  const p = page.properties;
  return {
    notion_page_id: page.id,
    notion_last_edited: page.last_edited_time,
    cliente: pTitle(p["Cliente"]),
    status_2026: pSelect(p["Status 2026"]),
    apuracao_b3: pSelect(p["Apuração B3"]),
    ir_geral_2026: pSelect(p["IR Geral 2026"]) ??
      pSelect(p["Preenchimento IR Geral 2026"]),
    responsavel: pSelect(p["Responsável"]),
    cronograma_inicio: pDateStart(p["Cronograma"]),
    cronograma_fim: pDateEnd(p["Cronograma"]),
    card_2025_anteriores: pRich(p["Card 2025 Anteriores"]),
    card_informacoes_cliente: pRich(p["Card informações cliente"]),
    raw_payload: p,
  };
}

// -------------------- main ---------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!NOTION_API_KEY) {
    return new Response(
      JSON.stringify({ error: "NOTION_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = new Date();
  const summary: Record<string, any> = { started_at: startedAt.toISOString() };

  async function syncOne(
    fonte: string,
    dsId: string,
    table: string,
    mapFn: (p: NotionPage) => any,
  ) {
    const runStart = new Date();
    await db.from("blue_sync_status").upsert({
      fonte,
      ultimo_run_inicio: runStart.toISOString(),
      ultimo_run_status: "em_execucao",
    }, { onConflict: "fonte" });

    try {
      const pages = await notionQueryAll(dsId, NOTION_API_KEY!);
      const rows = pages.map(mapFn);
      // upsert em chunks de 200
      let upserted = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await db
          .from(table)
          .upsert(chunk, { onConflict: "notion_page_id" });
        if (error) throw new Error(`upsert ${table}: ${error.message}`);
        upserted += chunk.length;
      }
      await db.from("blue_sync_status").upsert({
        fonte,
        ultimo_run_inicio: runStart.toISOString(),
        ultimo_run_fim: new Date().toISOString(),
        ultimo_run_status: "ok",
        registros_lidos: pages.length,
        registros_upserted: upserted,
        ultimo_erro: null,
      }, { onConflict: "fonte" });
      return { fonte, lidos: pages.length, upserted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("blue_sync_status").upsert({
        fonte,
        ultimo_run_inicio: runStart.toISOString(),
        ultimo_run_fim: new Date().toISOString(),
        ultimo_run_status: "erro",
        ultimo_erro: msg,
      }, { onConflict: "fonte" });
      throw e;
    }
  }

  try {
    summary.info = await syncOne("info", DS_INFO, "blue_cliente_raw_info", mapInfo);
    summary.crm = await syncOne("crm", DS_CRM, "blue_cliente_raw_crm", mapCrm);
    summary["2026"] = await syncOne("2026", DS_2026, "blue_cliente_raw_2026", map2026);

    // Disparar consolidação (fire-and-forget para retornar rápido)
    const buildUrl = `${SUPABASE_URL}/functions/v1/blue-cliente-360-build`;
    fetch(buildUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "post-sync" }),
    }).catch((e) => console.error("build trigger fail:", e));

    summary.finished_at = new Date().toISOString();
    summary.duration_ms = Date.now() - startedAt.getTime();
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
