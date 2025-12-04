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
  
  // Substituir placeholders comuns do Meta - campaign
  if (contexto.campaignName) {
    urlResolvida = urlResolvida.replace(/\{\{campaign\.name\}\}/gi, encodeURIComponent(contexto.campaignName));
    urlResolvida = urlResolvida.replace(/\{\{campaign_name\}\}/gi, encodeURIComponent(contexto.campaignName));
  }
  
  if (contexto.campaignId) {
    urlResolvida = urlResolvida.replace(/\{\{campaign\.id\}\}/gi, contexto.campaignId);
    urlResolvida = urlResolvida.replace(/\{\{campaign_id\}\}/gi, contexto.campaignId);
  }
  
  // Substituir placeholders - ad
  if (contexto.adId) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.id\}\}/gi, contexto.adId);
    urlResolvida = urlResolvida.replace(/\{\{ad_id\}\}/gi, contexto.adId);
  }
  
  if (contexto.adName) {
    urlResolvida = urlResolvida.replace(/\{\{ad\.name\}\}/gi, encodeURIComponent(contexto.adName));
    urlResolvida = urlResolvida.replace(/\{\{ad_name\}\}/gi, encodeURIComponent(contexto.adName));
  }
  
  // Substituir placeholders - adset
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

// Função para extrair URL do HTML do preview
function extrairURLdoPreviewHTML(html: string): string | null {
  if (!html) return null;
  
  try {
    // Procurar por href em links - padrão comum no preview HTML
    const hrefMatches = html.match(/href=["']([^"']+)["']/gi);
    if (hrefMatches) {
      for (const match of hrefMatches) {
        const url = match.replace(/href=["']/i, '').replace(/["']$/, '');
        // Decodificar entidades HTML
        const decodedUrl = url
          .replace(/&amp;/g, '&')
          .replace(/&#x3D;/g, '=')
          .replace(/&#x2F;/g, '/');
        
        // Filtrar URLs válidas (ignorar javascript:, #, facebook.com/ads, etc)
        if (decodedUrl.startsWith('http') && 
            !decodedUrl.includes('facebook.com/ads') &&
            !decodedUrl.includes('fb.com/ads')) {
          console.log(`✓ URL extraída do preview HTML: ${decodedUrl.substring(0, 100)}...`);
          return decodedUrl;
        }
      }
    }
    
    // Fallback: procurar por data-url ou data-href
    const dataUrlMatch = html.match(/data-(?:url|href)=["']([^"']+)["']/i);
    if (dataUrlMatch && dataUrlMatch[1]) {
      const url = dataUrlMatch[1].replace(/&amp;/g, '&');
      if (url.startsWith('http')) {
        return url;
      }
    }
    
    // Fallback 2: procurar por URLs em onclick ou data-link
    const onclickMatch = html.match(/(?:onclick|data-link)=["'][^"']*?(https?:\/\/[^"'\s<>]+)/i);
    if (onclickMatch && onclickMatch[1]) {
      const url = onclickMatch[1].replace(/&amp;/g, '&');
      if (!url.includes('facebook.com')) {
        return url;
      }
    }
  } catch (err) {
    console.error("Erro ao extrair URL do preview HTML:", err);
  }
  
  return null;
}

// Função para buscar preview do anúncio e extrair URL resolvida
async function buscarURLdoPreview(adId: string, accessToken: string): Promise<string | null> {
  try {
    const previewUrl = `https://graph.facebook.com/v18.0/${adId}/previews?ad_format=MOBILE_FEED_STANDARD&access_token=${accessToken}`;
    const response = await fetch(previewUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ Preview erro para ad ${adId}: ${response.status} - ${errorText.substring(0, 200)}`);
      return null;
    }
    
    const data = await response.json();
    
    console.log(`📦 Preview response para ad ${adId}: has_data=${!!data.data}, data_length=${data.data?.length || 0}, has_body=${!!data.data?.[0]?.body}, body_length=${data.data?.[0]?.body?.length || 0}`);
    
    if (data.data && data.data.length > 0 && data.data[0].body) {
      const html = data.data[0].body;
      console.log(`📄 Preview HTML amostra (primeiros 500 chars): ${html.substring(0, 500).replace(/\n/g, ' ')}`);
      
      const extractedUrl = extrairURLdoPreviewHTML(html);
      if (extractedUrl) {
        console.log(`✅ URL extraída do preview HTML: ${extractedUrl.substring(0, 150)}`);
      } else {
        console.log(`⚠️ Nenhuma URL válida encontrada no preview HTML`);
      }
      return extractedUrl;
    } else {
      console.log(`⚠️ Preview retornou estrutura inesperada para ad ${adId}`);
    }
  } catch (err) {
    console.error(`❌ Erro ao buscar preview do ad ${adId}:`, err);
  }
  
  return null;
}

// NOVA: Função para buscar URL via endpoint /adcreatives com campos adicionais
async function buscarURLdoAdCreative(creativeId: string, accessToken: string): Promise<{ url: string | null; source: string }> {
  try {
    // Campos adicionais para buscar URL (website_url não existe para AdCreative)
    const creativeUrl = `https://graph.facebook.com/v18.0/${creativeId}?fields=id,name,object_story_spec,link_url,link_destination_display_url,effective_object_story_id,page_welcome_message,template_url,template_url_spec,degrees_of_freedom_spec&access_token=${accessToken}`;
    
    const response = await fetch(creativeUrl);
    if (!response.ok) {
      console.log(`⚠️ AdCreative endpoint erro: ${response.status}`);
      return { url: null, source: "" };
    }
    
    const data = await response.json();
    console.log(`📋 AdCreative campos adicionais: ${JSON.stringify({
      has_link_url: !!data.link_url,
      has_link_destination: !!data.link_destination_display_url,
      has_template_url: !!data.template_url,
      has_template_url_spec: !!data.template_url_spec,
      has_degrees_of_freedom: !!data.degrees_of_freedom_spec
    })}`);
    
    // Prioridade de URLs encontradas
    if (data.link_url) {
      console.log(`✓ URL encontrada em link_url: ${data.link_url}`);
      return { url: data.link_url, source: "adcreative_link_url" };
    }
    
    if (data.link_destination_display_url) {
      console.log(`✓ URL encontrada em link_destination_display_url: ${data.link_destination_display_url}`);
      return { url: data.link_destination_display_url, source: "adcreative_link_destination" };
    }
    
    if (data.template_url) {
      console.log(`✓ URL encontrada em template_url: ${data.template_url}`);
      return { url: data.template_url, source: "adcreative_template_url" };
    }
    
    // template_url_spec pode ter URL
    if (data.template_url_spec?.web?.url) {
      console.log(`✓ URL encontrada em template_url_spec.web.url: ${data.template_url_spec.web.url}`);
      return { url: data.template_url_spec.web.url, source: "template_url_spec" };
    }
    
    // degrees_of_freedom_spec pode ter URLs
    if (data.degrees_of_freedom_spec?.creative_features_spec?.website_url?.url_value) {
      const url = data.degrees_of_freedom_spec.creative_features_spec.website_url.url_value;
      console.log(`✓ URL encontrada em degrees_of_freedom_spec: ${url}`);
      return { url, source: "degrees_of_freedom_spec" };
    }
    
  } catch (err) {
    console.error(`❌ Erro ao buscar AdCreative ${creativeId}:`, err);
  }
  
  return { url: null, source: "" };
}

// NOVA: Função para buscar URL do AdSet (para campanhas de Lead Gen)
async function buscarURLdoAdSet(adsetId: string, accessToken: string): Promise<{ url: string | null; source: string }> {
  try {
    const adsetUrl = `https://graph.facebook.com/v18.0/${adsetId}?fields=id,name,promoted_object,destination_type,optimization_goal&access_token=${accessToken}`;
    
    const response = await fetch(adsetUrl);
    if (!response.ok) {
      console.log(`⚠️ AdSet endpoint erro: ${response.status}`);
      return { url: null, source: "" };
    }
    
    const data = await response.json();
    console.log(`📋 AdSet dados: ${JSON.stringify({
      destination_type: data.destination_type,
      optimization_goal: data.optimization_goal,
      has_promoted_object: !!data.promoted_object,
      promoted_object_keys: data.promoted_object ? Object.keys(data.promoted_object) : []
    })}`);
    
    // promoted_object pode ter page_id, pixel_id, application_id, etc
    // Para campanhas de website, pode ter custom_event_str ou object_store_url
    if (data.promoted_object?.object_store_url) {
      console.log(`✓ URL encontrada em promoted_object.object_store_url: ${data.promoted_object.object_store_url}`);
      return { url: data.promoted_object.object_store_url, source: "adset_promoted_object" };
    }
    
    // Tentar buscar pixel rule que pode ter URL
    if (data.promoted_object?.pixel_rule) {
      try {
        const rule = typeof data.promoted_object.pixel_rule === 'string' 
          ? JSON.parse(data.promoted_object.pixel_rule) 
          : data.promoted_object.pixel_rule;
        
        // Extrair URLs de regras de pixel
        const urlFromRule = extrairURLdePixelRule(rule);
        if (urlFromRule) {
          console.log(`✓ URL extraída de pixel_rule: ${urlFromRule}`);
          return { url: urlFromRule, source: "adset_pixel_rule" };
        }
      } catch (e) {
        console.log(`⚠️ Erro ao parsear pixel_rule`);
      }
    }
    
  } catch (err) {
    console.error(`❌ Erro ao buscar AdSet ${adsetId}:`, err);
  }
  
  return { url: null, source: "" };
}

// Helper: extrair URL de regras de pixel
function extrairURLdePixelRule(rule: any): string | null {
  if (!rule) return null;
  
  // Regras podem ter formato: {url: {contains: "example.com"}}
  if (rule.url?.contains) {
    return `https://${rule.url.contains}`;
  }
  
  if (rule.url?.eq) {
    return rule.url.eq;
  }
  
  // Ou formato aninhado com "and"/"or"
  if (rule.and && Array.isArray(rule.and)) {
    for (const r of rule.and) {
      const url = extrairURLdePixelRule(r);
      if (url) return url;
    }
  }
  
  if (rule.or && Array.isArray(rule.or)) {
    for (const r of rule.or) {
      const url = extrairURLdePixelRule(r);
      if (url) return url;
    }
  }
  
  return null;
}

// NOVA: Função para extrair domínio de url_tags quando não há URL base
function extrairURLdeUrlTags(urlTags: string): string | null {
  if (!urlTags) return null;
  
  // url_tags pode conter URL completa em alguns casos
  // Ex: "url=https://example.com&utm_source=facebook"
  const urlMatch = urlTags.match(/(?:^|&)url=([^&]+)/i);
  if (urlMatch && urlMatch[1]) {
    const decodedUrl = decodeURIComponent(urlMatch[1]);
    if (decodedUrl.startsWith('http')) {
      console.log(`✓ URL completa encontrada em url_tags: ${decodedUrl}`);
      return decodedUrl;
    }
  }
  
  // Verificar se há link= no url_tags
  const linkMatch = urlTags.match(/(?:^|&)link=([^&]+)/i);
  if (linkMatch && linkMatch[1]) {
    const decodedUrl = decodeURIComponent(linkMatch[1]);
    if (decodedUrl.startsWith('http')) {
      console.log(`✓ URL encontrada em url_tags (link): ${decodedUrl}`);
      return decodedUrl;
    }
  }
  
  return null;
}

// NOVA: Verificar se é anúncio de conversão/lead que deveria ter URL
function isConversionOrLeadAd(campaignObjective: string | null, adsetOptimization: string | null): boolean {
  const conversionObjectives = [
    'LEAD_GENERATION',
    'CONVERSIONS',
    'OUTCOME_LEADS',
    'OUTCOME_SALES',
    'OUTCOME_TRAFFIC',
    'LINK_CLICKS',
    'WEBSITE_CONVERSIONS',
    'PRODUCT_CATALOG_SALES'
  ];
  
  const conversionOptimizations = [
    'LEAD_GENERATION',
    'OFFSITE_CONVERSIONS',
    'LANDING_PAGE_VIEWS',
    'LINK_CLICKS',
    'VALUE'
  ];
  
  const isConversionObjective = !!(campaignObjective && conversionObjectives.some(obj => 
    campaignObjective.toUpperCase().includes(obj)
  ));
  
  const isConversionOptimization = !!(adsetOptimization && conversionOptimizations.some(opt =>
    adsetOptimization.toUpperCase().includes(opt)
  ));
  
  return isConversionObjective || isConversionOptimization;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "coletar-criativos-meta";

  try {
    console.log("Iniciando coleta de criativos Meta Ads (v3.0 - captura avançada de URLs)...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

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

        const { data: campanhas, error: campanhasError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, nome, id_conta, objetivo")
          .eq("ativa", true)
          .in("id_conta", idsContas);

        if (campanhasError) {
          console.error("Erro ao buscar campanhas:", campanhasError);
          continue;
        }

        // Buscar informações atualizadas das campanhas da API
        const campaignIds = campanhas?.map(c => c.id_campanha_externo).join(",") || "";
        const campanhaObjectives: Record<string, string> = {};
        
        if (campaignIds) {
          const campaignsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective&ids=${campaignIds}&access_token=${accessToken}`;
          
          try {
            const campaignsResponse = await fetch(campaignsUrl);
            if (campaignsResponse.ok) {
              const campaignsData = await campaignsResponse.json();
              
              for (const campData of campaignsData.data || []) {
                campanhaObjectives[campData.id] = campData.objective;
                
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
                  
                  console.log(`Campanha ${campData.name} atualizada (objetivo: ${campData.objective})`);
                }
              }
            }
          } catch (err) {
            console.error("Erro ao atualizar campanhas:", err);
          }
        }

        let requestCount = 0;
        const MAX_REQUESTS_PER_BATCH = 10;
        
        for (const campanha of campanhas || []) {
          try {
            if (requestCount > 0 && requestCount % MAX_REQUESTS_PER_BATCH === 0) {
              console.log(`⏱️ Rate limit: aguardando 2s após ${requestCount} requisições...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            requestCount++;
            
            const campaignObjective = campanhaObjectives[campanha.id_campanha_externo] || campanha.objetivo;
            console.log(`\n📢 Buscando criativos da campanha ${campanha.nome} (objetivo: ${campaignObjective})`);

            // Campos expandidos para capturar mais informações de URL (website_url removido - não existe para AdCreative)
            const adsUrl = `https://graph.facebook.com/v18.0/${campanha.id_campanha_externo}/ads?fields=id,name,status,preview_shareable_link,adset{id,name,destination_type,optimization_goal,promoted_object},creative{id,name,object_story_spec{link_data{link,call_to_action{type,value{link,app_link}},picture,image_hash,child_attachments{link,picture,call_to_action{type,value{link}}}}},asset_feed_spec{link_urls},effective_object_story_id,image_url,image_hash,video_id,thumbnail_url,url_tags,link_url},effective_object_story_id,url_tags,tracking_specs,insights.date_preset(today){impressions,clicks,spend,actions}&access_token=${accessToken}`;

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
                  } else if (errorData.error.code === 200 && errorData.error.message.includes("API access blocked")) {
                    errorMessage = "API Access Blocked: Verifique permissões do System User Token.";
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

            for (const ad of adsData.data || []) {
              const creative = ad.creative;
              const adsetName = ad.adset?.name || null;
              const adsetId = ad.adset?.id || null;
              const adsetOptimization = ad.adset?.optimization_goal || null;
              const adsetDestinationType = ad.adset?.destination_type || null;
              
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

              const ativo = ad.status === "ACTIVE";

              let urlFinal = null;
              let urlSource = "não encontrada";
              let needsManualConfig = false;
              
              try {
                console.log(`\n=== Processando ad ${ad.id} / criativo ${creative.id} (${ad.name}) ===`);
                
                const contextoPlaceholders = {
                  campaignName: campanha.nome,
                  campaignId: campanha.id_campanha_externo,
                  adId: ad.id,
                  adsetName: adsetName,
                  adsetId: adsetId,
                  adName: ad.name
                };
                
                console.log(`📋 Estrutura creative: ${JSON.stringify({
                  has_object_story_spec: !!creative.object_story_spec,
                  has_link_data: !!creative.object_story_spec?.link_data,
                  link: creative.object_story_spec?.link_data?.link || null,
                  cta_type: creative.object_story_spec?.link_data?.call_to_action?.type || null,
                  has_asset_feed_spec: !!creative.asset_feed_spec,
                  creative_link_url: creative.link_url || null,
                  adset_destination_type: adsetDestinationType,
                  adset_optimization: adsetOptimization,
                  preview_shareable_link: ad.preview_shareable_link || null
                })}`);
                
                // === FASE 1: Tentar extrair URL do endpoint /previews ===
                console.log(`🔍 Fase 1: Buscando URL via /previews endpoint...`);
                const previewUrl = await buscarURLdoPreview(ad.id, accessToken);
                if (previewUrl) {
                  urlFinal = previewUrl;
                  urlSource = "preview_endpoint";
                  console.log(`✓ URL obtida via preview (placeholders resolvidos): ${urlFinal.substring(0, 100)}...`);
                }
                
                // === FASE 2: Buscar via endpoint /adcreatives com campos adicionais ===
                if (!urlFinal) {
                  console.log(`🔍 Fase 2: Buscando URL via /adcreatives endpoint...`);
                  const adCreativeResult = await buscarURLdoAdCreative(creative.id, accessToken);
                  if (adCreativeResult.url) {
                    urlFinal = adCreativeResult.url;
                    urlSource = adCreativeResult.source;
                  }
                }
                
                // === FASE 3: Buscar via AdSet (para Lead Gen) ===
                if (!urlFinal && adsetId) {
                  console.log(`🔍 Fase 3: Buscando URL via AdSet...`);
                  const adSetResult = await buscarURLdoAdSet(adsetId, accessToken);
                  if (adSetResult.url) {
                    urlFinal = adSetResult.url;
                    urlSource = adSetResult.source;
                  }
                }
                
                // === FASE 4: Fallback para campos tradicionais ===
                if (!urlFinal) {
                  console.log(`🔍 Fase 4: Buscando URL via campos tradicionais...`);
                  
                  // 4a: creative.link_url ou creative.website_url (novos campos)
                  if (creative.link_url) {
                    urlFinal = creative.link_url;
                    urlSource = "creative_link_url";
                    console.log(`✓ URL base (creative.link_url): ${urlFinal}`);
                  } else if (creative.website_url) {
                    urlFinal = creative.website_url;
                    urlSource = "creative_website_url";
                    console.log(`✓ URL base (creative.website_url): ${urlFinal}`);
                  }
                  
                  // 4b: object_story_spec.link_data.link
                  if (!urlFinal && creative.object_story_spec?.link_data?.link) {
                    urlFinal = creative.object_story_spec.link_data.link;
                    urlSource = "link_data.link";
                    console.log(`✓ URL base (link_data.link): ${urlFinal}`);
                  }
                  
                  // 4c: call_to_action.value.link
                  if (!urlFinal && creative.object_story_spec?.link_data?.call_to_action?.value?.link) {
                    urlFinal = creative.object_story_spec.link_data.call_to_action.value.link;
                    urlSource = "cta_value.link";
                    console.log(`✓ URL base (CTA value.link): ${urlFinal}`);
                  }
                  
                  // 4d: asset_feed_spec.link_urls
                  if (!urlFinal && creative.asset_feed_spec?.link_urls?.length > 0) {
                    urlFinal = creative.asset_feed_spec.link_urls[0].website_url || creative.asset_feed_spec.link_urls[0];
                    urlSource = "asset_feed_spec";
                    console.log(`✓ URL base (asset_feed_spec.link_urls): ${urlFinal}`);
                  }
                  
                  // 4e: child_attachments do carrossel
                  if (!urlFinal && creative.object_story_spec?.link_data?.child_attachments?.length > 0) {
                    const firstAttachment = creative.object_story_spec.link_data.child_attachments[0];
                    if (firstAttachment.link) {
                      urlFinal = firstAttachment.link;
                      urlSource = "carousel_link";
                      console.log(`✓ URL base (carrossel): ${urlFinal}`);
                    } else if (firstAttachment.call_to_action?.value?.link) {
                      urlFinal = firstAttachment.call_to_action.value.link;
                      urlSource = "carousel_cta";
                      console.log(`✓ URL base (carrossel CTA): ${urlFinal}`);
                    }
                  }
                  
                  // 4f: tracking_specs
                  if (!urlFinal && ad.tracking_specs && ad.tracking_specs.length > 0) {
                    for (const trackingSpec of ad.tracking_specs) {
                      // tracking_specs pode ter URLs em diferentes formatos
                      if (trackingSpec.url && trackingSpec.url.includes('http')) {
                        urlFinal = trackingSpec.url;
                        urlSource = "tracking_specs_url";
                        console.log(`✓ URL extraída de tracking_specs.url: ${urlFinal}`);
                        break;
                      }
                      // Ou pode ter em custom_data
                      if (trackingSpec.custom_data && typeof trackingSpec.custom_data === 'object') {
                        for (const [key, value] of Object.entries(trackingSpec.custom_data)) {
                          if (typeof value === 'string' && value.startsWith('http')) {
                            urlFinal = value;
                            urlSource = "tracking_specs_custom_data";
                            console.log(`✓ URL extraída de tracking_specs.custom_data: ${urlFinal}`);
                            break;
                          }
                        }
                      }
                    }
                  }
                }
                
                // === FASE 5: Tentar extrair URL de url_tags ===
                if (!urlFinal) {
                  console.log(`🔍 Fase 5: Tentando extrair URL de url_tags...`);
                  
                  const allUrlTags = [creative.url_tags, ad.url_tags].filter(Boolean).join('&');
                  if (allUrlTags) {
                    const urlFromTags = extrairURLdeUrlTags(allUrlTags);
                    if (urlFromTags) {
                      urlFinal = urlFromTags;
                      urlSource = "url_tags_extracted";
                    }
                  }
                }
                
                // === ADICIONAR UTM TAGS SE TIVER URL BASE ===
                if (urlFinal && !["preview_endpoint", "url_tags_extracted"].includes(urlSource)) {
                  const allUrlTags = [];
                  
                  if (creative.url_tags) {
                    console.log(`✓ URL tags no criativo: ${creative.url_tags}`);
                    allUrlTags.push(creative.url_tags);
                  }
                  
                  if (ad.url_tags) {
                    console.log(`✓ URL tags no ad: ${ad.url_tags}`);
                    allUrlTags.push(ad.url_tags);
                  }
                  
                  if (allUrlTags.length > 0) {
                    const combinedTags = allUrlTags.join('&');
                    const separator = urlFinal.includes('?') ? '&' : '?';
                    urlFinal = `${urlFinal}${separator}${combinedTags}`;
                  }
                  
                  // Resolver placeholders dinâmicos do Meta
                  urlFinal = resolverPlaceholders(urlFinal, contextoPlaceholders);
                  console.log(`✓ URL final após resolver placeholders: ${urlFinal.substring(0, 150)}...`);
                }
                
                console.log(`📌 Fonte da URL: ${urlSource}`);
                
                // Verificar se ainda tem placeholders não resolvidos
                if (urlFinal && urlFinal.includes('{{')) {
                  console.log(`⚠️ URL ainda contém placeholders não resolvidos - marcando para configuração manual`);
                  needsManualConfig = true;
                }
                
                // === FASE 6: AJUSTE DE DETECÇÃO DE ENGAJAMENTO (baseado em objetivo) ===
                if (!urlFinal) {
                  const isConversionAd = isConversionOrLeadAd(campaignObjective, adsetOptimization);
                  
                  if (isConversionAd) {
                    // Anúncio de conversão/lead SEM URL - deve ser reportado
                    console.log(`⚠️ ALERTA: Anúncio de conversão/lead sem URL detectada! Objetivo: ${campaignObjective}, Optimization: ${adsetOptimization}`);
                    needsManualConfig = true;
                  } else {
                    // Verificar por tracking_specs se é engajamento
                    const isPostEngagement = ad.tracking_specs?.some((spec: any) => 
                      spec['action.type']?.includes('post_engagement') || 
                      spec['action.type']?.includes('post_interaction_gross') ||
                      spec['action.type']?.includes('video_view')
                    );
                    
                    if (isPostEngagement) {
                      console.log(`ℹ️ Anúncio de engajamento/vídeo sem URL externa - OK`);
                    } else {
                      console.log(`⚠️ URL não encontrada para ad ${ad.id}`);
                      needsManualConfig = true;
                    }
                  }
                }
              } catch (urlErr) {
                console.error(`❌ Erro ao extrair URL do ad ${ad.id}:`, urlErr);
              }

              const criativoData = {
                id_campanha: campanha.id_campanha,
                id_criativo_externo: creative.id,
                id_anuncio_externo: ad.id,
                tipo: tipoCriativo,
                descricao: ad.name || creative.name || null,
                ativo: ativo,
                url_final: urlFinal,
                url_midia: urlMidia,
                url_preview: ad.preview_shareable_link || null,
              };

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
                const statusIcon = needsManualConfig ? "⚠️" : "✅";
                console.log(`${statusIcon} Criativo salvo: ${ad.name || ad.id} | Ad ID: ${ad.id} | URL: ${urlSource} | R$ ${investimento.toFixed(2)}${needsManualConfig ? " [NECESSITA CONFIG MANUAL]" : ""}`);
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

    console.log("\n✅ Coleta de criativos Meta Ads concluída (v3.0)");

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
        message: "Coleta de criativos concluída (v3.0 - captura avançada)",
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    
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
