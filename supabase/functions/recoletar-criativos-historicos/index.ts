import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

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

// Determinar tipo de criativo
function determinarTipoCriativo(creative: any): string {
  if (!creative) return "IMAGEM";
  
  if (creative.object_story_spec?.video_data || creative.video_id) {
    return "VIDEO";
  }
  if (creative.object_story_spec?.photo_data) {
    return "IMAGEM";
  }
  if (creative.asset_feed_spec) {
    return "CARROSSEL";
  }
  return "IMAGEM";
}

// Extrair URL de mídia
function extrairUrlMidia(creative: any): string | null {
  if (!creative) return null;
  
  if (creative.thumbnail_url) return creative.thumbnail_url;
  if (creative.image_url) return creative.image_url;
  
  const photoData = creative.object_story_spec?.photo_data;
  if (photoData?.image_url) return photoData.image_url;
  
  const videoData = creative.object_story_spec?.video_data;
  if (videoData?.image_url) return videoData.image_url;
  
  return null;
}

// Extrair URL final
function extrairUrlFinal(creative: any, ad: any, adset: any): string | null {
  // 1. Tentar object_story_spec.link_data.link (mais comum)
  const linkData = creative?.object_story_spec?.link_data;
  if (linkData?.link) {
    let url = linkData.link;
    // Adicionar url_tags se existir
    if (linkData.url_tags) {
      url += (url.includes('?') ? '&' : '?') + linkData.url_tags;
    }
    return url;
  }
  
  // 2. Tentar video_data.call_to_action.value.link
  const videoData = creative?.object_story_spec?.video_data;
  if (videoData?.call_to_action?.value?.link) {
    let url = videoData.call_to_action.value.link;
    if (linkData?.url_tags) {
      url += (url.includes('?') ? '&' : '?') + linkData.url_tags;
    }
    return url;
  }
  
  // 3. Tentar photo_data.call_to_action.value.link  
  const photoData = creative?.object_story_spec?.photo_data;
  if (photoData?.call_to_action?.value?.link) {
    return photoData.call_to_action.value.link;
  }
  
  // 4. Tentar template_url_spec
  if (creative?.template_url_spec?.web?.url) {
    return creative.template_url_spec.web.url;
  }
  
  // 5. Tentar link_url do ad
  if (ad?.link_url) {
    return ad.link_url;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "recoletar-criativos-historicos";

  try {
    console.log("🔄 Iniciando recoleta de criativos HISTÓRICOS (todos os ads de todas as campanhas)...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;
    const campanhaIdFiltro = body.campanha_id;
    const diasAtras = body.dias_atras || 365;
    const dryRun = body.dry_run || false;

    console.log(`📋 Parâmetros: dias_atras=${diasAtras}, dry_run=${dryRun}`);

    // Buscar integrações Meta Ads
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: integracoesError } = await query;
    if (integracoesError) throw integracoesError;

    console.log(`📦 ${integracoes?.length || 0} integrações Meta Ads ativas encontradas`);

    const estatisticas = {
      integracoes_processadas: 0,
      campanhas_totais: 0,
      campanhas_ativas: 0,
      campanhas_inativas: 0,
      ads_encontrados: 0,
      criativos_novos: 0,
      criativos_atualizados: 0,
      erros: [] as string[],
    };

    for (const integracao of integracoes || []) {
      try {
        const config = integracao.config_json as any;
        const accessToken = config.access_token;
        const adAccountId = config.ad_account_id;
        const idEmpresa = integracao.id_empresa; // PHASE 2: usar coluna direta

        console.log(`\n🏢 Processando empresa ${idEmpresa}, ad account ${adAccountId}`);
        estatisticas.integracoes_processadas++;

        // Buscar TODAS as contas de anúncio (ativas e inativas)
        const { data: contasAnuncio, error: contasError } = await supabase
          .from("conta_anuncio")
          .select("id_conta, id_externo")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "META");

        if (contasError) {
          console.error("Erro ao buscar contas de anúncio:", contasError);
          estatisticas.erros.push(`Empresa ${idEmpresa}: ${contasError.message}`);
          continue;
        }

        if (!contasAnuncio || contasAnuncio.length === 0) {
          console.log(`⚠️ Nenhuma conta de anúncio META encontrada para empresa ${idEmpresa}`);
          continue;
        }

        // Buscar TODAS as campanhas (ativas e inativas)
        let campanhasQuery = supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, nome, id_conta, objetivo, ativa")
          .in("id_conta", contasAnuncio.map(c => c.id_conta));

        if (campanhaIdFiltro) {
          campanhasQuery = campanhasQuery.eq("id_campanha", campanhaIdFiltro);
        }

        const { data: campanhas, error: campanhasError } = await campanhasQuery;

        if (campanhasError) {
          console.error("Erro ao buscar campanhas:", campanhasError);
          estatisticas.erros.push(`Campanhas ${idEmpresa}: ${campanhasError.message}`);
          continue;
        }

        console.log(`📊 ${campanhas?.length || 0} campanhas encontradas (ativas + inativas)`);
        estatisticas.campanhas_totais += campanhas?.length || 0;
        estatisticas.campanhas_ativas += campanhas?.filter(c => c.ativa).length || 0;
        estatisticas.campanhas_inativas += campanhas?.filter(c => !c.ativa).length || 0;

        let requestCount = 0;
        const RATE_LIMIT_BATCH = 5; // Mais conservador
        const RATE_LIMIT_DELAY = 3000; // 3 segundos entre batches

        for (const campanha of campanhas || []) {
          try {
            // Rate limiting conservador
            if (requestCount > 0 && requestCount % RATE_LIMIT_BATCH === 0) {
              console.log(`⏱️ Rate limit: aguardando ${RATE_LIMIT_DELAY/1000}s após ${requestCount} requisições...`);
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
            }
            requestCount++;

            console.log(`\n📢 Campanha: ${campanha.nome} (${campanha.ativa ? '✅ ativa' : '❌ inativa'})`);

            // Buscar TODOS os ads da campanha (incluindo archived/paused/deleted)
            // Usar effective_status para pegar todos os status possíveis
            // IMPORTANTE: Incluindo preview_shareable_link para URLs de preview
            const adsUrl = `https://graph.facebook.com/v22.0/${campanha.id_campanha_externo}/ads?` +
              `fields=id,name,status,effective_status,adset_id,preview_shareable_link,creative{id,name,object_story_spec,thumbnail_url,image_url,video_id,asset_feed_spec,template_url_spec,url_tags},tracking_specs,conversion_specs` +
              `&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED","ARCHIVED","DELETED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS"]}]` +
              `&limit=500` +
              `&access_token=${accessToken}`;

            const adsResponse = await fetch(adsUrl);
            
            if (!adsResponse.ok) {
              const errorText = await adsResponse.text();
              console.log(`⚠️ Erro ao buscar ads da campanha ${campanha.nome}: ${adsResponse.status}`);
              estatisticas.erros.push(`Campanha ${campanha.nome}: API ${adsResponse.status}`);
              continue;
            }

            const adsData = await adsResponse.json();
            const ads = adsData.data || [];
            
            console.log(`   📎 ${ads.length} ads encontrados`);
            estatisticas.ads_encontrados += ads.length;

            // Processar cada ad
            for (const ad of ads) {
              try {
                const creative = ad.creative;
                if (!creative) {
                  console.log(`   ⚠️ Ad ${ad.id} sem creative`);
                  continue;
                }

                const idAnuncioExterno = ad.id; // Ad ID (usado para match com utm_content)
                const idCriativoExterno = creative.id; // Creative Asset ID
                const descricao = ad.name || creative.name || "";
                const tipo = determinarTipoCriativo(creative);
                const urlMidia = extrairUrlMidia(creative);
                const ativo = ad.effective_status === "ACTIVE";

                // Extrair URL final
                let urlFinal = extrairUrlFinal(creative, ad, null);
                
                // Resolver placeholders se tiver URL
                if (urlFinal) {
                  urlFinal = resolverPlaceholders(urlFinal, {
                    campaignName: campanha.nome,
                    campaignId: campanha.id_campanha_externo,
                    adId: ad.id,
                    adName: ad.name,
                  });
                }

                if (dryRun) {
                  console.log(`   [DRY RUN] Ad ${ad.id}: ${descricao.substring(0, 50)}... | URL: ${urlFinal ? '✓' : '✗'}`);
                  continue;
                }

                // Upsert criativo usando id_anuncio_externo como chave única
                const { data: existing } = await supabase
                  .from("criativo")
                  .select("id_criativo")
                  .eq("id_anuncio_externo", idAnuncioExterno)
                  .maybeSingle();

                if (existing) {
                  // Atualizar criativo existente
                  const { error: updateError } = await supabase
                    .from("criativo")
                    .update({
                      descricao,
                      tipo,
                      url_midia: urlMidia,
                      url_final: urlFinal,
                      url_preview: ad.preview_shareable_link || null,
                      ativo,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id_criativo", existing.id_criativo);

                  if (updateError) {
                    console.log(`   ❌ Erro ao atualizar criativo ${idAnuncioExterno}: ${updateError.message}`);
                  } else {
                    estatisticas.criativos_atualizados++;
                    console.log(`   🔄 Atualizado: ${idAnuncioExterno} | ${descricao.substring(0, 40)}...`);
                  }
                } else {
                  // Inserir novo criativo
                  const { error: insertError } = await supabase
                    .from("criativo")
                    .insert({
                      id_campanha: campanha.id_campanha,
                      id_criativo_externo: idCriativoExterno,
                      id_anuncio_externo: idAnuncioExterno,
                      descricao,
                      tipo,
                      url_midia: urlMidia,
                      url_final: urlFinal,
                      url_preview: ad.preview_shareable_link || null,
                      ativo,
                    });

                  if (insertError) {
                    // Pode ser violação de unique constraint se outro processo inseriu
                    if (!insertError.message.includes("duplicate")) {
                      console.log(`   ❌ Erro ao inserir criativo ${idAnuncioExterno}: ${insertError.message}`);
                    }
                  } else {
                    estatisticas.criativos_novos++;
                    console.log(`   ✅ Novo: ${idAnuncioExterno} | ${descricao.substring(0, 40)}... | URL: ${urlFinal ? '✓' : '✗'}`);
                  }
                }

              } catch (adError) {
                console.error(`   ❌ Erro ao processar ad ${ad.id}:`, adError);
              }
            }

            // Buscar próxima página se houver paginação
            let nextUrl = adsData.paging?.next;
            let pageCount = 1;

            while (nextUrl && pageCount < 10) { // Limite de 10 páginas por campanha
              requestCount++;
              if (requestCount % RATE_LIMIT_BATCH === 0) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              }

              const nextResponse = await fetch(nextUrl);
              if (!nextResponse.ok) break;

              const nextData = await nextResponse.json();
              const nextAds = nextData.data || [];
              
              console.log(`   📎 Página ${++pageCount}: +${nextAds.length} ads`);
              estatisticas.ads_encontrados += nextAds.length;

              // Processar ads da próxima página (mesmo código acima)
              for (const ad of nextAds) {
                try {
                  const creative = ad.creative;
                  if (!creative) continue;

                  const idAnuncioExterno = ad.id;
                  const idCriativoExterno = creative.id;
                  const descricao = ad.name || creative.name || "";
                  const tipo = determinarTipoCriativo(creative);
                  const urlMidia = extrairUrlMidia(creative);
                  const ativo = ad.effective_status === "ACTIVE";

                  let urlFinal = extrairUrlFinal(creative, ad, null);
                  if (urlFinal) {
                    urlFinal = resolverPlaceholders(urlFinal, {
                      campaignName: campanha.nome,
                      campaignId: campanha.id_campanha_externo,
                      adId: ad.id,
                      adName: ad.name,
                    });
                  }

                  if (dryRun) continue;

                  const { data: existing } = await supabase
                    .from("criativo")
                    .select("id_criativo")
                    .eq("id_anuncio_externo", idAnuncioExterno)
                    .maybeSingle();

                  if (existing) {
                    await supabase
                      .from("criativo")
                      .update({
                        descricao,
                        tipo,
                        url_midia: urlMidia,
                        url_final: urlFinal,
                        url_preview: ad.preview_shareable_link || null,
                        ativo,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id_criativo", existing.id_criativo);
                    estatisticas.criativos_atualizados++;
                  } else {
                    const { error: insertError } = await supabase
                      .from("criativo")
                      .insert({
                        id_campanha: campanha.id_campanha,
                        id_criativo_externo: idCriativoExterno,
                        id_anuncio_externo: idAnuncioExterno,
                        descricao,
                        tipo,
                        url_midia: urlMidia,
                        url_final: urlFinal,
                        url_preview: ad.preview_shareable_link || null,
                        ativo,
                      });

                    if (!insertError || !insertError.message.includes("duplicate")) {
                      if (!insertError) estatisticas.criativos_novos++;
                    }
                  }
                } catch (e) {
                  // Ignorar erros individuais
                }
              }

              nextUrl = nextData.paging?.next;
            }

          } catch (campanhaError) {
            console.error(`❌ Erro na campanha ${campanha.nome}:`, campanhaError);
            estatisticas.erros.push(`Campanha ${campanha.nome}: ${campanhaError}`);
          }
        }

      } catch (integracaoError) {
        console.error(`❌ Erro na integração:`, integracaoError);
        estatisticas.erros.push(`Integração: ${integracaoError}`);
      }
    }

    // Após coletar criativos, chamar vincular-leads-criativos
    if (!dryRun && estatisticas.criativos_novos > 0) {
      console.log(`\n🔗 Chamando vincular-leads-criativos para associar leads...`);
      
      try {
        const vinculoResponse = await supabase.functions.invoke('vincular-leads-criativos');
        
        if (vinculoResponse.error) {
          console.error(`❌ Erro ao vincular leads:`, vinculoResponse.error);
          estatisticas.erros.push(`Vincular leads: ${vinculoResponse.error.message}`);
        } else {
          console.log(`✅ Vinculação concluída:`, vinculoResponse.data);
        }
      } catch (vinculoError) {
        console.error(`❌ Erro ao chamar vincular-leads-criativos:`, vinculoError);
      }
    }

    const duracao = Date.now() - startTime;

    // Registrar execução do cronjob
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: nomeCronjob,
      status: estatisticas.erros.length > 0 ? 'parcial' : 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        ...estatisticas,
        erros: estatisticas.erros.slice(0, 20) // Limitar erros no log
      }
    });

    console.log(`\n📊 ===== RESUMO FINAL =====`);
    console.log(`   Integrações processadas: ${estatisticas.integracoes_processadas}`);
    console.log(`   Campanhas totais: ${estatisticas.campanhas_totais} (${estatisticas.campanhas_ativas} ativas, ${estatisticas.campanhas_inativas} inativas)`);
    console.log(`   Ads encontrados: ${estatisticas.ads_encontrados}`);
    console.log(`   Criativos novos: ${estatisticas.criativos_novos}`);
    console.log(`   Criativos atualizados: ${estatisticas.criativos_atualizados}`);
    console.log(`   Erros: ${estatisticas.erros.length}`);
    console.log(`   Duração: ${(duracao / 1000).toFixed(1)}s`);
    console.log(`===========================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recoleta histórica concluída: ${estatisticas.criativos_novos} novos, ${estatisticas.criativos_atualizados} atualizados`,
        estatisticas,
        duracao_segundos: (duracao / 1000).toFixed(1),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro na recoleta histórica:", error);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: nomeCronjob,
      status: 'erro',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: errorMessage
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
