// Consolida as 3 tabelas raw em blue_cliente_360 (Fase 1.3)
// - Match exato por client_key + fuzzy via levenshtein/similaridade
// - Calcula score, oportunidades, filas, fase_macro, gatilho
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ID_EMPRESA_BLUE = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";

// Estatística para fuzzy: normalized similarity = 1 - levenshtein / max(len)
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

interface ScoreCfg {
  peso_nivel: number;
  peso_prioridade: number;
  bonus_procuracao_30d: number;
  bonus_procuracao_60d: number;
  bonus_aprovacao: number;
  bonus_fidelidade_por_ano: number;
  bonus_fidelidade_max: number;
  penalty_inatividade_por_mes: number;
}

const PRIORIDADE_W: Record<string, number> = {
  "Urgente": 4, "Alta": 3, "Média": 2, "Media": 2, "Baixa": 1,
};

const STATUS_FINALIZADAS = new Set([
  "Finalizada", "Finalizado", "Entregue", "Entregue 2024", "Entregue 2023",
]);
const STATUS_EXCLUIDOS_PEND = new Set([
  "Cancelada", "Cancelado", "Sem Ano Fiscal", "Sem ano fiscal",
]);

function isFinalizada(s: string | null) {
  if (!s) return false;
  return STATUS_FINALIZADAS.has(s) || s.toLowerCase().includes("finaliz") ||
    s.toLowerCase().includes("entreg");
}
function contaComoPendente(s: string | null) {
  if (!s) return false;
  if (isFinalizada(s)) return false;
  if (STATUS_EXCLUIDOS_PEND.has(s)) return false;
  return true;
}

function computeFaseMacro(
  ativo: boolean,
  status2026: string | null,
  finalizados: number,
): string {
  if (!ativo) return "inativo";
  if (status2026?.toLowerCase().includes("aprovação") ||
      status2026?.toLowerCase().includes("aprovacao")) return "aprovacao";
  if (status2026?.toLowerCase().includes("finaliz")) return "concluido";
  if (status2026 && status2026 !== "" && !status2026.toLowerCase().includes("entrar"))
    return "execucao";
  if (status2026?.toLowerCase().includes("entrar")) return "onboarding";
  if (finalizados > 0) return "parado";
  return "onboarding";
}

