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
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  conversionValue: number;
  reach: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  plataforma: 'GOOGLE' | 'META' | 'TIKTOK';
}

// ============================================================
// FASE 1: Buscar campanhas de Ads via endpoints CORRETOS
// Docs: https://app.metricool.com/api/swagger.json
// ============================================================

type AdsPlatform = 'adwords' | 'facebookads' | 'tiktokads';

const PLATFORM_MAP: Record<AdsPlatform, { label: string; plataforma: AdsCampaignData['plataforma']; dbPlataforma: string }> = {
  adwords:      { label: 'Google Ads',  plataforma: 'GOOGLE',  dbPlataforma: 'GOOGLE' },
  facebookads:  { label: 'Meta Ads',    plataforma: 'META',    dbPlataforma: 'META' },
  tiktokads:    { label: 'TikTok Ads',  plataforma: 'TIKTOK',  dbPlataforma: 'TIKTOK' },
};

async function fetchAdsCampaigns(
  config: MetricoolConfig,
  platform: AdsPlatform,
  initDate: string,
  endDate: string,
  headers: Record<string, string>,
): Promise<AdsCampaignData[]> {
  const info = PLATFORM_MAP[platform];
  const campanhas: AdsCampaignData[] = [];

  // URL CORRETA conforme Swagger oficial
  const url = `${METRICOOL_API_BASE}/stats/${platform}/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;

  console.log(`  🔍 Buscando ${info.label}: ${url}`);

  try {
    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.log(`  ⚠️ ${info.label} retornou ${resp.status}: ${errorText.substring(0, 300)}`);
      return campanhas;
    }

    const data = await resp.json();
    console.log(`  📋 ${info.label} resposta: ${JSON.stringify(data).substring(0, 500)}`);

    // AdCampaign[] — array plano de objetos com métricas diretas
    const campaigns = Array.isArray(data) ? data : data.campaigns || data.data || [];

    for (const c of campaigns) {
      campanhas.push({
        campaignId: String(c.id || c.campaignId || c.campaign_id || ''),
        campaignName: String(c.name || c.campaignName || ''),
        impressions: Number(c.impressions || 0),
        clicks: Number(c.clicks || 0),
        spent: Number(c.spent || c.cost || 0),
        conversions: Number(c.conversions || c.results || 0),
        conversionValue: Number(c.conversionValue || c.conversion_value || c.revenue || 0),
        reach: Number(c.reach || 0),
        cpc: Number(c.cpc || 0),
        cpm: Number(c.cpm || 0),
        ctr: Number(c.ctr || 0),
        roas: Number(c.roas || 0),
        plataforma: info.plataforma,
      });
    }

    console.log(`  ✅ ${info.label}: ${campanhas.length} campanhas encontradas`);
  } catch (err) {
    console.log(`  ❌ Erro ao buscar ${info.label}:`, err);
  }

  return campanhas;
}

// ============================================================
// FASE 2: Buscar métricas AGREGADAS como complemento/fallback
// ============================================================

interface AggregatedMetrics {
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

async function fetchAdsAggregations(
  config: MetricoolConfig,
  platform: 'adwords' | 'facebookads',
  initDate: string,
  endDate: string,
  headers: Record<string, string>,
): Promise<AggregatedMetrics | null> {
  const aggEndpoint = platform === 'adwords' ? 'adwordsPerformance' : 'fbAdsPerformance';
  const url = `${METRICOOL_API_BASE}/stats/aggregations/${aggEndpoint}?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;

  console.log(`  📊 Buscando agregações ${platform}: ${url}`);

  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.log(`  ⚠️ Agregações ${platform}: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    console.log(`  📋 Agregações ${platform}: ${JSON.stringify(data).substring(0, 500)}`);

    // Pode ser objeto ou array — normalizar
    const obj = Array.isArray(data) ? data[0] : data;
    if (!obj) return null;

    return {
      impressions: Number(obj.impressions || 0),
      clicks: Number(obj.clicks || 0),
      spent: Number(obj.spent || obj.cost || 0),
      conversions: Number(obj.conversions || obj.results || 0),
      conversionValue: Number(obj.conversionValue || obj.conversion_value || 0),
      cpc: Number(obj.cpc || 0),
      cpm: Number(obj.cpm || 0),
      ctr: Number(obj.ctr || 0),
    };
  } catch (err) {
    console.log(`  ⚠️ Erro agregações ${platform}:`, err);
    return null;
  }
}

// ============================================================
// FASE 3: Fallback via timeline metrics (já funciona)
// ============================================================

async function fetchTimelineMetrics(
  config: MetricoolConfig,
  plataforma: 'google' | 'facebook',
  initDate: string,
  endDate: string,
  headers: Record<string, string>,
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
        // Log raw para diagnostico (apenas primeira metrica)
        if (metrica.campo === 'conversions') {
          console.log(`    🔍 RAW ${metrica.nome}: ${JSON.stringify(data).substring(0, 800)}`);
        }
        console.log(`    ✅ ${metrica.nome}: ${data?.length || 0} registros`);

        for (const item of (data || [])) {
          let dataStr: string | null = null;
          let valor = 0;

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
              metricasPorData.set(dataStr, { conversions: 0, conversionValue: 0, spent: 0, clicks: 0, impressions: 0, results: 0 });
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

// ============================================================
// Helpers
// ============================================================

async function salvarMetricasCampanha(
  supabase: any,
  empresaId: string,
  plataformaDb: string,
  campanhas: AdsCampaignData[],
  fonteSuffix: string,
): Promise<number> {
  if (campanhas.length === 0) return 0;

  // Buscar contas da plataforma
  const { data: contas } = await supabase
    .from('conta_anuncio')
    .select('id_conta')
    .eq('id_empresa', empresaId)
    .eq('plataforma', plataformaDb);

  if (!contas || contas.length === 0) {
    console.log(`  ℹ️ Nenhuma conta ${plataformaDb} para empresa ${empresaId}`);
    return 0;
  }

  const { data: campanhasLocais } = await supabase
    .from('campanha')
    .select('id_campanha, id_campanha_externo, nome')
    .in('id_conta', contas.map((c: any) => c.id_conta));

  if (!campanhasLocais || campanhasLocais.length === 0) {
    console.log(`  ℹ️ Nenhuma campanha local ${plataformaDb}`);
    return 0;
  }

  let atualizadas = 0;
  const hoje = new Date().toISOString().split('T')[0];

  for (const mc of campanhas) {
    // Match por ID externo ou nome
    const local = campanhasLocais.find((c: any) =>
      c.id_campanha_externo === mc.campaignId ||
      (c.nome && mc.campaignName && c.nome.toLowerCase().trim() === mc.campaignName.toLowerCase().trim())
    );

    if (!local) {
      console.log(`  ⚠️ Sem match local: id=${mc.campaignId}, nome="${mc.campaignName}"`);
      continue;
    }

    // Salvar mesmo sem conversões — spent/clicks/impressions são valiosos
    if (mc.spent > 0 || mc.clicks > 0 || mc.impressions > 0 || mc.conversions > 0) {
      const { data: existente } = await supabase
        .from('campanha_metricas_dia')
        .select('conversoes, fonte_conversoes')
        .eq('id_campanha', local.id_campanha)
        .eq('data', hoje)
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
            id_campanha: local.id_campanha,
            data: hoje,
            impressoes: mc.impressions,
            cliques: mc.clicks,
            verba_investida: mc.spent,
            conversoes: mc.conversions,
            valor_conversao: mc.conversionValue,
            leads: mc.conversions,
            fonte_conversoes: `METRICOOL_${fonteSuffix}`,
          }, { onConflict: 'id_campanha,data' });

        if (!error) {
          atualizadas++;
          console.log(`    ✅ ${mc.campaignName}: imp=${mc.impressions}, clicks=${mc.clicks}, spent=${mc.spent}, conv=${mc.conversions}`);
        } else {
          console.error(`    ❌ Erro upsert: ${error.message}`);
        }
      }
    }
  }

  return atualizadas;
}

async function salvarTimelineAgregado(
  supabase: any,
  empresaId: string,
  plataformaDb: string,
  metricasPorData: Map<string, Record<string, number>>,
  fonteSuffix: string,
): Promise<number> {
  if (metricasPorData.size === 0) return 0;

  const { data: contas } = await supabase
    .from('conta_anuncio')
    .select('id_conta')
    .eq('id_empresa', empresaId)
    .eq('plataforma', plataformaDb);

  if (!contas || contas.length === 0) return 0;

  const { data: campanhasLocais } = await supabase
    .from('campanha')
    .select('id_campanha, nome')
    .in('id_conta', contas.map((c: any) => c.id_conta))
    .eq('ativa', true)
    .limit(1);

  if (!campanhasLocais || campanhasLocais.length === 0) return 0;

  const campanhaRef = campanhasLocais[0];
  let atualizadas = 0;

  for (const [data, metricas] of metricasPorData) {
    if (metricas.spent > 0 || metricas.clicks > 0 || metricas.conversions > 0) {
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
        const conversoes = metricas.conversions || metricas.results || 0;
        const { error } = await supabase
          .from('campanha_metricas_dia')
          .upsert({
            id_campanha: campanhaRef.id_campanha,
            data,
            impressoes: metricas.impressions || 0,
            cliques: metricas.clicks || 0,
            verba_investida: metricas.spent || 0,
            conversoes,
            valor_conversao: metricas.conversionValue || 0,
            fonte_conversoes: `METRICOOL_${fonteSuffix}_TIMELINE`,
          }, { onConflict: 'id_campanha,data' });

        if (!error) atualizadas++;
        else console.error(`    ❌ Erro upsert timeline: ${error.message}`);
      }
    }
  }

  return atualizadas;
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("🚀 Iniciando enriquecimento de campanhas via Metricool (Google + Meta + TikTok)...");

    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma integração Metricool configurada", processadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as MetricoolConfig;
      const empresaId = integracao.id_empresa;

      console.log(`\n📊 Processando empresa ${empresaId}...`);

      try {
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

        const resultado: any = {
          empresa_id: empresaId,
          google: { campanhas: 0, metricas: 0, agregacoes: false },
          meta: { campanhas: 0, metricas: 0, agregacoes: false },
          tiktok: { campanhas: 0, metricas: 0 },
          status: "success",
        };

        // ============ COLETA DIÁRIA POR PLATAFORMA ============
        // Iterar dia a dia nos últimos 7 dias para dados granulares
        // + snapshot completo de 30 dias para totais de campanhas

        const platformsToFetch: AdsPlatform[] = ['adwords', 'facebookads', 'tiktokads'];

        // 1) Snapshot 30 dias (totais por campanha - salva na data de hoje)
        for (const platform of platformsToFetch) {
          const info = PLATFORM_MAP[platform];
          const key = platform === 'adwords' ? 'google' : platform === 'facebookads' ? 'meta' : 'tiktok';
          console.log(`\n  === ${info.label} (snapshot 30d) ===`);
          
          const campanhas = await fetchAdsCampaigns(config, platform, initDate, endDate, headers);
          (resultado as any)[key].campanhas = campanhas.length;
          
          if (campanhas.length > 0) {
            (resultado as any)[key].metricas = await salvarMetricasCampanha(supabase, empresaId, info.dbPlataforma, campanhas, info.dbPlataforma);
          }
        }

        // ============ GOOGLE ADS KEYWORDS (antes da coleta diária para evitar timeout) ============
        console.log("\n  === GOOGLE ADS KEYWORDS ===");
        let keywordsSalvas = 0;
        try {
          const kwUrl = `${METRICOOL_API_BASE}/stats/adwords/keywords?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
          console.log(`  🔍 Buscando keywords: ${kwUrl}`);
          const kwResp = await fetch(kwUrl, { headers });

          if (kwResp.ok) {
            const kwData = await kwResp.json();
            console.log(`  📋 Keywords resposta: ${JSON.stringify(kwData).substring(0, 800)}`);
            const keywords = Array.isArray(kwData) ? kwData : kwData.keywords || kwData.data || [];

            // Buscar campanhas Google locais para vincular
            const { data: contasGoogle } = await supabase
              .from('conta_anuncio')
              .select('id_conta')
              .eq('id_empresa', empresaId)
              .eq('plataforma', 'GOOGLE');

            let campanhasGoogleLocais: any[] = [];
            if (contasGoogle && contasGoogle.length > 0) {
              const { data: cl } = await supabase
                .from('campanha')
                .select('id_campanha, id_campanha_externo, nome')
                .in('id_conta', contasGoogle.map((c: any) => c.id_conta));
              campanhasGoogleLocais = cl || [];
            }

            const initDateIso = `${initDate.substring(0,4)}-${initDate.substring(4,6)}-${initDate.substring(6,8)}`;
            const endDateIso = `${endDate.substring(0,4)}-${endDate.substring(4,6)}-${endDate.substring(6,8)}`;

            for (const kw of keywords) {
              const keyword = String(kw.keyword || kw.name || kw.text || '');
              if (!keyword) continue;

              const campaignIdExt = String(kw.campaignId || kw.campaign_id || kw.campId || '');
              const campaignName = String(kw.campaignName || kw.campaign_name || kw.campName || '');

              let idCampanhaLocal: string | null = null;
              if (campaignIdExt || campaignName) {
                const local = campanhasGoogleLocais.find((c: any) =>
                  (campaignIdExt && c.id_campanha_externo === campaignIdExt) ||
                  (campaignName && c.nome && c.nome.toLowerCase().trim() === campaignName.toLowerCase().trim())
                );
                if (local) idCampanhaLocal = local.id_campanha;
              }

              const { error } = await supabase
                .from('google_ads_keyword')
                .upsert({
                  id_empresa: empresaId,
                  id_campanha: idCampanhaLocal,
                  keyword,
                  match_type: String(kw.matchType || kw.match_type || ''),
                  impressions: Number(kw.impressions || 0),
                  clicks: Number(kw.clicks || 0),
                  spent: Number(kw.spent || kw.cost || 0),
                  conversions: Number(kw.conversions || kw.allConversions || 0),
                  conversion_value: Number(kw.conversionValue || kw.conversion_value || kw.allConversionsValue || 0),
                  cpc: Number(kw.averageCPC || kw.cpc || 0),
                  ctr: Number(kw.ctr || 0),
                  quality_score: kw.historicalQualityScore || kw.qualityScore || kw.quality_score || null,
                  campaign_name: campaignName || null,
                  campaign_id_externo: campaignIdExt || null,
                  ctr: Number(kw.ctr || 0),
                  quality_score: kw.qualityScore || kw.quality_score || null,
                  campaign_name: campaignName || null,
                  campaign_id_externo: campaignIdExt || null,
                  data_inicio: initDateIso,
                  data_fim: endDateIso,
                }, { onConflict: 'id_empresa,keyword,campaign_id_externo,data_inicio,data_fim' });

              if (!error) {
                keywordsSalvas++;
              } else {
                console.error(`  ❌ Erro upsert keyword "${keyword}": ${error.message}`);
              }
            }

            console.log(`  ✅ Keywords: ${keywords.length} encontradas, ${keywordsSalvas} salvas`);
          } else {
            const errText = await kwResp.text();
            console.log(`  ⚠️ Keywords retornou ${kwResp.status}: ${errText.substring(0, 300)}`);
          }
        } catch (kwError) {
          console.error(`  ❌ Erro ao buscar keywords:`, kwError);
        }
        resultado.google.keywords = keywordsSalvas;

        // ============ TIKTOK ADS ============
        console.log("\n  === TIKTOK ADS ===");
        const campanhasTiktok = await fetchAdsCampaigns(config, 'tiktokads', initDate, endDate, headers);
        resultado.tiktok.campanhas = campanhasTiktok.length;
        if (campanhasTiktok.length > 0) {
          resultado.tiktok.metricas = await salvarMetricasCampanha(supabase, empresaId, 'TIKTOK', campanhasTiktok, 'TIKTOK');
        }

        // ============ AGREGAÇÕES ============
        const aggGoogle = await fetchAdsAggregations(config, 'adwords', initDate, endDate, headers);
        if (aggGoogle) {
          resultado.google.agregacoes = true;
          console.log(`  📊 Agregações Google: spent=${aggGoogle.spent}, clicks=${aggGoogle.clicks}`);
        }
        const aggMeta = await fetchAdsAggregations(config, 'facebookads', initDate, endDate, headers);
        if (aggMeta) {
          resultado.meta.agregacoes = true;
          console.log(`  📊 Agregações Meta: spent=${aggMeta.spent}, clicks=${aggMeta.clicks}`);
        }

        // ============ COLETA DIÁRIA (últimos 7 dias - parte mais demorada) ============
        console.log("\n  === COLETA DIÁRIA (últimos 7 dias) ===");
        let totalDiasSalvos = 0;
        
        for (let d = 0; d < 7; d++) {
          const dia = new Date();
          dia.setDate(dia.getDate() - d);
          const diaStr = dia.toISOString().split('T')[0].replace(/-/g, '');
          const diaIso = dia.toISOString().split('T')[0];
          
          for (const platform of ['adwords', 'facebookads'] as AdsPlatform[]) {
            const info = PLATFORM_MAP[platform];
            
            try {
              const campanhasDia = await fetchAdsCampaigns(config, platform, diaStr, diaStr, headers);
              
              if (campanhasDia.length > 0) {
                for (const mc of campanhasDia) {
                  if (mc.spent > 0 || mc.clicks > 0 || mc.impressions > 0) {
                    const { data: contas } = await supabase
                      .from('conta_anuncio')
                      .select('id_conta')
                      .eq('id_empresa', empresaId)
                      .eq('plataforma', info.dbPlataforma);
                    
                    if (contas && contas.length > 0) {
                      const { data: campanhasLocais } = await supabase
                        .from('campanha')
                        .select('id_campanha, id_campanha_externo, nome')
                        .in('id_conta', contas.map((c: any) => c.id_conta));
                      
                      if (campanhasLocais) {
                        const local = campanhasLocais.find((c: any) =>
                          c.id_campanha_externo === mc.campaignId ||
                          (c.nome && mc.campaignName && c.nome.toLowerCase().trim() === mc.campaignName.toLowerCase().trim())
                        );
                        
                        if (local) {
                          const { error } = await supabase
                            .from('campanha_metricas_dia')
                            .upsert({
                              id_campanha: local.id_campanha,
                              data: diaIso,
                              impressoes: mc.impressions,
                              cliques: mc.clicks,
                              verba_investida: mc.spent,
                              conversoes: mc.conversions,
                              valor_conversao: mc.conversionValue,
                              leads: mc.conversions,
                              fonte_conversoes: `METRICOOL_${info.dbPlataforma}_DAILY`,
                            }, { onConflict: 'id_campanha,data' });
                          
                          if (!error) totalDiasSalvos++;
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.log(`  ⚠️ Erro dia ${diaIso} ${info.label}:`, err);
            }
          }
        }
        
        console.log(`  ✅ Total dias salvos: ${totalDiasSalvos}`);

        resultados.push(resultado);
      } catch (empresaError: any) {
        console.error(`❌ Erro na empresa ${empresaId}:`, empresaError.message);
        resultados.push({ empresa_id: empresaId, status: "error", error: empresaError.message });
      }
    }

    const duracao = Date.now() - startTime;
    const temErro = resultados.some((r: any) => r.status === "error");

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-campanhas-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find((r: any) => r.status === "error")?.error : null,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Enriquecimento concluído em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Enriquecimento de campanhas concluído (Google + Meta + TikTok)",
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
