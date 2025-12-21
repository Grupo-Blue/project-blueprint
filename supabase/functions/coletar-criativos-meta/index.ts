import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para resolver placeholders dinâmicos do Meta nas URLs
function resolverPlaceholders(url: string, contexto: {
  campaignName?: string;
  campaignId?: string;
  adId?: string;
  adsetName?: string;
  adsetId?: string;
  adName?: string;
}): string {
  if (!url) return url;
  
  let urlResolvida = url;
  
  if (contexto.campaignName) {
    urlResolvida = urlResolvida.replace(/\{\{campaign\.name\}\}/gi, encodeURIComponent(contexto.campaignName));
    urlResolvida = urlResolvida.replace(/\{\{campaign_name\}\}/gi, encodeURIComponent(contexto.campaignName));
  }
  if (contexto.campaignId) {
    urlResolvida = urlResolvida.replace(/\{\{campaign\.id\}\}/gi, contexto.campaignId);
    urlResolvida = urlResolvida.replace(/\{\{campaign_id\}\}/gi, contexto.campaignId);
  }
  if (contexto.adId) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.id\}\}/gi, contexto.adId);
    urlResolvida = urlResolvida.replace(/\{\{ad_id\}\}/gi, contexto.adId);
  }
  if (contexto.adName) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.name\}\}/gi, encodeURIComponent(contexto.adName));
    urlResolvida = urlResolvida.replace(/\{\{ad_name\}\}/gi, encodeURIComponent(contexto.adName));
  }
  if (contexto.adsetName) {
    urlResolvida = urlResolvida.replace(/\{\{adset\.name\}\}/gi, encodeURIComponent(contexto.adsetName));
    urlResolvida = urlResolvida.replace(/\{\{adset_name\}\}/gi, encodeURIComponent(contexto.adsetName));
  }
  if (contexto.adsetId) {
    urlResolvida = urlResolvida.replace(/\{\{adset\.id\}\}/gi, contexto.adsetId);
    urlResolvida = urlResolvida.replace(/\{\{adset_id\}\}/gi, contexto.adsetId);
  }
  
  return urlResolvida;
}

