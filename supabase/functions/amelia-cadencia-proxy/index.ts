// Edge function: amelia-cadencia-proxy
// Proxy autenticado SGT → Amélia MCP server (cadências)
// Actions: list_cadences | create_cadence | enroll_leads
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AMELIA_MCP_API_KEY = Deno.env.get("AMELIA_MCP_API_KEY")!;
const AMELIA_BASE = "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1";
const AMELIA_MCP_URL = `${AMELIA_BASE}/mcp-server`;
const AMELIA_SGT_WEBHOOK_URL = `${AMELIA_BASE}/sgt-webhook`;
// Reaproveita o segredo já existente (mesmo SGT_WEBHOOK_SECRET é compartilhado entre os projetos)
const SGT_WEBHOOK_SECRET = Deno.env.get("SGT_WEBHOOK_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento empresa SGT (UUID) → empresa Amélia (código)
const EMPRESA_MAP: Record<string, "TOKENIZA" | "BLUE"> = {
  "61b5ffeb-fbbc-47c1-8ced-152bb647ed20": "TOKENIZA",
  "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db": "BLUE",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Normaliza telefone para E.164 brasileiro
function normalizarTelefone(tel: string | null): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Já tem DDI 55
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  // Adiciona DDI Brasil
  return `+55${digits}`;
}

// Chamada JSON-RPC ao MCP (Streamable HTTP transport)
async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const resp = await fetch(AMELIA_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${AMELIA_MCP_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = resp.headers.get("content-type") || "";
  let raw: string;

  if (contentType.includes("text/event-stream")) {
    raw = await resp.text();
    // Pega o último evento "data: ..."
    const lines = raw.split("\n").filter(l => l.startsWith("data:"));
    if (lines.length === 0) throw new Error(`MCP SSE vazio. status=${resp.status}`);
    raw = lines[lines.length - 1].replace(/^data:\s*/, "");
  } else {
    raw = await resp.text();
  }

  if (!resp.ok) {
    throw new Error(`MCP HTTP ${resp.status}: ${raw.substring(0, 500)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`MCP retorno não-JSON: ${raw.substring(0, 500)}`);
  }

  if (parsed.error) {
    throw new Error(`MCP error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
  }

  // Resultado vem em result.content[0].text (string JSON ou texto)
  const textContent = parsed.result?.content?.[0]?.text;
  if (textContent === undefined) return parsed.result;

  // Tenta parsear texto como JSON
  try {
    return JSON.parse(textContent);
  } catch {
    return { raw: textContent };
  }
}

// Envia 1 lead para o sgt-webhook da Amélia (cria/atualiza lead_contacts)
async function syncLeadToAmelia(lead: any, empresaCode: "TOKENIZA" | "BLUE") {
  const payload = {
    lead_id: lead.id_lead,
    evento: "LEAD_NOVO",
    empresa: empresaCode,
    timestamp: new Date().toISOString(),
    dados_lead: {
      nome: lead.nome_lead || `Lead ${String(lead.id_lead).slice(0, 8)}`,
      email: lead.email || `${lead.id_lead}@no-email.local`,
      telefone: lead.telefone || undefined,
    },
  };

  const resp = await fetch(AMELIA_SGT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SGT_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  if (!resp.ok) {
    return { ok: false, status: resp.status, error: text.substring(0, 300) };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const { action, id_empresa, id_segmento, cadence_id, nome, codigo, canal_principal, descricao } = body;

  if (!action) return jsonResponse({ error: "action é obrigatório" }, 400);

  // Resolve empresa code
  let empresaCode: "TOKENIZA" | "BLUE" | null = null;
  if (id_empresa) {
    empresaCode = EMPRESA_MAP[id_empresa] || null;
    if (!empresaCode) {
      return jsonResponse({
        error: `Empresa ${id_empresa} não suportada na Amélia. Suportadas: Tokeniza, Blue Consult.`,
      }, 400);
    }
  }

  try {
    // ─────────────────────────────────────────
    // ACTION: list_cadences
    // ─────────────────────────────────────────
    if (action === "list_cadences") {
      if (!empresaCode) return jsonResponse({ error: "id_empresa é obrigatório" }, 400);
      const result = await callMcpTool("list_cadences", {
        empresa: empresaCode,
        ativo: true,
        limit: 50,
      });
      return jsonResponse({ success: true, cadences: Array.isArray(result) ? result : [] });
    }

    // ─────────────────────────────────────────
    // ACTION: create_cadence
    // ─────────────────────────────────────────
    if (action === "create_cadence") {
      if (!empresaCode) return jsonResponse({ error: "id_empresa é obrigatório" }, 400);
      if (!nome || !codigo) return jsonResponse({ error: "nome e codigo obrigatórios" }, 400);

      const result = await callMcpTool("create_cadence", {
        nome,
        codigo: String(codigo).toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        empresa: empresaCode,
        canal_principal: canal_principal || "WHATSAPP",
        descricao: descricao || `Criada via SGT em ${new Date().toLocaleDateString("pt-BR")}`,
        ativo: true,
      });
      return jsonResponse({ success: true, cadence: result });
    }

    // ─────────────────────────────────────────
    // ACTION: enroll_leads
    // ─────────────────────────────────────────
    if (action === "enroll_leads") {
      if (!empresaCode) return jsonResponse({ error: "id_empresa é obrigatório" }, 400);
      if (!id_segmento) return jsonResponse({ error: "id_segmento é obrigatório" }, 400);
      if (!cadence_id) return jsonResponse({ error: "cadence_id é obrigatório" }, 400);

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Busca leads do segmento
      const { data: membros, error: memErr } = await adminClient
        .from("lead_segmento_membro")
        .select("id_lead, lead:id_lead(nome_lead, email, telefone)")
        .eq("id_segmento", id_segmento)
        .is("removido_em", null);

      if (memErr) throw memErr;

      const todosLeads = (membros || []).map((m: any) => ({
        id_lead: m.id_lead,
        nome_lead: m.lead?.nome_lead?.trim() || null,
        email: m.lead?.email || null,
        telefone: normalizarTelefone(m.lead?.telefone),
      }));

      // Filtro obrigatório: nome E telefone
      const elegiveis = todosLeads.filter((l) => l.nome_lead && l.telefone);
      const inelegiveis = todosLeads.length - elegiveis.length;

      if (elegiveis.length === 0) {
        return jsonResponse({
          error: `Nenhum lead elegível (precisa ter nome e telefone válido). Total no segmento: ${todosLeads.length}`,
        }, 400);
      }

      // 1) Sincroniza cada lead via sgt-webhook (cria lead_contacts na Amélia)
      let sincronizados = 0;
      let falhas_sync = 0;
      const erros_sync: string[] = [];

      // Limita concorrência para evitar rate limit
      const BATCH = 10;
      for (let i = 0; i < elegiveis.length; i += BATCH) {
        const slice = elegiveis.slice(i, i + BATCH);
        const results = await Promise.all(slice.map((l) => syncLeadToAmelia(l, empresaCode!)));
        results.forEach((r, idx) => {
          if (r.ok) sincronizados++;
          else {
            falhas_sync++;
            if (erros_sync.length < 5) {
              erros_sync.push(`${slice[idx].id_lead}: ${r.error || r.status}`);
            }
          }
        });
      }

      // Pequeno delay para o trigger trg_sync_lead_contact processar
      await new Promise((r) => setTimeout(r, 800));

      // 2) Inscreve no MCP enroll_lead_cadence
      const lead_ids = elegiveis.map((l) => l.id_lead);
      const enrollResult = await callMcpTool("enroll_lead_cadence", {
        cadence_id,
        lead_ids,
        empresa: empresaCode,
      });

      return jsonResponse({
        success: true,
        total_segmento: todosLeads.length,
        elegiveis: elegiveis.length,
        inelegiveis_sem_nome_telefone: inelegiveis,
        sincronizados_amelia: sincronizados,
        falhas_sincronizacao: falhas_sync,
        erros_sync_amostra: erros_sync,
        enrollment: enrollResult,
      });
    }

    return jsonResponse({ error: `action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error("[amelia-cadencia-proxy] erro:", e);
    return jsonResponse({ error: e.message || String(e) }, 500);
  }
});