function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
function monthsSince(d: Date) {
  return Math.max(0, Math.round(diffDays(new Date(), d) / 30));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = new Date();

  try {
    await db.from("blue_sync_status").upsert({
      fonte: "consolidacao",
      ultimo_run_inicio: startedAt.toISOString(),
      ultimo_run_status: "em_execucao",
    }, { onConflict: "fonte" });

    // Carrega config de score
    const { data: cfgRow } = await db
      .from("blue_score_config")
      .select("*")
      .eq("id_empresa", ID_EMPRESA_BLUE)
      .maybeSingle();
    const cfg: ScoreCfg = cfgRow ?? {
      peso_nivel: 100, peso_prioridade: 30,
      bonus_procuracao_30d: 50, bonus_procuracao_60d: 25,
      bonus_aprovacao: 40, bonus_fidelidade_por_ano: 5,
      bonus_fidelidade_max: 25, penalty_inatividade_por_mes: 10,
    };

    // Carrega as 3 raws
    const [{ data: infos = [] }, { data: crms = [] }, { data: c2026 = [] }] = await Promise.all([
      db.from("blue_cliente_raw_info").select("*"),
      db.from("blue_cliente_raw_crm").select("*"),
      db.from("blue_cliente_raw_2026").select("*"),
    ]);

    // Index por client_key
    const infoByKey = new Map<string, any>();
    for (const r of infos!) if (r.client_key) infoByKey.set(r.client_key, r);
    const crmByKey = new Map<string, any>();
    for (const r of crms!) if (r.client_key) crmByKey.set(r.client_key, r);
    const c2026ByKey = new Map<string, any>();
    for (const r of c2026!) if (r.client_key) c2026ByKey.set(r.client_key, r);

    // Universo de keys = união das 3
    const allKeys = new Set<string>([
      ...infoByKey.keys(), ...crmByKey.keys(), ...c2026ByKey.keys(),
    ]);

    // Fuzzy match: para keys de CRM/2026 que NÃO bateram em info, tentar achar
    // o info mais próximo. Usa similaridade nas próprias keys (que já são
    // canônicas — diff vem só de typos/abreviação).
    const infoKeysList = Array.from(infoByKey.keys());
    const matchMap = new Map<string, string>(); // key origem -> key info confirmada
    const revisaoBatch: any[] = [];

    function resolveKey(srcKey: string, srcNome: string, fonte: "crm" | "2026", srcId: string) {
      if (infoByKey.has(srcKey)) return srcKey;
      if (matchMap.has(srcKey)) return matchMap.get(srcKey);
      // procura best
      let best: { k: string; s: number } | null = null;
      for (const ik of infoKeysList) {
        const s = similarity(srcKey, ik);
        if (!best || s > best.s) best = { k: ik, s };
      }
      if (best && best.s >= 0.85) {
        matchMap.set(srcKey, best.k);
        return best.k;
      }
      if (best && best.s >= 0.70) {
        const candidato = infoByKey.get(best.k);
        revisaoBatch.push({
          base_origem: fonte,
          raw_id: srcId,
          raw_nome: srcNome,
          raw_client_key: srcKey,
          candidato_360_id: null, // populado depois (após criar 360)
          candidato_nome: candidato?.nome_cliente,
          candidato_client_key: best.k,
          similaridade: best.s,
          status: "pendente",
        });
      }
      return null; // ficará órfão (não entra no 360 sem confirmação)
    }

    // Processa keys de CRM e 2026 que não têm info
    for (const r of crms!) {
      if (r.client_key && !infoByKey.has(r.client_key)) {
        resolveKey(r.client_key, r.cliente, "crm", r.id);
      }
    }
    for (const r of c2026!) {
      if (r.client_key && !infoByKey.has(r.client_key)) {
        resolveKey(r.client_key, r.cliente, "2026", r.id);
      }
    }

    // Constrói rows do 360 (apenas para keys que tem info — fonte de verdade do cadastro)
    const rows360: any[] = [];
    const now = new Date();

    for (const [key, info] of infoByKey) {
      // Encontra crm/2026 alinhados (direto ou via matchMap reverso)
      const crm = crmByKey.get(key) ?? findByMatch(crms!, key, matchMap);
      const c26 = c2026ByKey.get(key) ?? findByMatch(c2026!, key, matchMap);

      const historico: Record<string, string | null> = {
        "2021": crm?.status_2021 ?? null,
        "2022": crm?.status_2022 ?? null,
        "2023": crm?.status_2023 ?? null,
        "2024": crm?.status_2024 ?? null,
        "2025": crm?.status_2025 ?? null,
      };
      const finalizados = Object.values(historico).filter(isFinalizada).length;
      const pendentes = Object.values(historico).filter(contaComoPendente).length;

      const ativo = !info.cliente_inativo;
      const status2026 = c26?.status_2026 ?? null;
      const tem2026 = !!status2026 && !status2026.toLowerCase().includes("cancel");
      const irGeral2026 = c26?.ir_geral_2026 ?? crm?.preenchimento_ir_geral_2026 ?? null;
      const b32026 = c26?.apuracao_b3 ?? null;

      // Fila & oportunidades
      const filas: string[] = [];
      const oportunidades: any[] = [];

      const procD = info.vencimento_procuracao
        ? diffDays(new Date(info.vencimento_procuracao), now)
        : null;

      // Renovação
      if (ativo && (
        status2026?.toLowerCase().includes("aprovação") ||
        status2026?.toLowerCase().includes("aprovacao") ||
        status2026?.toLowerCase().includes("finaliz") ||
        (procD !== null && procD <= 60)
      )) {
        filas.push("renovacao");
        oportunidades.push({
          tipo: "renovacao",
          motivo: status2026?.toLowerCase().includes("aprov")
            ? "Em Aprovação 2026"
            : procD !== null && procD <= 60
              ? `Procuração vence em ${procD}d`
              : "Ciclo concluído — momento de renovar",
        });
      }

      // Upsell
      if (ativo) {
        if (irGeral2026 && irGeral2026.toLowerCase().includes("outro")) {
          filas.push("upsell");
          oportunidades.push({ tipo: "upsell_ir_geral", motivo: "IR Geral em outro contador" });
        }
        if (!b32026 || b32026.toLowerCase() === "não" || b32026.toLowerCase() === "nao") {
          if (!filas.includes("upsell")) filas.push("upsell");
          oportunidades.push({ tipo: "upsell_b3", motivo: "Sem Apuração B3 contratada" });
        }
      }

      // Resgate
      if (ativo && pendentes > 0) {
        filas.push("resgate");
        oportunidades.push({ tipo: "resgate", motivo: `${pendentes} ano(s) fiscal(is) pendente(s)` });
      }

      // Win-back
      if (!ativo && info.data_cancelamento) {
        const cancel = new Date(info.data_cancelamento);
        const months = monthsSince(cancel);
        if (months <= 12 && info.motivo_cancelamento !== "Erro de venda") {
          filas.push("winback");
          oportunidades.push({
            tipo: "winback",
            motivo: `Cancelou há ${months}m — motivo: ${info.motivo_cancelamento ?? "n/d"}`,
          });
        }
      }

      const fase = computeFaseMacro(ativo, status2026, finalizados);

      // Score
      const nivel = crm?.nivel ?? 0;
      let score = nivel * cfg.peso_nivel;
      const prioW = PRIORIDADE_W[crm?.prioridade ?? ""] ?? 0;
      score += prioW * cfg.peso_prioridade;
      if (procD !== null && procD <= 30 && procD >= -7) score += cfg.bonus_procuracao_30d;
      else if (procD !== null && procD <= 60 && procD >= 0) score += cfg.bonus_procuracao_60d;
      if (status2026?.toLowerCase().includes("aprov")) score += cfg.bonus_aprovacao;
      score += Math.min(finalizados * cfg.bonus_fidelidade_por_ano, cfg.bonus_fidelidade_max);
      if (!ativo && info.data_cancelamento) {
        score -= monthsSince(new Date(info.data_cancelamento)) * cfg.penalty_inatividade_por_mes;
      }

      const gatilho = oportunidades[0]?.motivo ?? (ativo ? "Cliente ativo" : "Cliente inativo");

      rows360.push({
        client_key: key,
        nome_canonico: info.nome_cliente,
        cpf_cnpj: info.cpf_cnpj,
        contato_email: info.email_principal,
        contato_whatsapp: info.telefone_1,
        uf: info.uf,
        cidade: info.cidade,
        perfil_psicografico: info.perfil_cliente ?? [],
        produtos_contratados: info.produtos ?? [],
        cliente_ativo: ativo,
        data_cancelamento: info.data_cancelamento,
        motivo_cancelamento: info.motivo_cancelamento,
        vencimento_procuracao: info.vencimento_procuracao,
        nivel,
        prioridade: crm?.prioridade ?? null,
        responsavel_cs: c26?.responsavel ?? crm?.responsavel ?? null,
        historico_anos: historico,
        anos_finalizados: finalizados,
        anos_pendentes: pendentes,
        status_2026: status2026,
        tem_2026_ativo: tem2026,
        ir_geral_2026: irGeral2026,
        apuracao_b3_2026: b32026,
        fase_macro: fase,
        gatilho_principal: gatilho,
        oportunidades,
        filas,
        score_priorizacao: Math.round(score),
        raw_info_id: info.id,
        raw_crm_id: crm?.id ?? null,
        raw_2026_id: c26?.id ?? null,
        ultima_atualizacao: now.toISOString(),
      });
    }

    // Upsert em chunks
    let upserted = 0;
    for (let i = 0; i < rows360.length; i += 200) {
      const chunk = rows360.slice(i, i + 200);
      const { error } = await db
        .from("blue_cliente_360")
        .upsert(chunk, { onConflict: "client_key" });
      if (error) throw new Error(`upsert 360: ${error.message}`);
      upserted += chunk.length;
    }

    // Grava itens em revisão (apenas novos — pendentes não confirmados)
    if (revisaoBatch.length > 0) {
      // Limpa pendentes anteriores antes (evita duplicação por re-runs)
      await db.from("blue_match_revisao").delete().eq("status", "pendente");
      for (let i = 0; i < revisaoBatch.length; i += 200) {
        const chunk = revisaoBatch.slice(i, i + 200);
        const { error } = await db.from("blue_match_revisao").insert(chunk);
        if (error) console.error("revisao insert error:", error.message);
      }
    }

    await db.from("blue_sync_status").upsert({
      fonte: "consolidacao",
      ultimo_run_inicio: startedAt.toISOString(),
      ultimo_run_fim: new Date().toISOString(),
      ultimo_run_status: "ok",
      registros_lidos: rows360.length,
      registros_upserted: upserted,
      registros_em_revisao: revisaoBatch.length,
      ultimo_erro: null,
    }, { onConflict: "fonte" });

    return new Response(
      JSON.stringify({
        ok: true,
        consolidados: upserted,
        em_revisao: revisaoBatch.length,
        duration_ms: Date.now() - startedAt.getTime(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("blue_sync_status").upsert({
      fonte: "consolidacao",
      ultimo_run_fim: new Date().toISOString(),
      ultimo_run_status: "erro",
      ultimo_erro: msg,
    }, { onConflict: "fonte" });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function findByMatch(rows: any[], targetKey: string, matchMap: Map<string, string>) {
  // Procura entre as rows alguma cuja key, via matchMap, aponte pra targetKey
  for (const r of rows) {
    if (r.client_key && matchMap.get(r.client_key) === targetKey) return r;
  }
  return null;
}
