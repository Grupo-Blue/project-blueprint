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

    console.log("Iniciando coleta de métricas Google Ads...");

    // Buscar todas as integrações Google Ads ativas
    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "GOOGLE_ADS")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Google Ads ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date().toISOString().split("T")[0];
    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = config.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}`);

      try {
        // Obter access token usando refresh token
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
          console.error(`Erro ao obter token: ${errorText}`);
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: `Falha na autenticação Google Ads: ${errorText}. Verifique suas credenciais OAuth2.` 
          });
          continue;
        }

        const { access_token } = await tokenResponse.json();

        // Buscar campanhas da conta de anúncio
        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta")
          .eq("ativa", true)
          .in("id_conta", 
            await supabase
              .from("conta_anuncio")
              .select("id_conta")
              .eq("id_empresa", idEmpresa)
              .eq("plataforma", "GOOGLE")
              .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) continue;

        const campaignIds = campanhas.map(c => c.id_campanha_externo);

        // Query GAQL para buscar métricas
        const query = `
          SELECT 
            campaign.id,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE campaign.id IN (${campaignIds.join(",")})
            AND segments.date = '${hoje}'
        `;

        const apiUrl = `https://googleads.googleapis.com/v14/customers/${config.customer_id.replace(/-/g, "")}/googleAds:searchStream`;
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "developer-token": config.developer_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erro na API Google Ads: ${response.status} - ${errorText}`);
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: `Erro na API Google Ads (${response.status}): ${errorText}` 
          });
          continue;
        }

        const apiData = await response.json();

        // Processar resultados
        for (const result of apiData) {
          const campanha = campanhas.find(c => c.id_campanha_externo === String(result.campaign.id));
          if (!campanha) continue;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: hoje,
            impressoes: parseInt(result.metrics.impressions || "0"),
            cliques: parseInt(result.metrics.clicks || "0"),
            verba_investida: parseFloat(result.metrics.cost_micros || "0") / 1000000,
            leads: parseInt(result.metrics.conversions || "0"),
          };

          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`Erro ao salvar métricas da campanha ${campanha.id_campanha}:`, upsertError);
          } else {
            resultados.push({ campanha: campanha.id_campanha, status: "success" });
          }
        }
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log("Coleta de métricas Google Ads concluída");
    
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");
    
    if (erros.length > 0 && sucessos.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: erros[0].error || "Erro ao coletar métricas do Google Ads",
          resultados 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Coleta concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`, 
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});