// Função simplificada para extrair URL do link_data (sem chamadas extras à API)
function extrairURLDoCreative(creative: any, ad: any): { url: string | null; source: string } {
  // 1. link_data.link (mais comum)
  if (creative.object_story_spec?.link_data?.link) {
    return { url: creative.object_story_spec.link_data.link, source: "link_data.link" };
  }
  
  // 2. CTA value.link
  if (creative.object_story_spec?.link_data?.call_to_action?.value?.link) {
    return { url: creative.object_story_spec.link_data.call_to_action.value.link, source: "cta_value.link" };
  }
  
  // 3. asset_feed_spec.link_urls
  if (creative.asset_feed_spec?.link_urls?.length > 0) {
    const linkUrl = creative.asset_feed_spec.link_urls[0];
    const url = typeof linkUrl === 'object' ? linkUrl.website_url : linkUrl;
    if (url) return { url, source: "asset_feed_spec" };
  }
  
  // 4. child_attachments do carrossel
  if (creative.object_story_spec?.link_data?.child_attachments?.length > 0) {
    const first = creative.object_story_spec.link_data.child_attachments[0];
    if (first.link) return { url: first.link, source: "carousel_link" };
    if (first.call_to_action?.value?.link) return { url: first.call_to_action.value.link, source: "carousel_cta" };
  }
  
  // 5. creative.link_url
  if (creative.link_url) {
    return { url: creative.link_url, source: "creative_link_url" };
  }
  
  return { url: null, source: "não encontrada" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "coletar-criativos-meta";
  const MAX_TIME_MS = 50000; // 50s para deixar margem

  try {
    console.log("Iniciando coleta de criativos Meta Ads (v4.0 - otimizada com batches)...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;
    const campanhaIdFiltro = body.campanha_id;
    const maxCampanhasPorExecucao = body.max_campanhas || 5; // Processar no máximo 5 campanhas por vez

    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
    }

    const { data: integracoes, error: integracoesError } = await query;
    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Meta Ads ativas`);

    const resultados: any[] = [];
    const hoje = new Date().toISOString().split("T")[0];
    let campanhasProcessadas = 0;
    let campanhasPendentes: any[] = [];

    for (const integracao of integracoes || []) {
      // Verificar timeout
      if (Date.now() - startTime > MAX_TIME_MS) {
        console.log(`⏱️ Timeout próximo, encerrando coleta...`);
        break;
      }

      try {
        const config = integracao.config_json as any;
        const accessToken = config.access_token;
        const idEmpresa = config.id_empresa;

        const { data: contasAnuncio } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "META")
          .eq("ativa", true);

        if (!contasAnuncio || contasAnuncio.length === 0) continue;

        const idsContas = contasAnuncio.map(c => c.id_conta);

        // Buscar campanhas ATIVAS apenas
        let campanhasQuery = supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, nome, id_conta, objetivo")
          .eq("ativa", true)
          .in("id_conta", idsContas);
        
        if (campanhaIdFiltro) {
          campanhasQuery = campanhasQuery.eq("id_campanha", campanhaIdFiltro);
        }

        const { data: campanhas } = await campanhasQuery;
        if (!campanhas || campanhas.length === 0) continue;

        console.log(`📊 ${campanhas.length} campanhas ativas para empresa ${idEmpresa}`);

        // Processar em batches
        for (const campanha of campanhas) {
          if (campanhasProcessadas >= maxCampanhasPorExecucao) {
            campanhasPendentes.push({ campanha: campanha.nome, integracao: integracao.id_integracao });
            continue;
          }

          if (Date.now() - startTime > MAX_TIME_MS) {
            campanhasPendentes.push({ campanha: campanha.nome, integracao: integracao.id_integracao });
            continue;
          }

          campanhasProcessadas++;

          try {
            console.log(`\n📢 [${campanhasProcessadas}/${maxCampanhasPorExecucao}] Campanha: ${campanha.nome}`);

            // Campos mínimos necessários (removido busca por preview/adcreative/adset extras)
            const adsUrl = `https://graph.facebook.com/v18.0/${campanha.id_campanha_externo}/ads?fields=id,name,status,preview_shareable_link,adset{id,name},creative{id,name,object_story_spec{link_data{link,call_to_action{type,value{link}},picture,child_attachments{link,picture,call_to_action{type,value{link}}}}},asset_feed_spec{link_urls},image_url,video_id,thumbnail_url,url_tags,link_url}&access_token=${accessToken}&limit=50`;

            const adsResponse = await fetch(adsUrl);

            if (!adsResponse.ok) {
              const errorText = await adsResponse.text();
              console.error(`❌ Erro API Meta: ${adsResponse.status}`);
              
              let errorMessage = "Erro ao buscar criativos";
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.code === 190) {
                  errorMessage = "Access Token expirado";
                } else if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                }
              } catch { }

              resultados.push({
                integracao: integracao.id_integracao,
                campanha: campanha.nome,
                status: "error",
                error: errorMessage,
              });
              continue;
            }

            const adsData = await adsResponse.json();
            const ads = adsData.data || [];
            console.log(`  ↳ ${ads.length} anúncios encontrados`);

            // Processar todos os ads desta campanha
            for (const ad of ads) {
              const creative = ad.creative || {};
              
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
                urlMidia = creative.object_story_spec.link_data.child_attachments?.[0]?.picture || null;
              }

              const ativo = ad.status === "ACTIVE";

              // Extrair URL de forma simplificada
              const { url: urlBase, source: urlSource } = extrairURLDoCreative(creative, ad);
              
              let urlFinal = urlBase;
              
              // Adicionar url_tags se existirem
              if (urlFinal && creative.url_tags) {
                const separator = urlFinal.includes('?') ? '&' : '?';
                urlFinal = `${urlFinal}${separator}${creative.url_tags}`;
              }
              
              // Resolver placeholders
              if (urlFinal) {
                urlFinal = resolverPlaceholders(urlFinal, {
                  campaignName: campanha.nome,
                  campaignId: campanha.id_campanha_externo,
                  adId: ad.id,
                  adsetName: ad.adset?.name,
                  adsetId: ad.adset?.id,
                  adName: ad.name
                });
              }

              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: creative.id || `ad_${ad.id}`,
                id_anuncio_externo: ad.id,
                tipo: tipoCriativo,
                descricao: ad.name || creative.name || null,
                ativo: ativo,
                url_final: urlFinal,
                url_midia: urlMidia,
                url_preview: ad.preview_shareable_link || null,
              };

              const { error: upsertError } = await supabase
                .from("criativo")
                .upsert(criativoData, {
                  onConflict: "id_anuncio_externo",
                  ignoreDuplicates: false,
                });

              if (upsertError) {
                console.error(`  ⚠️ Erro ao salvar ad ${ad.id}:`, upsertError.message);
              }
            }

            resultados.push({
              integracao: integracao.id_integracao,
              campanha: campanha.nome,
              status: "success",
              criativos_encontrados: ads.length,
            });

          } catch (campErr: any) {
            console.error(`  ❌ Erro campanha ${campanha.nome}:`, campErr.message);
            resultados.push({
              integracao: integracao.id_integracao,
              campanha: campanha.nome,
              status: "error",
              error: campErr.message,
            });
          }
        }
      } catch (integErr: any) {
        console.error("Erro integração:", integErr.message);
        resultados.push({
          integracao: integracao.id_integracao,
          status: "error",
          error: integErr.message,
        });
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`\n✅ Coleta concluída em ${(duracao/1000).toFixed(1)}s - ${campanhasProcessadas} campanhas processadas`);
    
    if (campanhasPendentes.length > 0) {
      console.log(`⚠️ ${campanhasPendentes.length} campanhas pendentes para próxima execução`);
    }

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: campanhasPendentes.length > 0 ? "parcial" : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { 
        resultados, 
        campanhas_processadas: campanhasProcessadas,
        campanhas_pendentes: campanhasPendentes.length 
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Coleta concluída: ${campanhasProcessadas} campanhas processadas`,
        resultados,
        campanhas_pendentes: campanhasPendentes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro geral:", error);
    
    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error.message
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
