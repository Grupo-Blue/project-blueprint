import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Junta dados que já existem (landingpage_metricas + gsc_metricas_dia + lead) por URL/slug do artigo
// e grava em artigo_metricas_dia. Refatorado para ler em lote por empresa (1 select por tabela
// independente do nº de artigos) e fazer bulk upsert final.

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

    // Agrupa artigos por empresa para reduzir queries
    const artigosPorEmpresa = new Map<string, typeof artigos>();
    for (const a of artigos) {
      const arr = artigosPorEmpresa.get(a.id_empresa) ?? [];
      arr.push(a);
      artigosPorEmpresa.set(a.id_empresa, arr);
    }

    let totalAtualizadas = 0;
    let comErro = 0;
    const payloadAcumulado: any[] = [];

    for (const [idEmpresa, artigosEmpresa] of artigosPorEmpresa) {
      const paths = artigosEmpresa.map((a) => stripDomain(a.url));
      const slugs = artigosEmpresa.map((a) => a.slug).filter(Boolean) as string[];
      const ids = artigosEmpresa.map((a) => a.id_artigo);

      // 1) GA4 — landingpage_metricas em UMA query (filtrando por candidatos de URL)
      const lpQuery = supabase
        .from("landingpage_metricas")
        .select("data, url, sessoes, usuarios, tempo_medio_segundos, bounce_rate")
        .eq("id_empresa", idEmpresa)
        .gte("data", dataInicio);
      // Como url pode ter formato completo vs path, usamos OR de ilike (resilência).
      // Em DB grande, prefira manter padrão consistente (sempre URL completa).
      const lpFilter = paths.map((p) => `url.ilike.%${p}%`).join(",");
      const { data: lpRows } = await (lpFilter ? lpQuery.or(lpFilter) : lpQuery);

      // 2) GSC — agregado por URL (query=null) em UMA query
      const gscQuery = supabase
        .from("gsc_metricas_dia")
        .select("data, url, impressoes, cliques, ctr, posicao_media")
        .eq("id_empresa", idEmpresa)
        .is("query", null)
        .gte("data", dataInicio);
      const { data: gscRows } = await (lpFilter ? gscQuery.or(lpFilter) : gscQuery);

      // 3) Leads em UMA query (id_artigo IN ... OR utm_campaign IN ...)
      const leadsQuery = supabase
        .from("lead")
        .select("data_criacao, id_artigo, utm_campaign")
        .eq("id_empresa", idEmpresa)
        .gte("data_criacao", `${dataInicio}T00:00:00`);
      const idFilter = ids.length > 0 ? `id_artigo.in.(${ids.join(",")})` : null;
      const slugFilter = slugs.length > 0 ? `utm_campaign.in.(${slugs.map(s => `"${s}"`).join(",")})` : null;
      const orParts = [idFilter, slugFilter].filter(Boolean).join(",");
      const { data: leadsRows } = await (orParts ? leadsQuery.or(orParts) : leadsQuery);

      // Indexa por artigo + data
      for (const artigo of artigosEmpresa) {
        const path = stripDomain(artigo.url);
        const porData = new Map<string, any>();
        const accum = (data: string, patch: any) => {
          if (!data) return;
          porData.set(data, { ...(porData.get(data) ?? {}), ...patch });
        };

        for (const r of lpRows ?? []) {
          if (!r.url || !r.url.includes(path)) continue;
          accum(r.data, {
            sessoes: r.sessoes ?? 0,
            usuarios: r.usuarios ?? 0,
            tempo_medio_seg: r.tempo_medio_segundos ?? null,
            bounce_rate: r.bounce_rate ?? null,
          });
        }
        for (const r of gscRows ?? []) {
          if (!r.url || !r.url.includes(path)) continue;
          accum(r.data, {
            impressoes_organicas: r.impressoes ?? 0,
            cliques_organicos: r.cliques ?? 0,
            ctr_organico: r.ctr ?? null,
            posicao_media: r.posicao_media ?? null,
          });
        }
        for (const r of leadsRows ?? []) {
          if (r.id_artigo !== artigo.id_artigo && r.utm_campaign !== (artigo.slug ?? null)) continue;
          const data = String(r.data_criacao).split("T")[0];
          const atual = porData.get(data)?.leads_gerados ?? 0;
          accum(data, { leads_gerados: atual + 1 });
        }

        for (const [data, patch] of porData) {
          payloadAcumulado.push({ id_artigo: artigo.id_artigo, data, ...patch });
        }
      }
    }

    // Bulk upsert em chunks de 500
    if (payloadAcumulado.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < payloadAcumulado.length; i += chunkSize) {
        const chunk = payloadAcumulado.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("artigo_metricas_dia")
          .upsert(chunk, { onConflict: "id_artigo,data" });
        if (error) {
          console.error(`upsert chunk ${i}: ${error.message}`);
          comErro += chunk.length;
        } else {
          totalAtualizadas += chunk.length;
        }
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
