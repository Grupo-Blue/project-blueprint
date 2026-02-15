import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METRICOOL_API_BASE = "https://app.metricool.com/api";
const DIAS_POR_PAGINA = 5; // Quantos dias processar por invocação
const TOTAL_DIAS_LOOKBACK = 30;
const PARALLEL_BATCH_SIZE = 5; // Chamadas paralelas por vez

interface MetricoolConfig {
  user_token: string;
  user_id: string;
  blog_id: string;
  id_empresa: string;
}

type AdsPlatform = 'adwords' | 'facebookads' | 'tiktokads';

const PLATFORM_MAP: Record<AdsPlatform, { label: string; dbPlataforma: string }> = {
  adwords:      { label: 'Google Ads',  dbPlataforma: 'GOOGLE' },
  facebookads:  { label: 'Meta Ads',    dbPlataforma: 'META' },
  tiktokads:    { label: 'TikTok Ads',  dbPlataforma: 'TIKTOK' },
};

// Buscar campanhas de um único dia via Metricool
async function fetchAdsCampaignsDay(
  config: MetricoolConfig,
  platform: AdsPlatform,
  dayStr: string,
  headers: Record<string, string>,
) {
  const url = `${METRICOOL_API_BASE}/stats/${platform}/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${dayStr}&end=${dayStr}`;

  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) return [];

    const data = await resp.json();
    const campaigns = Array.isArray(data) ? data : data.campaigns || data.data || [];

    return campaigns.map((c: any) => ({
      campaignId: String(c.id || c.campaignId || c.campaign_id || ''),
      campaignName: String(c.name || c.campaignName || ''),
      impressions: Number(c.impressions || 0),
      clicks: Number(c.clicks || 0),
      spent: Number(c.spent || c.cost || 0),
      conversions: Number(c.conversions || c.results || 0),
      conversionValue: Number(c.conversionValue || c.conversion_value || c.revenue || 0),
      reach: Number(c.reach || 0),
      cpc: Number(c.cpc || 0),
    }));
  } catch (err) {
    console.log(`  ⚠️ Erro ${platform} dia ${dayStr}:`, err);
    return [];
  }
}

