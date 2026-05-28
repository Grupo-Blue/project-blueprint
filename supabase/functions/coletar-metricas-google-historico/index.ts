import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { obterAccessTokenGoogle } from "../_shared/validar.ts";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";
import { composioEnabled, fetchGoogleAdsMetricsViaComposio } from "../_shared/composio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[coletar-metricas-google-historico] Iniciando coleta de métricas históricas...");

    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;
    const dataInicio = body.data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 30 dias atrás
    const dataFim = body.data_fim || new Date().toISOString().split("T")[0];

    console.log(`[coletar-metricas-google-historico] Período: ${dataInicio} a ${dataFim}`);

    // Buscar integrações Google Ads ativas
    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome)")
      .eq("tipo", "GOOGLE_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
    }

    const { data: integracoes, error: intError } = await query;

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("[coletar-metricas-google-historico] Nenhuma integração Google Ads ativa");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;
      const customerId = config.customer_id?.replace(/-/g, "");
      const loginCustomerId = config.login_customer_id?.replace(/-/g, "");

      console.log(`[coletar-metricas-google-historico] Processando empresa ${idEmpresa}`);

      try {
        const tokenResult = await obterAccessTokenGoogle(config);
        if (!tokenResult.access_token) {
          await registrarFalha({
            supabase,
            idIntegracao: integracao.id_integracao,
            tipo: "GOOGLE_ADS",
            nomeEmpresa,
            errorKind: tokenResult.errorKind,
            errorMsg: tokenResult.error || "Falha no refresh token",
          });
          resultados.push({ integracao: integracao.id_integracao, status: "error", error: tokenResult.error });
          continue;
        }
        const access_token = tokenResult.access_token;

        // Buscar TODAS as campanhas da empresa (ativas e inativas)
        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta, nome")
          .in("id_conta", 
            await supabase
              .from("conta_anuncio")
              .select("id_conta")
              .eq("id_empresa", idEmpresa)
              .eq("plataforma", "GOOGLE")
              .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) {
          console.log(`[coletar-metricas-google-historico] Nenhuma campanha encontrada para empresa ${idEmpresa}`);
          continue;
        }

        console.log(`[coletar-metricas-google-historico] Encontradas ${campanhas.length} campanhas`);

        const campaignIds = campanhas.map(c => c.id_campanha_externo);

        // Query GAQL para buscar métricas históricas com segmentação por data
        const gaqlQuery = `
          SELECT 
            campaign.id,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE campaign.id IN (${campaignIds.join(",")})
            AND segments.date BETWEEN '${dataInicio}' AND '${dataFim}'
        `;

        const apiUrl = `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`;
        
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${access_token}`,
          "developer-token": config.developer_token,
          "Content-Type": "application/json",
        };
        
        if (loginCustomerId) {
          headers["login-customer-id"] = loginCustomerId;
        }
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: gaqlQuery }),
        });

        let results: any[] = [];
        let fonteFallback = false;

        if (response.ok) {
          const apiData = await response.json();
          results = apiData.results || [];
        } else {
          const errorText = await response.text();
          console.error(`[coletar-metricas-google-historico] Erro na API Google Ads: ${response.status} - ${errorText}`);

          const connectedAccountId = config.composio_connected_account_id;
          if (composioEnabled(connectedAccountId)) {
            const fb = await fetchGoogleAdsMetricsViaComposio({
              connectedAccountId,
              customerId,
              loginCustomerId,
              campaignIds,
              since: dataInicio,
              until: dataFim,
            });
            if (fb.ok && fb.rows) {
              fonteFallback = true;
              results = fb.rows.map(r => ({
                campaign: { id: r.campaign_id },
                segments: { date: r.date },
                metrics: {
                  impressions: r.impressions ?? 0,
                  clicks: r.clicks ?? 0,
                  costMicros: (r.spend ?? 0) * 1_000_000,
                  conversions: Number(r.actions?.find(a => a.action_type === "conversions")?.value ?? 0),
                },
              }));
            }
          }

          if (!fonteFallback) {
            await registrarFalha({
              supabase,
              idIntegracao: integracao.id_integracao,
              tipo: "GOOGLE_ADS",
              nomeEmpresa,
              errorKind: "OTHER",
              errorMsg: `Google Ads API ${response.status}: ${errorText.slice(0, 200)}`,
            });
            resultados.push({ integracao: integracao.id_integracao, status: "error", error: errorText });
            continue;
          }
        }

        console.log(`[coletar-metricas-google-historico] Encontrados ${results.length} registros de métricas`);

        let metricasSalvas = 0;
        let gastoTotal = 0;

        for (const result of results) {
          const campanha = campanhas.find(c => c.id_campanha_externo === String(result.campaign.id));
          if (!campanha) continue;

          const gasto = parseFloat(result.metrics.costMicros || "0") / 1000000;
          gastoTotal += gasto;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: result.segments.date,
            impressoes: parseInt(result.metrics.impressions || "0"),
            cliques: parseInt(result.metrics.clicks || "0"),
            verba_investida: gasto,
            leads: Math.round(parseFloat(result.metrics.conversions || "0")),
            fonte_conversoes: fonteFallback ? "GOOGLE_API_FALLBACK_COMPOSIO" : "GOOGLE_API_DAILY",
          };

          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`[coletar-metricas-google-historico] Erro ao salvar:`, upsertError);
          } else {
            metricasSalvas++;
          }
        }

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "GOOGLE_ADS", nomeEmpresa });
        console.log(`[coletar-metricas-google-historico] Salvas ${metricasSalvas} métricas, gasto total: R$ ${gastoTotal.toFixed(2)}`);

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: "success",
          metricas_salvas: metricasSalvas,
          gasto_total: gastoTotal,
          fallback: fonteFallback,
        });

      } catch (error) {
        console.error(`[coletar-metricas-google-historico] Erro:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    // Registrar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "coletar-metricas-google-historico",
      status: resultados.some(r => r.status === "error") ? "partial" : "success",
      detalhes_execucao: { resultados, data_inicio: dataInicio, data_fim: dataFim }
    });

    return new Response(
      JSON.stringify({ 
        message: "Coleta histórica concluída", 
        resultados,
        periodo: { inicio: dataInicio, fim: dataFim }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[coletar-metricas-google-historico] Erro:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});