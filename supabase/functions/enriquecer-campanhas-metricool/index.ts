import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METRICOOL_API_BASE = "https://app.metricool.com/api";

interface MetricoolConfig {
  user_token: string;
  user_id: string;
  blog_id: string;
  id_empresa: string;
}

interface AdsCampaignData {
  campaignId: string;
  campaignName: string;
  data: string;
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  plataforma: 'GOOGLE' | 'META';
}

interface AdsCreativeData {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adsetId?: string;
  adsetName?: string;
  data: string;
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  plataforma: 'GOOGLE' | 'META';
}

// Função para buscar dados de Ads de uma plataforma específica
async function fetchAdsPlatformData(
  config: MetricoolConfig,
  plataforma: 'google' | 'facebook',
  initDate: string,
  endDate: string,
  headers: Record<string, string>
): Promise<AdsCampaignData[]> {
  const campanhas: AdsCampaignData[] = [];
  const plataformaNome = plataforma === 'google' ? 'GOOGLE' : 'META';
  
  console.log(`  🔍 Buscando dados ${plataformaNome} Ads do Metricool...`);
  
  // Tentar endpoints diferentes
  const endpoints = [
    `${METRICOOL_API_BASE}/ads/${plataforma}/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`,
    `${METRICOOL_API_BASE}/ads/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}&network=${plataforma}`,
  ];
  
  let adsData: any = null;
  
  for (const url of endpoints) {
    try {
      console.log(`    🔗 Tentando: ${url}`);
      const resp = await fetch(url, { headers });
      
      if (resp.ok) {
        adsData = await resp.json();
        console.log(`    ✅ Dados recebidos: ${JSON.stringify(adsData).substring(0, 300)}...`);
        break;
      } else {
        console.log(`    ⚠️ Endpoint falhou (${resp.status})`);
      }
    } catch (err) {
      console.log(`    ⚠️ Erro ao acessar endpoint:`, err);
    }
  }
  
  if (!adsData) {
    console.log(`  ⚠️ Nenhum endpoint de ${plataformaNome} Ads funcionou`);
    return campanhas;
  }
  
  // Processar campanhas
  const campaigns = Array.isArray(adsData) ? adsData : adsData.campaigns || adsData.data || [];
  
  for (const campaign of campaigns) {
    const stats = campaign.stats || campaign.metrics || campaign.daily || [campaign];
    
    for (const stat of (Array.isArray(stats) ? stats : [stats])) {
      let dataStr = stat.date || stat.day || stat.datetime || campaign.date;
      
      // Converter YYYYMMDD para YYYY-MM-DD
      if (dataStr && dataStr.length === 8 && !dataStr.includes('-')) {
        dataStr = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
      }
      
      // Converter timestamp para YYYY-MM-DD
      if (dataStr && /^\d{13}$/.test(String(dataStr))) {
        dataStr = new Date(parseInt(dataStr)).toISOString().split('T')[0];
      }
      
      if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        continue;
      }

      campanhas.push({
        campaignId: campaign.id || campaign.campaignId || campaign.campaign_id || '',
        campaignName: campaign.name || campaign.campaignName || campaign.campaign_name || '',
        data: dataStr,
        impressions: parseInt(stat.impressions || stat.reach || '0'),
        clicks: parseInt(stat.clicks || stat.link_clicks || '0'),
        spent: parseFloat(stat.spent || stat.cost || stat.spend || '0'),
        conversions: parseInt(stat.conversions || stat.results || stat.actions || '0'),
        conversionValue: parseFloat(stat.conversionValue || stat.conversion_value || stat.revenue || stat.purchase_value || '0'),
        cpc: parseFloat(stat.cpc || '0'),
        cpm: parseFloat(stat.cpm || '0'),
        ctr: parseFloat(stat.ctr || '0'),
        roas: parseFloat(stat.roas || '0'),
        plataforma: plataformaNome,
      });
    }
  }
  
  console.log(`  📊 ${campanhas.length} registros de ${plataformaNome} encontrados`);
  return campanhas;
}

