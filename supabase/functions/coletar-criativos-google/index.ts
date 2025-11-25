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

    // Buscar integrações ativas do Google Ads
    const { data: integracoes, error: integracoesError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "GOOGLE_ADS")
      .eq("ativo", true);

    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Google Ads ativas`);

    const resultados = [];

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

        // Para cada campanha, buscar os ads (criativos)
        for (const campanha of campanhas || []) {
          try {
            console.log(`Buscando criativos da campanha ${campanha.nome}`);

            // Query GAQL para buscar ads da campanha
            const gaqlQuery = `
              SELECT 
                ad_group_ad.ad.id,
                ad_group_ad.ad.name,
                ad_group_ad.ad.type,
                ad_group_ad.status,
                ad_group_ad.ad.responsive_display_ad.marketing_images,
                ad_group_ad.ad.responsive_display_ad.logo_images,
                ad_group_ad.ad.video_ad.video,
                ad_group_ad.ad.image_ad.image_url,
                ad_group_ad.ad.app_ad.images,
                ad_group_ad.ad.discovery_carousel_ad.carousel_cards
              FROM ad_group_ad 
              WHERE campaign.id = ${campanha.id_campanha_externo}
                AND ad_group_ad.status != 'REMOVED'
              ORDER BY ad_group_ad.ad.id DESC
              LIMIT 100
            `;

            const searchUrl = `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`;

            const searchResponse = await fetch(searchUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "developer-token": developerToken,
                "Content-Type": "application/json",
              },
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

            // Processar cada ad (criativo)
            for (const result of searchData.results || []) {
              const adGroupAd = result.adGroupAd;
              const ad = adGroupAd.ad;

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

              // Preparar dados do criativo
              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: ad.id,
                tipo: tipoCriativo,
                descricao: ad.name || null,
                ativo: ativo,
              };

              // Upsert do criativo (insere ou atualiza)
              const { error: upsertError } = await supabase
                .from("criativo")
                .upsert(criativoData, {
                  onConflict: "id_criativo_externo",
                  ignoreDuplicates: false,
                });

              if (upsertError) {
                console.error("Erro ao salvar criativo:", upsertError);
              } else {
                console.log(`Criativo ${ad.name || ad.id} salvo`);
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
