import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para resolver placeholders dinâmicos do Meta nas URLs
function resolverPlaceholders(url: string, contexto: {
  campaignName?: string;
  adId?: string;
  adsetName?: string;
  adName?: string;
}): string {
  if (!url) return url;
  
  let urlResolvida = url;
  
  // Substituir placeholders comuns do Meta
  if (contexto.campaignName) {
    urlResolvida = urlResolvida.replace(/\{\{campaign\.name\}\}/gi, encodeURIComponent(contexto.campaignName));
    urlResolvida = urlResolvida.replace(/\{\{campaign_name\}\}/gi, encodeURIComponent(contexto.campaignName));
  }
  
  if (contexto.adId) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.id\}\}/gi, contexto.adId);
    urlResolvida = urlResolvida.replace(/\{\{ad_id\}\}/gi, contexto.adId);
  }
  
  if (contexto.adsetName) {
    urlResolvida = urlResolvida.replace(/\{\{adset\.name\}\}/gi, encodeURIComponent(contexto.adsetName));
    urlResolvida = urlResolvida.replace(/\{\{adset_name\}\}/gi, encodeURIComponent(contexto.adsetName));
  }
  
  if (contexto.adName) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.name\}\}/gi, encodeURIComponent(contexto.adName));
    urlResolvida = urlResolvida.replace(/\{\{ad_name\}\}/gi, encodeURIComponent(contexto.adName));
  }
  
  return urlResolvida;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "coletar-criativos-meta";

  try {
    console.log("Iniciando coleta de criativos Meta Ads...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verificar se foi passado um ID de integração específico
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    // Buscar integrações ativas do Meta Ads
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    // Se foi passado um ID específico, filtrar por ele
    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: integracoesError } = await query;

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
        let requestCount = 0;
        const MAX_REQUESTS_PER_BATCH = 10;
        
        for (const campanha of campanhas || []) {
          try {
            // Rate limiting: adicionar delay a cada N requisições
            if (requestCount > 0 && requestCount % MAX_REQUESTS_PER_BATCH === 0) {
              console.log(`⏱️ Rate limit: aguardando 2s após ${requestCount} requisições...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            requestCount++;
            
            console.log(`Buscando criativos e investimento da campanha ${campanha.nome}`);

            // Endpoint da API do Meta para buscar ads com TODOS os campos possíveis de URL
            // Incluindo asset_feed_spec para carrosséis e adset info
            const adsUrl = `https://graph.facebook.com/v18.0/${campanha.id_campanha_externo}/ads?fields=id,name,status,adset{name},creative{id,name,object_story_spec{link_data{link,call_to_action,picture,image_hash,child_attachments}},asset_feed_spec{link_urls},effective_object_story_id,image_url,image_hash,video_id,thumbnail_url,url_tags},effective_object_story_id,url_tags,tracking_specs,insights.date_preset(today){impressions,clicks,spend,actions}&access_token=${accessToken}`;

            const adsResponse = await fetch(adsUrl);

            if (!adsResponse.ok) {
              const errorText = await adsResponse.text();
              console.error(`Erro na API Meta (ads): ${adsResponse.status} - ${errorText}`);
              
              let errorMessage = "Erro ao buscar criativos do Meta Ads";
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                  if (errorData.error.code === 190) {
                    errorMessage = "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager.";
                  } else if (errorData.error.code === 200 && errorData.error.message.includes("API access blocked")) {
                    errorMessage = "API Access Blocked: Verifique se o System User Token tem as permissões corretas (ads_read, ads_management) e se o App Meta está em modo Produção. Verifique também se o token tem acesso à conta de anúncios no Business Manager.";
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
              const adsetName = ad.adset?.name || null;
              
              // Determinar tipo de criativo e URL da mídia
              let tipoCriativo = "OUTRO";
              let urlMidia = null;
              
              if (creative.video_id) {
                tipoCriativo = "VIDEO";
                urlMidia = creative.thumbnail_url || null;
              } else if (creative.object_story_spec?.link_data?.picture) {
                tipoCriativo = "IMAGEM";
                urlMidia = creative.object_story_spec.link_data.picture;
              } else if (creative.image_url) {
                tipoCriativo = "IMAGEM";
                urlMidia = creative.image_url;
              } else if (creative.object_story_spec?.link_data?.child_attachments) {
                tipoCriativo = "CARROSSEL";
                const firstCard = creative.object_story_spec.link_data.child_attachments?.[0];
                urlMidia = firstCard?.picture || null;
              }

              // Determinar se está ativo
              const ativo = ad.status === "ACTIVE";

              // Extrair URL final do anúncio e UTM parameters - MELHORADO
              let urlFinal = null;
              let isEngagementAd = false;
              
              try {
                console.log(`\n=== Processando ad ${ad.id} / criativo ${creative.id} (${ad.name}) ===`);
                
                // Contexto para resolução de placeholders
                const contextoPlaceholders = {
                  campaignName: campanha.nome,
                  adId: ad.id,
                  adsetName: adsetName,
                  adName: ad.name
                };
                
                // Prioridade 1: object_story_spec.link_data.link (URL base principal)
                if (creative.object_story_spec?.link_data?.link) {
                  urlFinal = creative.object_story_spec.link_data.link;
                  console.log(`✓ URL base (link_data.link): ${urlFinal}`);
                }
                
                // Prioridade 2: asset_feed_spec.link_urls (para anúncios dinâmicos/carrosséis)
                if (!urlFinal && creative.asset_feed_spec?.link_urls?.length > 0) {
                  urlFinal = creative.asset_feed_spec.link_urls[0].website_url || creative.asset_feed_spec.link_urls[0];
                  console.log(`✓ URL base (asset_feed_spec): ${urlFinal}`);
                }
                
                // Prioridade 3: child_attachments do carrossel
                if (!urlFinal && creative.object_story_spec?.link_data?.child_attachments?.length > 0) {
                  const firstAttachment = creative.object_story_spec.link_data.child_attachments[0];
                  if (firstAttachment.link) {
                    urlFinal = firstAttachment.link;
                    console.log(`✓ URL base (carrossel): ${urlFinal}`);
                  }
                }
                
                // Prioridade 4: tracking_specs (contém URL com parâmetros)
                if (!urlFinal && ad.tracking_specs && ad.tracking_specs.length > 0) {
                  for (const trackingSpec of ad.tracking_specs) {
                    if (trackingSpec.url && trackingSpec.url.includes('http')) {
                      urlFinal = trackingSpec.url;
                      console.log(`✓ URL extraída de tracking_specs: ${urlFinal}`);
                      break;
                    }
                  }
                }
                
                // Adicionar UTM tags se tiver URL base
                if (urlFinal) {
                  // Coletar url_tags de múltiplas fontes
                  const allUrlTags = [];
                  
                  // 1. url_tags no criativo
                  if (creative.url_tags) {
                    console.log(`✓ URL tags no criativo: ${creative.url_tags}`);
                    allUrlTags.push(creative.url_tags);
                  }
                  
                  // 2. url_tags no ad
                  if (ad.url_tags) {
                    console.log(`✓ URL tags no ad: ${ad.url_tags}`);
                    allUrlTags.push(ad.url_tags);
                  }
                  
                  // Combinar todos os parâmetros encontrados
                  if (allUrlTags.length > 0) {
                    const combinedTags = allUrlTags.join('&');
                    const separator = urlFinal.includes('?') ? '&' : '?';
                    urlFinal = `${urlFinal}${separator}${combinedTags}`;
                  }
                  
                  // Resolver placeholders dinâmicos do Meta
                  urlFinal = resolverPlaceholders(urlFinal, contextoPlaceholders);
                  console.log(`✓ URL final após resolver placeholders: ${urlFinal}`);
                  
                  // Verificar se ainda tem placeholders não resolvidos
                  if (urlFinal.includes('{{')) {
                    console.log(`⚠️ URL ainda contém placeholders não resolvidos`);
                  }
                }
                
                // Se não encontrou URL, verificar se é anúncio de engajamento
                if (!urlFinal) {
                  const isPostEngagement = ad.tracking_specs?.some((spec: any) => 
                    spec['action.type']?.includes('post_engagement') || 
                    spec['action.type']?.includes('post_interaction_gross') ||
                    spec['action.type']?.includes('video_view')
                  );
                  
                  if (isPostEngagement) {
                    isEngagementAd = true;
                    console.log(`ℹ️ Anúncio de engajamento/vídeo sem URL externa - OK`);
                  } else {
                    console.log(`⚠️ URL não encontrada para ad ${ad.id}`);
                  }
                }
              } catch (urlErr) {
                console.error(`❌ Erro ao extrair URL do ad ${ad.id}:`, urlErr);
              }

              // Preparar dados do criativo - INCLUINDO id_anuncio_externo (Ad ID)
              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: creative.id, // Creative ID
                id_anuncio_externo: ad.id,        // Ad ID (NOVO!) - usado para match com utm_content
                tipo: tipoCriativo,
                descricao: ad.name || creative.name || null,
                ativo: ativo,
                url_final: urlFinal,
                url_midia: urlMidia,
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
                console.log(`✅ Criativo salvo: ${ad.name || ad.id} | Ad ID: ${ad.id} | Creative ID: ${creative.id} | R$ ${investimento.toFixed(2)}`);
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

    // Registrar execução bem-sucedida
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { resultados }
    });

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
    
    // Registrar execução com erro
    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : String(error)
    });
    
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
