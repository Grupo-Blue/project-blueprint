import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FaseResultado {
  fase: string;
  status: "sucesso" | "erro" | "pulado";
  duracao_ms: number;
  detalhes?: any;
}

async function chamarFuncao(
  baseUrl: string,
  anonKey: string,
  nomeFuncao: string,
  body: Record<string, any> = {},
  timeoutMs = 55000
): Promise<{ ok: boolean; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/functions/v1/${nomeFuncao}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, data: { error: err.message } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "orquestrador-coleta";

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.json().catch(() => ({}));
  const fasesFiltro: string[] = body.fases || []; // Ex: ["meta_metricas", "google_metricas", "criativos_meta", "criativos_google", "apify_previews"]
  const MAX_TOTAL_MS = 280000; // 4min40s de margem (edge function limit ~5min)

  const resultados: FaseResultado[] = [];

  function tempoRestante() {
    return MAX_TOTAL_MS - (Date.now() - startTime);
  }

  function devePular(nomeFase: string): boolean {
    if (fasesFiltro.length > 0 && !fasesFiltro.includes(nomeFase)) return true;
    if (tempoRestante() < 15000) return true; // Menos de 15s restantes
    return false;
  }

  async function executarFase(nomeFase: string, fn: () => Promise<any>) {
    if (devePular(nomeFase)) {
      resultados.push({ fase: nomeFase, status: "pulado", duracao_ms: 0 });
      return;
    }
    const ini = Date.now();
    try {
      const detalhes = await fn();
      resultados.push({ fase: nomeFase, status: "sucesso", duracao_ms: Date.now() - ini, detalhes });
    } catch (err: any) {
      resultados.push({ fase: nomeFase, status: "erro", duracao_ms: Date.now() - ini, detalhes: err.message });
    }
  }

  try {
    console.log("🚀 Orquestrador de coleta iniciado");

    // === FASE 1: Métricas Meta Ads ===
    await executarFase("meta_metricas", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "coletar-metricas-meta", {});
      console.log(`📊 Meta métricas: ${res.ok ? "OK" : "ERRO"}`, res.data?.message || "");
      return res.data;
    });

    // === FASE 2: Métricas Google Ads ===
    await executarFase("google_metricas", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "coletar-metricas-google", {});
      console.log(`📊 Google métricas: ${res.ok ? "OK" : "ERRO"}`, res.data?.message || "");
      return res.data;
    });

    // === FASE 3: Criativos Meta (em loop até processar todas) ===
    await executarFase("criativos_meta", async () => {
      const BATCH_SIZE = 5;
      let offset = 0;
      let totalProcessadas = 0;
      let pendentes = 999;

      while (pendentes > 0 && tempoRestante() > 30000) {
        const res = await chamarFuncao(supabaseUrl, anonKey, "coletar-criativos-meta", {
          max_campanhas: BATCH_SIZE,
          offset: offset,
        }, 55000);

        if (!res.ok) {
          console.error(`❌ Criativos Meta batch offset=${offset}: erro`, res.data);
          throw new Error(res.data?.error || "Erro na coleta de criativos Meta");
        }

        const processadas = res.data?.resultados?.length || 0;
        pendentes = res.data?.campanhas_pendentes || 0;
        totalProcessadas += processadas;
        offset += BATCH_SIZE;

        console.log(`📎 Criativos Meta batch: +${processadas} (total: ${totalProcessadas}, pendentes: ${pendentes})`);

        // Se não processou nenhuma neste batch, acabou
        if (processadas === 0) break;
      }

      console.log(`📎 Criativos Meta finalizado: ${totalProcessadas} campanhas processadas`);
      return { total_processadas: totalProcessadas };
    });

    // === FASE 3.5: Salvar thumbnails no Storage (URLs temporárias → permanentes) ===
    await executarFase("salvar_thumbnails", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "salvar-thumbnails-criativos", { limit: 50 }, 120000);
      console.log(`📸 Thumbnails: ${res.ok ? "OK" : "ERRO"}`, res.data?.salvos || 0, "salvos");
      return res.data;
    });

    // === FASE 4: Criativos Google ===
    await executarFase("criativos_google", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "coletar-criativos-google", {});
      console.log(`📎 Google criativos: ${res.ok ? "OK" : "ERRO"}`, res.data?.message || "");
      return res.data;
    });

    // === FASE 5: Apify - Recuperar previews de criativos sem mídia ===
    await executarFase("apify_previews", async () => {
      const apifyToken = Deno.env.get("APIFY_API_TOKEN");
      if (!apifyToken) {
        console.log("⚠️ APIFY_API_TOKEN não configurado, pulando...");
        return { pulado: true, motivo: "token não configurado" };
      }

      // Verificar quantos criativos precisam de preview
      const { count } = await supabase
        .from("criativo")
        .select("id_criativo", { count: "exact", head: true })
        .is("url_midia", null)
        .eq("ativo", true);

      if (!count || count === 0) {
        console.log("✅ Todos os criativos ativos já têm mídia");
        return { sem_pendentes: true };
      }

      console.log(`🔍 ${count} criativos sem mídia - chamando Apify...`);
      const res = await chamarFuncao(supabaseUrl, anonKey, "recuperar-previews-apify", {
        limit: 30, // Processar 30 por vez
      }, 120000); // Timeout maior para Apify (2min)

      console.log(`🎭 Apify previews: ${res.ok ? "OK" : "ERRO"}`, res.data?.updated || 0, "atualizados");
      return res.data;
    });

    // === FASE 6: Calcular métricas diárias ===
    await executarFase("metricas_diarias", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "calcular-metricas-diarias", {});
      console.log(`📈 Métricas diárias: ${res.ok ? "OK" : "ERRO"}`);
      return res.data;
    });

    // === FASE 7: Enriquecer criativos com dados Metricool (proporcional) ===
    await executarFase("criativos_metricool", async () => {
      const res = await chamarFuncao(supabaseUrl, anonKey, "coletar-criativos-metricool", { dias: 7 });
      console.log(`🎯 Criativos Metricool: ${res.ok ? "OK" : "ERRO"}`, res.data?.total_atualizados || 0, "atualizados");
      return res.data;
    });

    const duracao = Date.now() - startTime;
    const fasesOk = resultados.filter(r => r.status === "sucesso").length;
    const fasesErro = resultados.filter(r => r.status === "erro").length;

    console.log(`\n✅ Orquestrador finalizado em ${(duracao / 1000).toFixed(1)}s: ${fasesOk} OK, ${fasesErro} erros`);

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: fasesErro > 0 ? "parcial" : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { resultados, fases_ok: fasesOk, fases_erro: fasesErro },
    });

    return new Response(
      JSON.stringify({ success: true, duracao_ms: duracao, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro geral orquestrador:", error);

    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error.message,
      detalhes_execucao: { resultados },
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message, resultados }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