// Processar um batch de dias em paralelo
async function processDaysBatch(
  days: { diaStr: string; diaIso: string }[],
  platforms: AdsPlatform[],
  config: MetricoolConfig,
  headers: Record<string, string>,
  campanhasLocaisPorPlataforma: Record<string, any[]>,
  supabase: any,
) {
  let totalSalvos = 0;

  const tasks = days.flatMap(({ diaStr, diaIso }) =>
    platforms.map(async (platform) => {
      const info = PLATFORM_MAP[platform];
      const campanhasLocais = campanhasLocaisPorPlataforma[info.dbPlataforma];
      if (!campanhasLocais || campanhasLocais.length === 0) return 0;

      try {
        const campanhasDia = await fetchAdsCampaignsDay(config, platform, diaStr, headers);
        let salvos = 0;

        for (const mc of campanhasDia) {
          if (mc.spent <= 0 && mc.clicks <= 0 && mc.impressions <= 0) continue;

          const mcNameNorm = (mc.campaignName || '').toLowerCase().trim();
          const local = campanhasLocais.find((c: any) => {
            if (c.id_campanha_externo === mc.campaignId) return true;
            const localNorm = (c.nome || '').toLowerCase().trim();
            if (localNorm && mcNameNorm && localNorm === mcNameNorm) return true;
            if (localNorm && mcNameNorm && (localNorm.includes(mcNameNorm) || mcNameNorm.includes(localNorm))) return true;
            return false;
          });

          if (!local) continue;

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
              cpc_medio: mc.cpc || null,
              alcance: mc.reach || null,
              fonte_conversoes: `METRICOOL_${info.dbPlataforma}_DAILY`,
            }, { onConflict: 'id_campanha,data' });

          if (!error) salvos++;
        }
        return salvos;
      } catch {
        return 0;
      }
    })
  );

  const results = await Promise.all(tasks);
  totalSalvos = results.reduce((sum, n) => sum + n, 0);
  return totalSalvos;
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
    const body = await req.json().catch(() => ({}));
    const filtroEmpresa = body.id_empresa || null;
    const diasLookback = body.dias || TOTAL_DIAS_LOOKBACK;
    const resumeSync = body.resume !== false; // por padrão tenta resumir

    console.log(`🚀 Enriquecimento Metricool paginado (${DIAS_POR_PAGINA} dias/página, ${diasLookback} dias lookback)${filtroEmpresa ? ` empresa: ${filtroEmpresa}` : ' (todas)'}`);

    let query = supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (filtroEmpresa) {
      query = query.eq('id_empresa', filtroEmpresa);
    }

    const { data: integracoes, error: intError } = await query;
    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma integração Metricool configurada", processadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as MetricoolConfig;
      const empresaId = integracao.id_empresa;
      const syncType = 'metricool_enriquecimento';

      console.log(`\n📊 Empresa ${empresaId}...`);

      try {
        // ========== SYNC STATUS: buscar ou criar cursor ==========
        let syncStatus: any = null;
        if (resumeSync) {
          const { data: existing } = await supabase
            .from('sync_status')
            .select('*')
            .eq('id_empresa', empresaId)
            .eq('tipo_sync', syncType)
            .single();

          syncStatus = existing;
        }

        const diaOffset = syncStatus?.last_cursor?.dia_offset || 0;
        const keywordsDone = syncStatus?.last_cursor?.keywords_done || false;

        // Se já completou, resetar para nova execução
        if (syncStatus?.status === 'completed' && diaOffset >= diasLookback) {
          // Reset para nova rodada
          await supabase
            .from('sync_status')
            .upsert({
              id_empresa: empresaId,
              tipo_sync: syncType,
              last_cursor: { dia_offset: 0, keywords_done: false },
              total_synced: 0,
              status: 'running',
              started_at: new Date().toISOString(),
              completed_at: null,
            }, { onConflict: 'id_empresa,tipo_sync' });
        }

        // Marcar como running
        await supabase
          .from('sync_status')
          .upsert({
            id_empresa: empresaId,
            tipo_sync: syncType,
            status: 'running',
            last_cursor: syncStatus?.last_cursor || { dia_offset: 0, keywords_done: false },
            total_synced: syncStatus?.total_synced || 0,
            started_at: syncStatus?.started_at || new Date().toISOString(),
          }, { onConflict: 'id_empresa,tipo_sync' });

        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        const resultado: any = {
          empresa_id: empresaId,
          dias_salvos: 0,
          keywords: 0,
          status: "success",
          hasNextPage: false,
          dia_offset: diaOffset,
        };

        // ============ GOOGLE ADS KEYWORDS (só na primeira página) ============
        if (!keywordsDone) {
          console.log("  === KEYWORDS ===");
          let keywordsSalvas = 0;

          const hoje = new Date();
          const lookbackStart = new Date();
          lookbackStart.setDate(hoje.getDate() - diasLookback);

          const initDate = lookbackStart.toISOString().split('T')[0].replace(/-/g, '');
          const endDate = hoje.toISOString().split('T')[0].replace(/-/g, '');

          try {
            const kwUrl = `${METRICOOL_API_BASE}/stats/adwords/keywords?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
            const kwResp = await fetch(kwUrl, { headers });

            if (kwResp.ok) {
              const kwData = await kwResp.json();
              const keywords = Array.isArray(kwData) ? kwData : kwData.keywords || kwData.data || [];

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
                    impressions: Math.round(Number(kw.impressions || 0)),
                    clicks: Math.round(Number(kw.clicks || 0)),
                    spent: Number(kw.spent || kw.cost || 0),
                    conversions: Math.round(Number(kw.conversions || kw.allConversions || 0)),
                    conversion_value: Number(kw.conversionValue || kw.conversion_value || kw.allConversionsValue || 0),
                    cpc: Number(kw.averageCPC || kw.cpc || 0),
                    ctr: Number(kw.ctr || 0),
                    quality_score: (kw.qualityScore != null || kw.quality_score != null) ? Math.round(Number(kw.qualityScore ?? kw.quality_score)) : null,
                    campaign_name: campaignName || null,
                    campaign_id_externo: campaignIdExt || '',
                    data_inicio: initDateIso,
                    data_fim: endDateIso,
                  }, { onConflict: 'id_empresa,keyword,campaign_id_externo,data_inicio,data_fim' });

                if (!error) keywordsSalvas++;
                else console.error(`  ❌ Keyword "${keyword}": ${error.message}`);
              }
              console.log(`  ✅ Keywords: ${keywordsSalvas} salvas`);
            }
          } catch (kwError) {
            console.error(`  ❌ Erro keywords:`, kwError);
          }
          resultado.keywords = keywordsSalvas;
        }

        // ============ COLETA DIÁRIA PAGINADA + PARALELA ============
        const endDia = Math.min(diaOffset + DIAS_POR_PAGINA, diasLookback);
        console.log(`  === DIAS ${diaOffset} a ${endDia - 1} de ${diasLookback} ===`);

        // Pre-fetch campanhas locais
        const campanhasLocaisPorPlataforma: Record<string, any[]> = {};
        for (const platform of ['adwords', 'facebookads'] as AdsPlatform[]) {
          const info = PLATFORM_MAP[platform];
          const { data: contas } = await supabase
            .from('conta_anuncio')
            .select('id_conta')
            .eq('id_empresa', empresaId)
            .eq('plataforma', info.dbPlataforma);

          if (contas && contas.length > 0) {
            const { data: cl } = await supabase
              .from('campanha')
              .select('id_campanha, id_campanha_externo, nome')
              .in('id_conta', contas.map((c: any) => c.id_conta));
            campanhasLocaisPorPlataforma[info.dbPlataforma] = cl || [];
          } else {
            campanhasLocaisPorPlataforma[info.dbPlataforma] = [];
          }
        }

        // Montar lista de dias desta página
        const diasPagina: { diaStr: string; diaIso: string }[] = [];
        for (let d = diaOffset; d < endDia; d++) {
          const dia = new Date();
          dia.setDate(dia.getDate() - d);
          diasPagina.push({
            diaStr: dia.toISOString().split('T')[0].replace(/-/g, ''),
            diaIso: dia.toISOString().split('T')[0],
          });
        }

        // Processar em batches paralelos
        let totalDiasSalvos = 0;
        for (let i = 0; i < diasPagina.length; i += PARALLEL_BATCH_SIZE) {
          const batch = diasPagina.slice(i, i + PARALLEL_BATCH_SIZE);
          const salvos = await processDaysBatch(
            batch,
            ['adwords', 'facebookads'],
            config,
            headers,
            campanhasLocaisPorPlataforma,
            supabase,
          );
          totalDiasSalvos += salvos;
        }

        console.log(`  ✅ ${totalDiasSalvos} registros diários salvos (dias ${diaOffset}-${endDia - 1})`);
        resultado.dias_salvos = totalDiasSalvos;

        // ========== Atualizar cursor ==========
        const hasNextPage = endDia < diasLookback;
        resultado.hasNextPage = hasNextPage;
        resultado.dia_offset = endDia;

        const newTotalSynced = (syncStatus?.total_synced || 0) + totalDiasSalvos;

        await supabase
          .from('sync_status')
          .upsert({
            id_empresa: empresaId,
            tipo_sync: syncType,
            last_cursor: { dia_offset: endDia, keywords_done: true },
            total_synced: newTotalSynced,
            status: hasNextPage ? 'running' : 'completed',
            completed_at: hasNextPage ? null : new Date().toISOString(),
          }, { onConflict: 'id_empresa,tipo_sync' });

        resultados.push(resultado);
      } catch (empresaError: any) {
        console.error(`❌ Erro empresa ${empresaId}:`, empresaError.message);

        await supabase
          .from('sync_status')
          .upsert({
            id_empresa: empresaId,
            tipo_sync: syncType,
            status: 'error',
          }, { onConflict: 'id_empresa,tipo_sync' });

        resultados.push({ empresa_id: empresaId, status: "error", error: empresaError.message });
      }
    }

    const duracao = Date.now() - startTime;
    const temErro = resultados.some((r: any) => r.status === "error");
    const hasNextPage = resultados.some((r: any) => r.hasNextPage);

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-campanhas-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find((r: any) => r.status === "error")?.error : null,
      detalhes_execucao: { resultados, hasNextPage },
    });

    console.log(`\n✅ Página concluída em ${duracao}ms — hasNextPage: ${hasNextPage}`);

    return new Response(JSON.stringify({
      message: hasNextPage ? "Página processada, há mais dados" : "Enriquecimento completo",
      duracao_ms: duracao,
      hasNextPage,
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
