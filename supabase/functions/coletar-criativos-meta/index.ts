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

        // Para cada campanha, buscar os ads (criativos) com métricas
        for (const campanha of campanhas || []) {
          try {
            console.log(`Buscando criativos e investimento da campanha ${campanha.nome}`);

            // Endpoint da API do Meta para buscar ads com métricas de investimento
            const adsUrl = `https://graph.facebook.com/v18.0/${campanha.id_campanha_externo}/ads?fields=id,name,status,creative{id,name,object_story_spec,image_url,video_id,thumbnail_url},insights.date_preset(last_7d){spend}&access_token=${accessToken}`;

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

            // Processar cada ad (criativo) com investimento
            for (const ad of adsData.data || []) {
              const creative = ad.creative;
              
              // Capturar investimento dos últimos 7 dias
              let investimento7dias = 0;
              if (ad.insights && ad.insights.data && ad.insights.data.length > 0) {
                investimento7dias = parseFloat(ad.insights.data[0].spend || 0);
              }
              
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
                id_criativo_externo: creative.id,  // Usar ID do creative, não do ad
                tipo: tipoCriativo,
                descricao: ad.name || creative.name || null,
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
                console.log(`Criativo ${ad.name || ad.id} salvo com investimento de R$ ${investimento7dias.toFixed(2)} (últimos 7 dias)`);
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
