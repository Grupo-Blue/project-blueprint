import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { fetchGSCQueryAnalytics } from "../_shared/composio.ts";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const nomeCronjob = "coletar-metricas-gsc";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;
    const diasJanela = Number(body.dias) || 7;

    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome)")
      .eq("tipo", "GSC")
      .eq("ativo", true);
    if (integracaoIdFiltro) query = query.eq("id_integracao", integracaoIdFiltro);

    const { data: integracoes, error: intError } = await query;
    if (intError) throw intError;
    if (!integracoes?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma integração GSC ativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("COMPOSIO_API_KEY")) {
      throw new Error("COMPOSIO_API_KEY não configurada no Supabase");
    }

    const resultados: any[] = [];
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - diasJanela * 24 * 60 * 60 * 1000);
    const startDate = inicio.toISOString().split("T")[0];
    const endDate = hoje.toISOString().split("T")[0];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;
      const connectedAccountId = integracao.composio_connected_account_id;
      const siteUrl = config.site_url;

      if (!connectedAccountId) {
        await registrarFalha({
          supabase,
          idIntegracao: integracao.id_integracao,
          tipo: "GSC",
          nomeEmpresa,
          errorKind: "OTHER",
          errorMsg: "composio_connected_account_id ausente",
        });
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: "Connected account ID ausente" });
        continue;
      }

      try {
        // Coleta com dimensões page+query+date
        const detalhado = await fetchGSCQueryAnalytics({
          connectedAccountId,
          siteUrl,
          startDate,
          endDate,
          dimensions: ["page", "query", "date"],
        });

        if (!detalhado.ok) {
          await registrarFalha({
            supabase,
            idIntegracao: integracao.id_integracao,
            tipo: "GSC",
            nomeEmpresa,
            errorKind: "OTHER",
            errorMsg: detalhado.error || "Falha desconhecida no Composio",
          });
          resultados.push({ integracao: integracao.id_integracao, status: "error", error: detalhado.error });
          continue;
        }

        let linhasDetalhe = 0;
        let linhasAgregado = 0;
        let comErro = 0;

        for (const row of detalhado.rows ?? []) {
          if (!row.url || !row.date) continue;
          const { error } = await supabase
            .from("gsc_metricas_dia")
            .upsert(
              {
                id_empresa: idEmpresa,
                data: row.date,
                url: row.url,
                query: row.query ?? null,
                impressoes: row.impressions,
                cliques: row.clicks,
                ctr: row.ctr,
                posicao_media: row.position,
              },
              { onConflict: "id_empresa,data,url,query" },
            );
          if (error) comErro++;
          else linhasDetalhe++;
        }

        // Agregado por URL (query=null) — útil para cruzar com artigos
        const agregado = await fetchGSCQueryAnalytics({
          connectedAccountId,
          siteUrl,
          startDate,
          endDate,
          dimensions: ["page", "date"],
        });

        if (agregado.ok) {
          for (const row of agregado.rows ?? []) {
            if (!row.url || !row.date) continue;
            const { error } = await supabase
              .from("gsc_metricas_dia")
              .upsert(
                {
                  id_empresa: idEmpresa,
                  data: row.date,
                  url: row.url,
                  query: null,
                  impressoes: row.impressions,
                  cliques: row.clicks,
                  ctr: row.ctr,
                  posicao_media: row.position,
                },
                { onConflict: "id_empresa,data,url,query" },
              );
            if (error) comErro++;
            else linhasAgregado++;
          }
        }

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "GSC", nomeEmpresa });

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: comErro > 0 ? "parcial" : "success",
          linhas_detalhe: linhasDetalhe,
          linhas_agregado: linhasAgregado,
          erros: comErro,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await registrarFalha({
          supabase,
          idIntegracao: integracao.id_integracao,
          tipo: "GSC",
          nomeEmpresa,
          errorKind: "OTHER",
          errorMsg: errMsg,
        });
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: errMsg });
      }
    }

    const erros = resultados.filter((r) => r.status === "error");
    const sucessos = resultados.filter((r) => r.status === "success" || r.status === "parcial");

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: erros.length > 0 && sucessos.length === 0 ? "erro" : erros.length > 0 ? "parcial" : "sucesso",
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: { periodo: { inicio: startDate, fim: endDate }, resultados },
    });

    return new Response(
      JSON.stringify({ message: `${sucessos.length} integrações processadas`, resultados }),
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
