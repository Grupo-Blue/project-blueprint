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

/**
 * Tenta buscar métricas por anúncio no Metricool.
 * Se o endpoint /ads existir, retorna dados granulares por ad.
 * Caso contrário, retorna null para fallback via distribuição proporcional.
 */
async function fetchAdsMetrics(
  config: MetricoolConfig,
  platform: 'facebookads' | 'adwords',
  dayStr: string,
  headers: Record<string, string>,
): Promise<any[] | null> {
  const url = `${METRICOOL_API_BASE}/stats/${platform}/ads?blogId=${config.blog_id}&userId=${config.user_id}&start=${dayStr}&end=${dayStr}`;

  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      if (resp.status === 404) return null; // endpoint não existe
      return null;
    }
    const data = await resp.json();
    return Array.isArray(data) ? data : data.ads || data.data || null;
  } catch {
    return null;
  }
}

/**
 * Busca métricas de campanha e distribui proporcionalmente entre criativos
 * com base nas impressões já coletadas pelo coletor nativo.
 */
async function distribuirMetricasCampanha(
  supabase: any,
  campanhaId: string,
  diaIso: string,
  metricasCampanha: { alcance: number; frequencia: number; conversoes: number; valor_conversao: number },
) {
  // Buscar criativos da campanha com métricas neste dia
  const { data: criativosMetricas } = await supabase
    .from("criativo_metricas_dia")
    .select("id_criativo, impressoes")
    .eq("data", diaIso)
    .gt("impressoes", 0);

  if (!criativosMetricas || criativosMetricas.length === 0) return 0;

  // Filtrar apenas criativos desta campanha
  const { data: criativosCampanha } = await supabase
    .from("criativo")
    .select("id_criativo")
    .eq("id_campanha", campanhaId);

  const idsValidos = new Set((criativosCampanha || []).map((c: any) => c.id_criativo));
  const criativosFiltrados = criativosMetricas.filter((m: any) => idsValidos.has(m.id_criativo));

  if (criativosFiltrados.length === 0) return 0;

  const totalImpressoes = criativosFiltrados.reduce((s: number, c: any) => s + (c.impressoes || 0), 0);
  if (totalImpressoes === 0) return 0;

  let atualizados = 0;

  for (const cm of criativosFiltrados) {
    const proporcao = cm.impressoes / totalImpressoes;
    const alcanceProporcional = Math.round(metricasCampanha.alcance * proporcao);

    // Atualizar apenas se o criativo não tem alcance preenchido
    const { error } = await supabase
      .from("criativo_metricas_dia")
      .update({
        alcance: alcanceProporcional,
        frequencia: metricasCampanha.frequencia, // frequência é mesma para todos
      })
      .eq("id_criativo", cm.id_criativo)
      .eq("data", diaIso)
      .or("alcance.is.null,alcance.eq.0");

    if (!error) atualizados++;
  }

  return atualizados;
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
    console.log("🎯 Enriquecendo criativos com dados Metricool...");

    const body = await req.json().catch(() => ({}));
    const diasRetroativos = body.dias || 7; // Últimos 7 dias por padrão

    const { data: integracoes } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ message: "Sem integrações Metricool", processadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalAtualizados = 0;
    let tentouEndpointAds = false;
    let endpointAdsDisponivel = false;

    for (const integracao of integracoes) {
      const config = integracao.config_json as MetricoolConfig;
      const empresaId = integracao.id_empresa;

      const headers = {
        'X-Mc-Auth': config.user_token,
        'Content-Type': 'application/json',
      };

      // Buscar campanhas da empresa com métricas Metricool
      const { data: contas } = await supabase
        .from('conta_anuncio')
        .select('id_conta, plataforma')
        .eq('id_empresa', empresaId);

      if (!contas || contas.length === 0) continue;

      const { data: campanhas } = await supabase
        .from('campanha')
        .select('id_campanha, id_campanha_externo, nome, id_conta')
        .eq('ativa', true)
        .in('id_conta', contas.map((c: any) => c.id_conta));

      if (!campanhas || campanhas.length === 0) continue;

      // Tentar endpoint /ads uma vez para verificar disponibilidade
      if (!tentouEndpointAds) {
        const hoje = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const adsResult = await fetchAdsMetrics(config, 'facebookads', hoje, headers);
        tentouEndpointAds = true;
        endpointAdsDisponivel = adsResult !== null;
        console.log(`  📊 Endpoint /ads Metricool: ${endpointAdsDisponivel ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL (usando fallback proporcional)'}`);
      }

      // Processar últimos N dias
      for (let d = 0; d < diasRetroativos; d++) {
        const dia = new Date();
        dia.setDate(dia.getDate() - d);
        const diaIso = dia.toISOString().split('T')[0];

        if (endpointAdsDisponivel) {
          // TODO: processar dados granulares do endpoint /ads quando disponível
          // Por enquanto, fallback para distribuição proporcional
        }

        // Fallback: distribuir métricas de campanha proporcionalmente
        for (const campanha of campanhas) {
          // Buscar métricas da campanha neste dia
          const { data: metricaDia } = await supabase
            .from('campanha_metricas_dia')
            .select('alcance, frequencia, conversoes, valor_conversao')
            .eq('id_campanha', campanha.id_campanha)
            .eq('data', diaIso)
            .maybeSingle();

          if (!metricaDia || (!metricaDia.alcance && !metricaDia.frequencia)) continue;

          const atualizados = await distribuirMetricasCampanha(
            supabase,
            campanha.id_campanha,
            diaIso,
            {
              alcance: metricaDia.alcance || 0,
              frequencia: metricaDia.frequencia || 0,
              conversoes: metricaDia.conversoes || 0,
              valor_conversao: metricaDia.valor_conversao || 0,
            },
          );

          totalAtualizados += atualizados;
        }
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`✅ Criativos enriquecidos: ${totalAtualizados} registros em ${(duracao / 1000).toFixed(1)}s`);

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-criativos-metricool',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: { total_atualizados: totalAtualizados, endpoint_ads: endpointAdsDisponivel },
    });

    return new Response(JSON.stringify({
      success: true,
      total_atualizados: totalAtualizados,
      endpoint_ads_disponivel: endpointAdsDisponivel,
      duracao_ms: duracao,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-criativos-metricool',
      status: 'erro',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
