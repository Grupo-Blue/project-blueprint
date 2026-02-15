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
  dayStr: string, // YYYYMMDD
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

    console.log(`🚀 Enriquecimento Metricool — SOMENTE dados diários granulares...${filtroEmpresa ? ` (empresa: ${filtroEmpresa})` : ' (todas)'}`);

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

        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        const resultado: any = {
          empresa_id: empresaId,
          dias_salvos: 0,
          keywords: 0,
          status: "success",
        };

        // ============ GOOGLE ADS KEYWORDS ============
        console.log("\n  === GOOGLE ADS KEYWORDS ===");
        let keywordsSalvas = 0;
        try {
          const kwUrl = `${METRICOOL_API_BASE}/stats/adwords/keywords?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
          console.log(`  🔍 Buscando keywords: ${kwUrl}`);
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
              else console.error(`  ❌ Erro upsert keyword "${keyword}": ${error.message}`);
            }

            console.log(`  ✅ Keywords: ${keywords.length} encontradas, ${keywordsSalvas} salvas`);
          } else {
            console.log(`  ⚠️ Keywords retornou ${kwResp.status}`);
          }
        } catch (kwError) {
          console.error(`  ❌ Erro ao buscar keywords:`, kwError);
        }
        resultado.keywords = keywordsSalvas;

        // ============ COLETA DIÁRIA GRANULAR (últimos 30 dias) ============
        // ÚNICA fonte de dados para campanha_metricas_dia
        console.log("\n  === COLETA DIÁRIA GRANULAR (últimos 30 dias) ===");
        let totalDiasSalvos = 0;

        // Pre-fetch campanhas locais por plataforma para evitar queries repetidas
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

        for (let d = 0; d < 30; d++) {
          const dia = new Date();
          dia.setDate(dia.getDate() - d);
          const diaStr = dia.toISOString().split('T')[0].replace(/-/g, '');
          const diaIso = dia.toISOString().split('T')[0];

          for (const platform of ['adwords', 'facebookads'] as AdsPlatform[]) {
            const info = PLATFORM_MAP[platform];
            const campanhasLocais = campanhasLocaisPorPlataforma[info.dbPlataforma];
            if (campanhasLocais.length === 0) continue;

            try {
              const campanhasDia = await fetchAdsCampaignsDay(config, platform, diaStr, headers);

              for (const mc of campanhasDia) {
                if (mc.spent <= 0 && mc.clicks <= 0 && mc.impressions <= 0) continue;

                // Matching flexível: exact ID, exact name, ou partial name match
                const mcNameNorm = (mc.campaignName || '').toLowerCase().trim();
                const local = campanhasLocais.find((c: any) => {
                  if (c.id_campanha_externo === mc.campaignId) return true;
                  const localNorm = (c.nome || '').toLowerCase().trim();
                  if (localNorm && mcNameNorm && localNorm === mcNameNorm) return true;
                  // Partial match: um contém o outro
                  if (localNorm && mcNameNorm && (localNorm.includes(mcNameNorm) || mcNameNorm.includes(localNorm))) return true;
                  return false;
                });

                if (!local) {
                  console.log(`  ⚠️ Campanha Metricool não encontrada localmente: "${mc.campaignName}" (ID: ${mc.campaignId}) - ${info.label}`);
                  continue;
                }

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

                if (!error) totalDiasSalvos++;
                else console.error(`  ❌ Erro upsert dia ${diaIso}: ${error.message}`);
              }
            } catch (err) {
              console.log(`  ⚠️ Erro dia ${diaIso} ${info.label}:`, err);
            }
          }
        }

        console.log(`  ✅ Total registros diários salvos: ${totalDiasSalvos}`);
        resultado.dias_salvos = totalDiasSalvos;

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
      message: "Enriquecimento diário concluído (Google + Meta)",
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
