import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      .select("*")
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
      const idEmpresa = config.id_empresa;
      const customerId = config.customer_id?.replace(/-/g, "");
      const loginCustomerId = config.login_customer_id?.replace(/-/g, "");

      console.log(`[coletar-metricas-google-historico] Processando empresa ${idEmpresa}`);

      try {
        // Obter access token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.client_id,
            client_secret: config.client_secret,
            refresh_token: config.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`[coletar-metricas-google-historico] Erro ao obter token: ${errorText}`);
          resultados.push({ integracao: integracao.id_integracao, status: "error", error: errorText });
          continue;
        }

        const { access_token } = await tokenResponse.json();

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

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[coletar-metricas-google-historico] Erro na API Google Ads: ${response.status} - ${errorText}`);
          resultados.push({ integracao: integracao.id_integracao, status: "error", error: errorText });
          continue;
        }

        const apiData = await response.json();
        const results = apiData.results || [];
        
        console.log(`[coletar-metricas-google-historico] Encontrados ${results.length} registros de métricas`);

        let metricasSalvas = 0;
        let gastoTotal = 0;

        // Processar resultados
        for (const result of results) {
          const campanha = campanhas.find(c => c.id_campanha_externo === String(result.campaign.id));
          if (!campanha) continue;

          const gasto = parseFloat(result.metrics.cost_micros || "0") / 1000000;
          gastoTotal += gasto;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: result.segments.date,
            impressoes: parseInt(result.metrics.impressions || "0"),
            cliques: parseInt(result.metrics.clicks || "0"),
            verba_investida: gasto,
            leads: parseInt(result.metrics.conversions || "0"),
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

        console.log(`[coletar-metricas-google-historico] Salvas ${metricasSalvas} métricas, gasto total: R$ ${gastoTotal.toFixed(2)}`);
        
        resultados.push({ 
          integracao: integracao.id_integracao, 
          empresa: idEmpresa,
          status: "success", 
          metricas_salvas: metricasSalvas,
          gasto_total: gastoTotal
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