// Função para buscar dados a nível de anúncios/criativos
async function fetchAdsCreativeData(
  config: MetricoolConfig,
  plataforma: 'google' | 'facebook',
  initDate: string,
  endDate: string,
  headers: Record<string, string>
): Promise<AdsCreativeData[]> {
  const criativos: AdsCreativeData[] = [];
  const plataformaNome = plataforma === 'google' ? 'GOOGLE' : 'META';
  
  console.log(`  🔍 Buscando dados de ANÚNCIOS/CRIATIVOS ${plataformaNome} do Metricool...`);
  
  // Tentar múltiplos endpoints para dados de anúncios
  const endpoints = [
    `${METRICOOL_API_BASE}/ads/${plataforma}/ads?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`,
    `${METRICOOL_API_BASE}/ads/ads?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}&network=${plataforma}`,
    `${METRICOOL_API_BASE}/ads/${plataforma}/adsets?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`,
  ];
  
  let adsData: any = null;
  
  for (const url of endpoints) {
    try {
      console.log(`    🔗 Tentando: ${url}`);
      const resp = await fetch(url, { headers });
      
      if (resp.ok) {
        const responseText = await resp.text();
        console.log(`    📋 Resposta raw (primeiros 500 chars): ${responseText.substring(0, 500)}`);
        
        try {
          adsData = JSON.parse(responseText);
          console.log(`    ✅ Dados de anúncios recebidos!`);
          break;
        } catch (parseError) {
          console.log(`    ⚠️ Erro ao parsear JSON:`, parseError);
        }
      } else {
        const errorText = await resp.text();
        console.log(`    ⚠️ Endpoint falhou (${resp.status}): ${errorText.substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`    ⚠️ Erro ao acessar endpoint:`, err);
    }
  }
  
  if (!adsData) {
    console.log(`  ⚠️ Nenhum endpoint de anúncios ${plataformaNome} funcionou`);
    return criativos;
  }
  
  // Processar anúncios - pode vir em múltiplos formatos
  const ads = Array.isArray(adsData) ? adsData : adsData.ads || adsData.adsets || adsData.data || [];
  console.log(`  📊 Total de ${ads.length} anúncios/adsets encontrados`);
  
  for (const ad of ads) {
    const stats = ad.stats || ad.metrics || ad.daily || ad.data || [ad];
    const adId = ad.id || ad.adId || ad.ad_id || ad.adset_id || '';
    const adName = ad.name || ad.adName || ad.ad_name || ad.title || '';
    const campaignId = ad.campaignId || ad.campaign_id || ad.campaign?.id || '';
    const campaignName = ad.campaignName || ad.campaign_name || ad.campaign?.name || '';
    const adsetId = ad.adsetId || ad.adset_id || '';
    const adsetName = ad.adsetName || ad.adset_name || '';
    
    for (const stat of (Array.isArray(stats) ? stats : [stats])) {
      let dataStr = stat.date || stat.day || stat.datetime || ad.date;
      
      // Converter YYYYMMDD para YYYY-MM-DD
      if (dataStr && dataStr.length === 8 && !dataStr.includes('-')) {
        dataStr = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
      }
      
      // Converter timestamp para YYYY-MM-DD
      if (dataStr && /^\d{13}$/.test(String(dataStr))) {
        dataStr = new Date(parseInt(dataStr)).toISOString().split('T')[0];
      }
      
      if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        continue;
      }

      criativos.push({
        adId,
        adName,
        campaignId,
        campaignName,
        adsetId,
        adsetName,
        data: dataStr,
        impressions: parseInt(stat.impressions || stat.reach || '0'),
        clicks: parseInt(stat.clicks || stat.link_clicks || '0'),
        spent: parseFloat(stat.spent || stat.cost || stat.spend || '0'),
        conversions: parseInt(stat.conversions || stat.results || stat.actions || '0'),
        conversionValue: parseFloat(stat.conversionValue || stat.conversion_value || stat.revenue || stat.purchase_value || '0'),
        cpc: parseFloat(stat.cpc || '0'),
        cpm: parseFloat(stat.cpm || '0'),
        ctr: parseFloat(stat.ctr || '0'),
        roas: parseFloat(stat.roas || '0'),
        plataforma: plataformaNome,
      });
    }
  }
  
  console.log(`  📊 ${criativos.length} registros de anúncios/criativos ${plataformaNome} encontrados`);
  return criativos;
}

// Função para buscar métricas timeline agregadas
async function fetchTimelineMetrics(
  config: MetricoolConfig,
  plataforma: 'google' | 'facebook',
  initDate: string,
  endDate: string,
  headers: Record<string, string>
): Promise<Map<string, Record<string, number>>> {
  const metricasPorData = new Map<string, Record<string, number>>();
  const prefixo = plataforma === 'google' ? 'googleAds' : 'facebookAds';
  
  const metricsToFetch = [
    { nome: `${prefixo}Conversions`, campo: 'conversions' },
    { nome: `${prefixo}ConversionValue`, campo: 'conversionValue' },
    { nome: `${prefixo}Spent`, campo: 'spent' },
    { nome: `${prefixo}Clicks`, campo: 'clicks' },
    { nome: `${prefixo}Impressions`, campo: 'impressions' },
    { nome: `${prefixo}Results`, campo: 'results' },
  ];

  for (const metrica of metricsToFetch) {
    try {
      const url = `${METRICOOL_API_BASE}/stats/timeline/${metrica.nome}?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
      const resp = await fetch(url, { headers });
      
      if (resp.ok) {
        const data = await resp.json();
        console.log(`    ✅ ${metrica.nome}: ${data?.length || 0} registros`);
        
        for (const item of (data || [])) {
          let dataStr: string | null = null;
          let valor: number = 0;
          
          if (Array.isArray(item) && item.length >= 2) {
            const primeiroStr = String(item[0]);
            const segundoStr = String(item[1]);
            const primeiroNum = parseFloat(primeiroStr);
            
            if (primeiroStr.length >= 13 && primeiroNum > 1000000000000) {
              dataStr = new Date(primeiroNum).toISOString().split('T')[0];
              valor = parseFloat(segundoStr) || 0;
            } else if (primeiroStr.length === 8 && /^\d{8}$/.test(primeiroStr)) {
              dataStr = `${primeiroStr.substring(0, 4)}-${primeiroStr.substring(4, 6)}-${primeiroStr.substring(6, 8)}`;
              valor = parseFloat(segundoStr) || 0;
            }
          }
          
          if (dataStr) {
            if (!metricasPorData.has(dataStr)) {
              metricasPorData.set(dataStr, {
                conversions: 0,
                conversionValue: 0,
                spent: 0,
                clicks: 0,
                impressions: 0,
                results: 0,
              });
            }
            metricasPorData.get(dataStr)![metrica.campo] = valor;
          }
        }
      }
    } catch (err) {
      console.log(`    ⚠️ Erro ao buscar ${metrica.nome}:`, err);
    }
  }
  
  return metricasPorData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("🚀 Iniciando enriquecimento de campanhas via Metricool (Google + Meta)...");

    // Buscar todas as integrações Metricool ativas
    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("⚠️ Nenhuma integração Metricool configurada");
      return new Response(JSON.stringify({ 
        message: "Nenhuma integração Metricool configurada",
        processadas: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as MetricoolConfig;
      const empresaId = config.id_empresa;

      console.log(`\n📊 Processando empresa ${empresaId}...`);

      try {
        // Calcular período (últimos 30 dias)
        const hoje = new Date();
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        
        const initDate = trintaDiasAtras.toISOString().split('T')[0].replace(/-/g, '');
        const endDate = hoje.toISOString().split('T')[0].replace(/-/g, '');
        
        console.log(`  📅 Período: ${initDate} a ${endDate}`);

        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        const resultadoEmpresa: any = {
          empresa_id: empresaId,
          google: { campanhas: 0, metricas_atualizadas: 0, criativos: 0 },
          meta: { campanhas: 0, metricas_atualizadas: 0, criativos: 0 },
          status: "success",
        };

        // ============ GOOGLE ADS ============
        console.log("\n  === GOOGLE ADS ===");
        
        const campanhasGoogle = await fetchAdsPlatformData(config, 'google', initDate, endDate, headers);
        resultadoEmpresa.google.campanhas = campanhasGoogle.length;
        
        if (campanhasGoogle.length > 0) {
          // Buscar campanhas locais do Google
          const { data: contasGoogle } = await supabase
            .from('conta_anuncio')
            .select('id_conta')
            .eq('id_empresa', empresaId)
            .eq('plataforma', 'GOOGLE');

          if (contasGoogle && contasGoogle.length > 0) {
            const { data: campanhasLocaisGoogle } = await supabase
              .from('campanha')
              .select('id_campanha, id_campanha_externo, nome')
              .in('id_conta', contasGoogle.map(c => c.id_conta));

            if (campanhasLocaisGoogle) {
              for (const metricoolCamp of campanhasGoogle) {
                const campanhaLocal = campanhasLocaisGoogle.find(c => 
                  c.id_campanha_externo === metricoolCamp.campaignId ||
                  c.nome?.toLowerCase().trim() === metricoolCamp.campaignName?.toLowerCase().trim()
                );

                if (campanhaLocal && (metricoolCamp.conversions > 0 || metricoolCamp.conversionValue > 0)) {
                  const { error } = await supabase
                    .from('campanha_metricas_dia')
                    .upsert({
                      id_campanha: campanhaLocal.id_campanha,
                      data: metricoolCamp.data,
                      impressoes: metricoolCamp.impressions,
                      cliques: metricoolCamp.clicks,
                      verba_investida: metricoolCamp.spent,
                      leads: metricoolCamp.conversions,
                      conversoes: metricoolCamp.conversions,
                      valor_conversao: metricoolCamp.conversionValue,
                      fonte_conversoes: 'METRICOOL_GOOGLE',
                    }, {
                      onConflict: 'id_campanha,data',
                    });

                  if (!error) {
                    resultadoEmpresa.google.metricas_atualizadas++;
                    console.log(`    ✅ Google: ${metricoolCamp.campaignName} - ${metricoolCamp.data}: ${metricoolCamp.conversions} conversões`);
                  }
                }
              }
            }
          }
        } else {
          // Tentar métricas agregadas para Google
          console.log("  🔄 Tentando métricas timeline de Google Ads...");
          const metricasGoogle = await fetchTimelineMetrics(config, 'google', initDate, endDate, headers);
          
          if (metricasGoogle.size > 0) {
            console.log(`  📊 ${metricasGoogle.size} dias de métricas agregadas Google`);
            // Salvar como métricas agregadas na empresa
            for (const [data, metricas] of metricasGoogle) {
              if (metricas.conversions > 0 || metricas.conversionValue > 0) {
                resultadoEmpresa.google.metricas_atualizadas++;
              }
            }
          }
        }

        // ============ META ADS (Facebook/Instagram) ============
        console.log("\n  === META ADS ===");
        
        const campanhasMeta = await fetchAdsPlatformData(config, 'facebook', initDate, endDate, headers);
        resultadoEmpresa.meta.campanhas = campanhasMeta.length;
        
        if (campanhasMeta.length > 0) {
          // Buscar campanhas locais do Meta
          const { data: contasMeta } = await supabase
            .from('conta_anuncio')
            .select('id_conta')
            .eq('id_empresa', empresaId)
            .eq('plataforma', 'META');

          if (contasMeta && contasMeta.length > 0) {
            const { data: campanhasLocaisMeta } = await supabase
              .from('campanha')
              .select('id_campanha, id_campanha_externo, nome')
              .in('id_conta', contasMeta.map(c => c.id_conta));

            if (campanhasLocaisMeta) {
              for (const metricoolCamp of campanhasMeta) {
                const campanhaLocal = campanhasLocaisMeta.find(c => 
                  c.id_campanha_externo === metricoolCamp.campaignId ||
                  c.nome?.toLowerCase().trim() === metricoolCamp.campaignName?.toLowerCase().trim()
                );

                if (campanhaLocal && (metricoolCamp.conversions > 0 || metricoolCamp.conversionValue > 0)) {
                  // Só atualizar se não tiver dados do Meta direto ou se Metricool tiver mais info
                  const { data: existente } = await supabase
                    .from('campanha_metricas_dia')
                    .select('conversoes, fonte_conversoes')
                    .eq('id_campanha', campanhaLocal.id_campanha)
                    .eq('data', metricoolCamp.data)
                    .single();

                  // Só sobrescrever se não tiver conversões ou se fonte for null/METRICOOL
                  const deveAtualizar = !existente || 
                    !existente.conversoes || 
                    existente.conversoes === 0 ||
                    existente.fonte_conversoes === null ||
                    existente.fonte_conversoes?.startsWith('METRICOOL');

                  if (deveAtualizar) {
                    const { error } = await supabase
                      .from('campanha_metricas_dia')
                      .upsert({
                        id_campanha: campanhaLocal.id_campanha,
                        data: metricoolCamp.data,
                        impressoes: metricoolCamp.impressions,
                        cliques: metricoolCamp.clicks,
                        verba_investida: metricoolCamp.spent,
                        leads: metricoolCamp.conversions,
                        conversoes: metricoolCamp.conversions,
                        valor_conversao: metricoolCamp.conversionValue,
                        fonte_conversoes: 'METRICOOL_META',
                      }, {
                        onConflict: 'id_campanha,data',
                      });

                    if (!error) {
                      resultadoEmpresa.meta.metricas_atualizadas++;
                      console.log(`    ✅ Meta: ${metricoolCamp.campaignName} - ${metricoolCamp.data}: ${metricoolCamp.conversions} conversões, R$ ${metricoolCamp.conversionValue}`);
                    }
                  }
                }
              }
            }
          }
        } else {
          // Tentar métricas agregadas para Meta
          console.log("  🔄 Tentando métricas timeline de Meta Ads...");
          const metricasMeta = await fetchTimelineMetrics(config, 'facebook', initDate, endDate, headers);
          
          if (metricasMeta.size > 0) {
            console.log(`  📊 ${metricasMeta.size} dias de métricas agregadas Meta`);
            
            // Buscar campanhas Meta da empresa para distribuir ou agregar
            const { data: contasMeta } = await supabase
              .from('conta_anuncio')
              .select('id_conta')
              .eq('id_empresa', empresaId)
              .eq('plataforma', 'META');
              
            if (contasMeta && contasMeta.length > 0) {
              const { data: campanhasMeta } = await supabase
                .from('campanha')
                .select('id_campanha, nome')
                .in('id_conta', contasMeta.map(c => c.id_conta))
                .eq('ativa', true)
                .limit(1); // Pegar primeira campanha ativa para associar métricas agregadas
                
              if (campanhasMeta && campanhasMeta.length > 0) {
                const campanhaRef = campanhasMeta[0];
                
                for (const [data, metricas] of metricasMeta) {
                  const conversoes = metricas.conversions || metricas.results || 0;
                  if (conversoes > 0 || metricas.conversionValue > 0) {
                    // Verificar se já existe com dados da API direta
                    const { data: existente } = await supabase
                      .from('campanha_metricas_dia')
                      .select('conversoes, fonte_conversoes')
                      .eq('id_campanha', campanhaRef.id_campanha)
                      .eq('data', data)
                      .single();

                    const deveAtualizar = !existente || 
                      !existente.conversoes || 
                      existente.conversoes === 0 ||
                      existente.fonte_conversoes === null ||
                      existente.fonte_conversoes?.startsWith('METRICOOL');

                    if (deveAtualizar) {
                      const { error } = await supabase
                        .from('campanha_metricas_dia')
                        .upsert({
                          id_campanha: campanhaRef.id_campanha,
                          data,
                          impressoes: metricas.impressions || 0,
                          cliques: metricas.clicks || 0,
                          verba_investida: metricas.spent || 0,
                          conversoes: conversoes,
                          valor_conversao: metricas.conversionValue || 0,
                          fonte_conversoes: 'METRICOOL_META_AGREGADO',
                        }, {
                          onConflict: 'id_campanha,data',
                        });
                        
                      if (!error) resultadoEmpresa.meta.metricas_atualizadas++;
                    }
                  }
                }
              }
            }
          }
        }

        // ============ CRIATIVOS/ANÚNCIOS (GOOGLE + META) ============
        console.log("\n  === CRIATIVOS/ANÚNCIOS ===");
        
        // Buscar criativos locais da empresa para matching
        const { data: contasEmpresa } = await supabase
          .from('conta_anuncio')
          .select('id_conta, plataforma')
          .eq('id_empresa', empresaId);
        
        if (contasEmpresa && contasEmpresa.length > 0) {
          const { data: campanhasLocais } = await supabase
            .from('campanha')
            .select('id_campanha, id_campanha_externo, nome')
            .in('id_conta', contasEmpresa.map(c => c.id_conta));
          
          const { data: criativosLocais } = await supabase
            .from('criativo')
            .select('id_criativo, id_criativo_externo, id_anuncio_externo, id_campanha, descricao')
            .in('id_campanha', (campanhasLocais || []).map(c => c.id_campanha));
          
          console.log(`  📋 ${criativosLocais?.length || 0} criativos locais encontrados`);
          
          // Logar amostra de IDs locais para debug
          if (criativosLocais && criativosLocais.length > 0) {
            console.log(`  📋 Amostra de IDs locais (primeiros 5):`);
            for (const c of criativosLocais.slice(0, 5)) {
              console.log(`    - id_criativo_externo: ${c.id_criativo_externo}, id_anuncio_externo: ${c.id_anuncio_externo}`);
            }
          }
          
          // Coletar criativos do Google
          const criativosGoogle = await fetchAdsCreativeData(config, 'google', initDate, endDate, headers);
          console.log(`  📊 ${criativosGoogle.length} criativos Google retornados da API`);
          
          if (criativosGoogle.length > 0) {
            // Logar amostra de IDs do Metricool
            console.log(`  📋 Amostra de IDs Google Metricool (primeiros 5):`);
            for (const c of criativosGoogle.slice(0, 5)) {
              console.log(`    - adId: ${c.adId}, adName: ${c.adName}, campaignId: ${c.campaignId}`);
            }
            
            for (const criativoMetricool of criativosGoogle) {
              // Tentar encontrar criativo local pelo ID do anúncio ou ID do criativo
              const criativoLocal = (criativosLocais || []).find(c => 
                c.id_anuncio_externo === criativoMetricool.adId ||
                c.id_criativo_externo === criativoMetricool.adId ||
                c.id_anuncio_externo === criativoMetricool.adsetId ||
                c.id_criativo_externo === criativoMetricool.adsetId
              );
              
              if (criativoLocal) {
                const { error } = await supabase
                  .from('criativo_metricas_dia')
                  .upsert({
                    id_criativo: criativoLocal.id_criativo,
                    data: criativoMetricool.data,
                    impressoes: criativoMetricool.impressions,
                    cliques: criativoMetricool.clicks,
                    verba_investida: criativoMetricool.spent,
                    leads: criativoMetricool.conversions,
                  }, {
                    onConflict: 'id_criativo,data',
                  });
                
                if (!error) {
                  resultadoEmpresa.google.criativos++;
                  console.log(`    ✅ Criativo Google: ${criativoMetricool.adName || criativoMetricool.adId} - ${criativoMetricool.data}: ${criativoMetricool.impressions} impressões, ${criativoMetricool.conversions} conversões`);
                }
              } else {
                console.log(`    ℹ️ Criativo Google sem match: adId=${criativoMetricool.adId}, adsetId=${criativoMetricool.adsetId || 'N/A'}`);
              }
            }
          }
          
          // Coletar criativos do Meta
          const criativosMeta = await fetchAdsCreativeData(config, 'facebook', initDate, endDate, headers);
          console.log(`  📊 ${criativosMeta.length} criativos Meta retornados da API`);
          
          if (criativosMeta.length > 0) {
            // Logar amostra de IDs do Metricool
            console.log(`  📋 Amostra de IDs Meta Metricool (primeiros 5):`);
            for (const c of criativosMeta.slice(0, 5)) {
              console.log(`    - adId: ${c.adId}, adName: ${c.adName}, campaignId: ${c.campaignId}`);
            }
            
            for (const criativoMetricool of criativosMeta) {
              // Tentar encontrar criativo local pelo ID do anúncio ou ID do criativo
              const criativoLocal = (criativosLocais || []).find(c => 
                c.id_anuncio_externo === criativoMetricool.adId ||
                c.id_criativo_externo === criativoMetricool.adId ||
                c.id_anuncio_externo === criativoMetricool.adsetId ||
                c.id_criativo_externo === criativoMetricool.adsetId
              );
              
              if (criativoLocal) {
                const { error } = await supabase
                  .from('criativo_metricas_dia')
                  .upsert({
                    id_criativo: criativoLocal.id_criativo,
                    data: criativoMetricool.data,
                    impressoes: criativoMetricool.impressions,
                    cliques: criativoMetricool.clicks,
                    verba_investida: criativoMetricool.spent,
                    leads: criativoMetricool.conversions,
                  }, {
                    onConflict: 'id_criativo,data',
                  });
                
                if (!error) {
                  resultadoEmpresa.meta.criativos++;
                  console.log(`    ✅ Criativo Meta: ${criativoMetricool.adName || criativoMetricool.adId} - ${criativoMetricool.data}: ${criativoMetricool.impressions} impressões, ${criativoMetricool.conversions} conversões`);
                }
              } else {
                console.log(`    ℹ️ Criativo Meta sem match: adId=${criativoMetricool.adId}, adsetId=${criativoMetricool.adsetId || 'N/A'}`);
              }
            }
          }
          
          console.log(`  📊 Total criativos enriquecidos: Google=${resultadoEmpresa.google.criativos}, Meta=${resultadoEmpresa.meta.criativos}`);
        }

        resultados.push(resultadoEmpresa);

      } catch (empresaError: any) {
        console.error(`❌ Erro na empresa ${empresaId}:`, empresaError.message);
        resultados.push({
          empresa_id: empresaId,
          status: "error",
          error: empresaError.message,
        });
      }
    }

    // Registrar execução do cronjob
    const duracao = Date.now() - startTime;
    const temErro = resultados.some(r => r.status === "error");
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-campanhas-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find(r => r.status === "error")?.error : null,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Enriquecimento concluído em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Enriquecimento de campanhas concluído (Google + Meta)",
      duracao_ms: duracao,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-campanhas-metricool',
      status: 'error',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
