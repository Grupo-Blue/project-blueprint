import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Cruza dados que já existem (landingpage_metricas + gsc_metricas_dia + lead) por URL do artigo
// e materializa em artigo_metricas_dia. Roda diariamente para últimos N dias.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const nomeCronjob = "coletar-metricas-artigo";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const idEmpresaFiltro = body.id_empresa;
    const diasJanela = Number(body.dias) || 7;
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - diasJanela * 24 * 60 * 60 * 1000);
    const dataInicio = inicio.toISOString().split("T")[0];

    let q = supabase.from("artigo").select("id_artigo, id_empresa, url, slug").eq("status", "publish");
    if (idEmpresaFiltro) q = q.eq("id_empresa", idEmpresaFiltro);
    const { data: artigos, error: artErr } = await q;
    if (artErr) throw artErr;
    if (!artigos?.length) {
      return new Response(JSON.stringify({ message: "Nenhum artigo cadastrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalAtualizadas = 0;
    let comErro = 0;

    for (const artigo of artigos) {
      // GA4 — landingpage_metricas casada por URL (campo `url` ou `landing_page`)
      const { data: lpRows } = await supabase
        .from("landingpage_metricas")
        .select("data, sessoes, usuarios, tempo_medio_segundos, bounce_rate")
        .eq("id_empresa", artigo.id_empresa)
        .ilike("url", `%${stripDomain(artigo.url)}%`)
        .gte("data", dataInicio);

      // GSC — agregado por URL (query=null)
      const { data: gscRows } = await supabase
        .from("gsc_metricas_dia")
        .select("data, impressoes, cliques, ctr, posicao_media")
        .eq("id_empresa", artigo.id_empresa)
        .is("query", null)
        .ilike("url", `%${stripDomain(artigo.url)}%`)
        .gte("data", dataInicio);

      // Leads por dia — utm_campaign = slug OU id_artigo
      const { data: leadsRows } = await supabase
        .from("lead")
        .select("data_criacao")
        .eq("id_empresa", artigo.id_empresa)
        .or(`id_artigo.eq.${artigo.id_artigo},utm_campaign.eq.${artigo.slug ?? ""}`)
        .gte("data_criacao", `${dataInicio}T00:00:00`);

      // Indexar por data
      const porData = new Map<string, any>();
      const upsertPorData = (data: string, patch: any) => {
        if (!data) return;
        porData.set(data, { ...(porData.get(data) ?? {}), ...patch });
      };

      for (const r of lpRows ?? []) {
        upsertPorData(r.data, {
          sessoes: r.sessoes ?? 0,
          usuarios: r.usuarios ?? 0,
          tempo_medio_seg: r.tempo_medio_segundos ?? null,
          bounce_rate: r.bounce_rate ?? null,
        });
      }
      for (const r of gscRows ?? []) {
        upsertPorData(r.data, {
          impressoes_organicas: r.impressoes ?? 0,
          cliques_organicos: r.cliques ?? 0,
          ctr_organico: r.ctr ?? null,
          posicao_media: r.posicao_media ?? null,
        });
      }
      for (const r of leadsRows ?? []) {
        const data = String(r.data_criacao).split("T")[0];
        const atual = porData.get(data)?.leads_gerados ?? 0;
        upsertPorData(data, { leads_gerados: atual + 1 });
      }

      for (const [data, patch] of porData) {
        const { error } = await supabase
          .from("artigo_metricas_dia")
          .upsert({ id_artigo: artigo.id_artigo, data, ...patch }, { onConflict: "id_artigo,data" });
        if (error) comErro++;
        else totalAtualizadas++;
      }
    }

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: comErro > 0 && totalAtualizadas === 0 ? "erro" : comErro > 0 ? "parcial" : "sucesso",
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: { artigos: artigos.length, linhas_atualizadas: totalAtualizadas, erros: comErro },
    });

    return new Response(
      JSON.stringify({ message: `${totalAtualizadas} linhas atualizadas`, artigos: artigos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function stripDomain(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, "");
  }
}
