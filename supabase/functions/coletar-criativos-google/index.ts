import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para obter access token do Google usando refresh token
async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao obter access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando coleta de criativos Google Ads...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verificar se foi passado um ID de integração específico
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    // Buscar integrações ativas do Google Ads
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "GOOGLE_ADS")
      .eq("ativo", true);

    // Se foi passado um ID específico, filtrar por ele
    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: integracoesError } = await query;

    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Google Ads ativas`);

    const resultados = [];
    const hoje = new Date().toISOString().split("T")[0];

    for (const integracao of integracoes || []) {
      try {
        const config = integracao.config_json as any;
        const customerId = config.customer_id?.replace(/-/g, "");
        const refreshToken = config.refresh_token;
        const clientId = config.client_id;
        const clientSecret = config.client_secret;
        const developerToken = config.developer_token;
        const idEmpresa = config.id_empresa;

        console.log(`Processando integração para empresa ${idEmpresa}, customer ${customerId}`);

        // Obter access token
        const accessToken = await getAccessToken(refreshToken, clientId, clientSecret);

        // Primeiro buscar contas de anúncio da empresa com plataforma GOOGLE
        const { data: contasAnuncio, error: contasError } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "GOOGLE")
          .eq("ativa", true);

        if (contasError) {
          console.error("Erro ao buscar contas de anúncio:", contasError);
          continue;
        }

        if (!contasAnuncio || contasAnuncio.length === 0) {
          console.log(`Nenhuma conta de anúncio GOOGLE encontrada para empresa ${idEmpresa}`);
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

        const campaignIds = campanhas?.map(c => c.id_campanha_externo) || [];
        
        // Buscar informações atualizadas das campanhas
        if (campaignIds.length > 0) {
          const campaignsQuery = `
            SELECT 
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type
            FROM campaign
            WHERE campaign.id IN (${campaignIds.join(",")})
          `;

          try {
            const campaignsUrl = `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`;
            const campaignsResponse = await fetch(campaignsUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "developer-token": developerToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: campaignsQuery }),
            });

            if (campaignsResponse.ok) {
              const campaignsData = await campaignsResponse.json();
              
              // Atualizar dados das campanhas
              for (const result of campaignsData.results || []) {
                const campData = result.campaign;
                const campanhaLocal = campanhas?.find(c => c.id_campanha_externo === String(campData.id));
                
                if (campanhaLocal) {
                  await supabase
                    .from("campanha")
                    .update({
                      nome: campData.name,
                      ativa: campData.status === "ENABLED",
                      objetivo: campData.advertisingChannelType || null,
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
            console.log(`Buscando criativos da campanha ${campanha.nome}`);

            // Query GAQL para buscar ads da campanha com métricas de hoje e URLs finais
            const gaqlQuery = `
              SELECT 
                ad_group_ad.ad.id,
                ad_group_ad.ad.name,
                ad_group_ad.ad.type,
                ad_group_ad.ad.final_urls,
                ad_group_ad.ad.tracking_url_template,
                ad_group_ad.status,
                ad_group_ad.ad.responsive_display_ad.marketing_images,
                ad_group_ad.ad.responsive_display_ad.logo_images,
                ad_group_ad.ad.video_ad.video,
                ad_group_ad.ad.image_ad.image_url,
                ad_group_ad.ad.app_ad.images,
                ad_group_ad.ad.discovery_carousel_ad.carousel_cards,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions
              FROM ad_group_ad 
              WHERE campaign.id = ${campanha.id_campanha_externo}
                AND ad_group_ad.status != 'REMOVED'
                AND segments.date = '${hoje}'
              ORDER BY ad_group_ad.ad.id DESC
              LIMIT 100
            `;

            const loginCustomerId = config.login_customer_id?.replace(/-/g, "");
            const searchUrl = `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`;

            const headers: Record<string, string> = {
              "Authorization": `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "Content-Type": "application/json",
            };

            if (loginCustomerId) {
              headers["login-customer-id"] = loginCustomerId;
            }

            const searchResponse = await fetch(searchUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({ query: gaqlQuery }),
            });

            if (!searchResponse.ok) {
              const errorText = await searchResponse.text();
              console.error(`Erro na API Google Ads: ${searchResponse.status} - ${errorText}`);
              
              let errorMessage = "Erro ao buscar criativos do Google Ads";
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                }
              } catch {
                errorMessage = `Erro ${searchResponse.status}`;
              }

              resultados.push({
                integracao: integracao.id_integracao,
                campanha: campanha.nome,
                status: "error",
                error: errorMessage,
              });
              continue;
            }

            const searchData = await searchResponse.json();
            console.log(`Encontrados ${searchData.results?.length || 0} ads para campanha ${campanha.nome}`);

            // Processar cada ad (criativo) com métricas
            for (const result of searchData.results || []) {
              const adGroupAd = result.adGroupAd;
              const ad = adGroupAd.ad;
              const metrics = result.metrics;

              // Determinar tipo de criativo baseado no tipo do ad
              let tipoCriativo = "OUTRO";
              if (ad.type === "VIDEO_AD" || ad.videoAd) {
                tipoCriativo = "VIDEO";
              } else if (ad.type === "IMAGE_AD" || ad.imageAd || ad.responsiveDisplayAd?.marketingImages) {
                tipoCriativo = "IMAGEM";
              } else if (ad.type === "DISCOVERY_CAROUSEL_AD" || ad.discoveryCarouselAd) {
                tipoCriativo = "CARROSSEL";
              }

              // Determinar se está ativo
              const ativo = adGroupAd.status === "ENABLED";

              // Extrair URL final do anúncio
              let urlFinal = null;
              try {
                // Google Ads retorna final_urls como array
                if (ad.finalUrls && ad.finalUrls.length > 0) {
                  urlFinal = ad.finalUrls[0];
                  
                  // Se houver tracking_url_template, combinar com a URL
                  if (ad.trackingUrlTemplate) {
                    // O tracking template geralmente adiciona parâmetros à URL
                    urlFinal = ad.trackingUrlTemplate.replace('{lpurl}', urlFinal);
                  }
                }
              } catch (urlErr) {
                console.log(`Não foi possível extrair URL do criativo ${ad.id}`);
              }

              // Preparar dados do criativo
              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: ad.id,
                tipo: tipoCriativo,
                descricao: ad.name || null,
                ativo: ativo,
                url_final: urlFinal,
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
              const impressoes = parseInt(metrics?.impressions || "0");
              const cliques = parseInt(metrics?.clicks || "0");
              const investimento = parseFloat(metrics?.costMicros || "0") / 1000000;
              const leads = parseInt(metrics?.conversions || "0");

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
              criativos_encontrados: searchData.results?.length || 0,
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

    console.log("Coleta de criativos Google Ads concluída");

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