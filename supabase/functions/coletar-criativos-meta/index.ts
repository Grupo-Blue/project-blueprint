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
    console.log("Iniciando coleta de criativos Meta Ads...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar integrações ativas do Meta Ads
    const { data: integracoes, error: integracoesError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Meta Ads ativas`);

    const resultados = [];
    const hoje = new Date().toISOString().split("T")[0];

    for (const integracao of integracoes || []) {
      try {
        const config = integracao.config_json as any;
        const accessToken = config.access_token;
        const adAccountId = config.ad_account_id;
        const idEmpresa = config.id_empresa;

        console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

        // Primeiro buscar contas de anúncio da empresa com plataforma META
        const { data: contasAnuncio, error: contasError } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "META")
          .eq("ativa", true);

        if (contasError) {
          console.error("Erro ao buscar contas de anúncio:", contasError);
          continue;
        }

        if (!contasAnuncio || contasAnuncio.length === 0) {
          console.log(`Nenhuma conta de anúncio META encontrada para empresa ${idEmpresa}`);
          continue;
        }

        const idsContas = contasAnuncio.map(c => c.id_conta);

        // Buscar campanhas ativas dessas contas
        const { data: campanhas, error: campanhasError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, nome, id_conta")
          .eq("ativa", true)
          .in("id_conta", idsContas);

        if (campanhasError) {
          console.error("Erro ao buscar campanhas:", campanhasError);
          continue;
        }

        // Buscar informações atualizadas das campanhas da API
        const campaignIds = campanhas?.map(c => c.id_campanha_externo).join(",") || "";
        if (campaignIds) {
          const campaignsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective&ids=${campaignIds}&access_token=${accessToken}`;
          
          try {
            const campaignsResponse = await fetch(campaignsUrl);
            if (campaignsResponse.ok) {
              const campaignsData = await campaignsResponse.json();
              
              // Atualizar dados das campanhas
              for (const campData of campaignsData.data || []) {
                const campanhaLocal = campanhas?.find(c => c.id_campanha_externo === campData.id);
                if (campanhaLocal) {
                  await supabase
                    .from("campanha")
                    .update({
                      nome: campData.name,
                      ativa: campData.status === "ACTIVE",
                      objetivo: campData.objective || null,
                    })
                    .eq("id_campanha", campanhaLocal.id_campanha);
                  
                  console.log(`Campanha ${campData.name} atualizada`);
                }
              }
            }
          } catch (err) {
            console.error("Erro ao atualizar campanhas:", err);
          }
        }

        // Para cada campanha, buscar os ads (criativos) com métricas
        for (const campanha of campanhas || []) {
          try {
            console.log(`Buscando criativos e investimento da campanha ${campanha.nome}`);

            // Endpoint da API do Meta para buscar ads com métricas de hoje
            const adsUrl = `https://graph.facebook.com/v18.0/${campanha.id_campanha_externo}/ads?fields=id,name,status,creative{id,name,object_story_spec,image_url,video_id,thumbnail_url},insights.date_preset(today){impressions,clicks,spend,actions}&access_token=${accessToken}`;

            const adsResponse = await fetch(adsUrl);

            if (!adsResponse.ok) {
              const errorText = await adsResponse.text();
              console.error(`Erro na API Meta (ads): ${adsResponse.status} - ${errorText}`);
              
              let errorMessage = "Erro ao buscar criativos do Meta Ads";
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                  if (errorData.error.code === 190) {
                    errorMessage = "Access Token inválido ou expirado.";
                  } else {
                    errorMessage = errorData.error.message;
                  }
                }
              } catch {
                errorMessage = `Erro ${adsResponse.status}`;
              }

              resultados.push({
                integracao: integracao.id_integracao,
                campanha: campanha.nome,
                status: "error",
                error: errorMessage,
              });
              continue;
            }

            const adsData = await adsResponse.json();
            console.log(`Encontrados ${adsData.data?.length || 0} ads para campanha ${campanha.nome}`);

            // Processar cada ad (criativo) com métricas de hoje
            for (const ad of adsData.data || []) {
              const creative = ad.creative;
              
              // Determinar tipo de criativo
              let tipoCriativo = "OUTRO";
              if (creative.video_id) {
                tipoCriativo = "VIDEO";
              } else if (creative.image_url) {
                tipoCriativo = "IMAGEM";
              } else if (creative.object_story_spec?.link_data?.child_attachments) {
                tipoCriativo = "CARROSSEL";
              }

              // Determinar se está ativo
              const ativo = ad.status === "ACTIVE";

              // Preparar dados do criativo
              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: creative.id,
                tipo: tipoCriativo,
                descricao: ad.name || creative.name || null,
                ativo: ativo,
              };

              // Upsert do criativo (insere ou atualiza)
              const { data: criativoSalvo, error: upsertError } = await supabase
                .from("criativo")
                .upsert(criativoData, {
                  onConflict: "id_criativo_externo",
                  ignoreDuplicates: false,
                })
                .select()
                .single();

              if (upsertError) {
                console.error("Erro ao salvar criativo:", upsertError);
                continue;
              }

              // Capturar métricas de hoje
              let impressoes = 0;
              let cliques = 0;
              let investimento = 0;
              let leads = 0;

              if (ad.insights && ad.insights.data && ad.insights.data.length > 0) {
                const metricas = ad.insights.data[0];
                impressoes = parseInt(metricas.impressions || "0");
                cliques = parseInt(metricas.clicks || "0");
                investimento = parseFloat(metricas.spend || "0");
                
                // Buscar leads das actions
                const leadAction = metricas.actions?.find((a: any) => a.action_type === "lead");
                if (leadAction) {
                  leads = parseInt(leadAction.value || "0");
                }
              }

              // Salvar métricas diárias do criativo
              const metricasData = {
                id_criativo: criativoSalvo.id_criativo,
                data: hoje,
                impressoes,
                cliques,
                verba_investida: investimento,
                leads,
              };

              const { error: metricasError } = await supabase
                .from("criativo_metricas_dia")
                .upsert(metricasData, { onConflict: "id_criativo,data" });

              if (metricasError) {
                console.error("Erro ao salvar métricas do criativo:", metricasError);
              } else {
                console.log(`Criativo ${ad.name || ad.id} salvo com métricas: R$ ${investimento.toFixed(2)}, ${impressoes} impressões, ${cliques} cliques, ${leads} leads`);
              }
            }

            resultados.push({
              integracao: integracao.id_integracao,
              campanha: campanha.nome,
              status: "success",
              criativos_encontrados: adsData.data?.length || 0,
            });
          } catch (campErr) {
            console.error(`Erro ao processar campanha ${campanha.nome}:`, campErr);
            resultados.push({
              integracao: integracao.id_integracao,
              campanha: campanha.nome,
              status: "error",
              error: campErr instanceof Error ? campErr.message : String(campErr),
            });
          }
        }
      } catch (integErr) {
        console.error("Erro ao processar integração:", integErr);
        resultados.push({
          integracao: integracao.id_integracao,
          status: "error",
          error: integErr instanceof Error ? integErr.message : String(integErr),
        });
      }
    }

    console.log("Coleta de criativos Meta Ads concluída");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Coleta de criativos concluída",
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});