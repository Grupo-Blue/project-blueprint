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

    console.log("Iniciando coleta de métricas Meta Ads...");

    // Buscar todas as integrações Meta Ads ativas
    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Meta Ads ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date().toISOString().split("T")[0];
    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const accessToken = config.access_token;
      const adAccountId = config.ad_account_id;
      const idEmpresa = config.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

      try {
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
              .eq("plataforma", "META")
              .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) continue;

        // Buscar métricas da API do Meta
        const campaignIds = campanhas.map(c => c.id_campanha_externo).join(",");
        const fields = "campaign_id,impressions,clicks,spend,actions";
        const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?fields=${fields}&level=campaign&date_preset=today&access_token=${accessToken}&filtering=[{"field":"campaign.id","operator":"IN","value":["${campaignIds.replace(/,/g, '","')}"]}]`;

        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erro na API Meta: ${response.status} - ${errorText}`);
          
          // Parse error message from Meta API
          let errorMessage = "Erro ao conectar com Meta Ads";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              if (errorData.error.code === 190) {
                errorMessage = "Access Token inválido ou expirado. Por favor, gere um novo token no Meta Business.";
              } else {
                errorMessage = errorData.error.message;
              }
            }
          } catch {
            errorMessage = `Erro ${response.status}: Verifique suas credenciais do Meta Ads`;
          }
          
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: errorMessage
          });
          continue;
        }

        const apiData = await response.json();

        // Processar cada campanha
        for (const metrica of apiData.data || []) {
          const campanha = campanhas.find(c => c.id_campanha_externo === metrica.campaign_id);
          if (!campanha) continue;

          const leads = metrica.actions?.find((a: any) => a.action_type === "lead")?.value || 0;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: hoje,
            impressoes: parseInt(metrica.impressions || "0"),
            cliques: parseInt(metrica.clicks || "0"),
            verba_investida: parseFloat(metrica.spend || "0"),
            leads: parseInt(leads),
          };

          // Inserir ou atualizar métricas do dia
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

    console.log("Coleta de métricas Meta Ads concluída");
    
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");
    
    if (erros.length > 0 && sucessos.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: erros[0].error || "Erro ao coletar métricas do Meta Ads",
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