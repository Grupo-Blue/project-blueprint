import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de categorias de jornada por padrões de URL
const categorizarJornada = (url: string): string => {
  const urlLower = url.toLowerCase();
  
  // Tokeniza - Categorias específicas
  if (urlLower.includes('captador') || urlLower.includes('parceiro')) {
    return 'captador';
  }
  if (urlLower.includes('crowdfunding') || urlLower.includes('oferta') || urlLower.includes('investimento') || urlLower.includes('investir')) {
    return 'investidor';
  }
  if (urlLower.includes('login') || urlLower.includes('account') || urlLower.includes('dashboard') || urlLower.includes('minha-conta')) {
    return 'plataforma';
  }
  if (urlLower.includes('lp-') || urlLower.includes('landing')) {
    return 'prospect';
  }
  
  // Blue - Categorias específicas
  if (urlLower.includes('ir-cripto') || urlLower.includes('imposto') || urlLower.includes('declaracao')) {
    return 'cliente_ir';
  }
  if (urlLower.includes('consultoria') || urlLower.includes('assessoria')) {
    return 'cliente_consultoria';
  }
  
  // Padrão
  if (urlLower === '/' || urlLower === '') {
    return 'home';
  }
  
  return 'outros';
};

// Calcular score de engajamento baseado em métricas GA4
const calcularEngajamentoScore = (
  tempoMedio: number | null,
  bounceRate: number | null,
  taxaConversao: number | null
): number => {
  let score = 50; // Base
  
  // Tempo médio (0-30 pontos)
  if (tempoMedio !== null) {
    if (tempoMedio > 180) score += 30;      // > 3 min = excelente
    else if (tempoMedio > 120) score += 25; // > 2 min = muito bom
    else if (tempoMedio > 60) score += 20;  // > 1 min = bom
    else if (tempoMedio > 30) score += 10;  // > 30s = ok
    else score -= 10;                        // < 30s = ruim
  }
  
  // Bounce rate (0-30 pontos, inverso)
  if (bounceRate !== null) {
    if (bounceRate < 20) score += 30;       // < 20% = excelente
    else if (bounceRate < 40) score += 20;  // < 40% = bom
    else if (bounceRate < 60) score += 10;  // < 60% = ok
    else if (bounceRate > 80) score -= 20;  // > 80% = muito ruim
  }
  
  // Taxa de conversão (0-20 pontos)
  if (taxaConversao !== null) {
    if (taxaConversao > 50) score += 20;     // > 50% = excepcional
    else if (taxaConversao > 20) score += 15; // > 20% = excelente
    else if (taxaConversao > 10) score += 10; // > 10% = bom
    else if (taxaConversao > 5) score += 5;   // > 5% = ok
  }
  
  return Math.max(0, Math.min(100, score));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { id_empresa, limit = 500 } = await req.json();

    if (!id_empresa) {
      return new Response(
        JSON.stringify({ error: 'id_empresa é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[enriquecer-leads-ga4] Iniciando para empresa ${id_empresa}`);

    // Buscar métricas agregadas de LPs dos últimos 30 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);

    const { data: metricas, error: metricasError } = await supabase
      .from('landingpage_metricas')
      .select('url, sessoes, conversoes, taxa_conversao, bounce_rate, tempo_medio_segundos')
      .eq('id_empresa', id_empresa)
      .gte('data', dataInicio.toISOString().split('T')[0]);

    if (metricasError) {
      console.error('[enriquecer-leads-ga4] Erro ao buscar métricas:', metricasError);
      throw metricasError;
    }

    // Agregar métricas por URL
    const metricasAgregadas: Record<string, {
      sessoes: number;
      conversoes: number;
      tempoTotal: number;
      bounceTotal: number;
      contagem: number;
    }> = {};

    for (const m of metricas || []) {
      const url = m.url.toLowerCase();
      if (!metricasAgregadas[url]) {
        metricasAgregadas[url] = { sessoes: 0, conversoes: 0, tempoTotal: 0, bounceTotal: 0, contagem: 0 };
      }
      metricasAgregadas[url].sessoes += m.sessoes || 0;
      metricasAgregadas[url].conversoes += m.conversoes || 0;
      metricasAgregadas[url].tempoTotal += (m.tempo_medio_segundos || 0) * (m.sessoes || 1);
      metricasAgregadas[url].bounceTotal += (m.bounce_rate || 0) * (m.sessoes || 1);
      metricasAgregadas[url].contagem++;
    }

    // Calcular médias
    const metricasPorUrl: Record<string, {
      sessoes: number;
      taxaConversao: number;
      tempoMedio: number;
      bounceRate: number;
    }> = {};

    for (const [url, dados] of Object.entries(metricasAgregadas)) {
      metricasPorUrl[url] = {
        sessoes: dados.sessoes,
        taxaConversao: dados.sessoes > 0 ? (dados.conversoes / dados.sessoes) * 100 : 0,
        tempoMedio: dados.sessoes > 0 ? dados.tempoTotal / dados.sessoes : 0,
        bounceRate: dados.sessoes > 0 ? dados.bounceTotal / dados.sessoes : 0,
      };
    }

    console.log(`[enriquecer-leads-ga4] ${Object.keys(metricasPorUrl).length} URLs com métricas`);

    // Buscar leads sem enriquecimento GA4
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, utm_campaign, utm_content, utm_source, utm_medium')
      .eq('id_empresa', id_empresa)
      .is('ga4_categoria_jornada', null)
      .limit(limit);

    if (leadsError) {
      console.error('[enriquecer-leads-ga4] Erro ao buscar leads:', leadsError);
      throw leadsError;
    }

    console.log(`[enriquecer-leads-ga4] ${leads?.length || 0} leads para enriquecer`);

    let enriquecidos = 0;
    let semMatch = 0;

    for (const lead of leads || []) {
      // Tentar encontrar LP correspondente
      let matchedUrl: string | null = null;
      let matchedMetricas = null;

      // Estratégia 1: Buscar por utm_content (pode conter path da LP)
      if (lead.utm_content) {
        const contentLower = lead.utm_content.toLowerCase();
        for (const [url, dados] of Object.entries(metricasPorUrl)) {
          if (url.includes(contentLower) || contentLower.includes(url.replace('/', ''))) {
            matchedUrl = url;
            matchedMetricas = dados;
            break;
          }
        }
      }

      // Estratégia 2: Buscar por utm_campaign
      if (!matchedUrl && lead.utm_campaign) {
        const campaignLower = lead.utm_campaign.toLowerCase();
        for (const [url, dados] of Object.entries(metricasPorUrl)) {
          // Match parcial em nome da campanha com URL
          if (url.includes(campaignLower.split('_')[0]) || url.includes(campaignLower.split('-')[0])) {
            matchedUrl = url;
            matchedMetricas = dados;
            break;
          }
        }
      }

      // Estratégia 3: Usar homepage se tem UTM source de ads
      if (!matchedUrl && (lead.utm_source === 'facebook' || lead.utm_source === 'google' || lead.utm_source === 'instagram')) {
        // Usar métricas agregadas de todas as LPs de tráfego pago
        let totalSessoes = 0;
        let totalTempo = 0;
        let totalBounce = 0;
        let totalConversao = 0;
        let count = 0;

        for (const [url, dados] of Object.entries(metricasPorUrl)) {
          if (url.includes('lp-') || url.includes('oferta') || url.includes('landing')) {
            totalSessoes += dados.sessoes;
            totalTempo += dados.tempoMedio * dados.sessoes;
            totalBounce += dados.bounceRate * dados.sessoes;
            totalConversao += dados.taxaConversao * dados.sessoes;
            count++;
          }
        }

        if (count > 0 && totalSessoes > 0) {
          matchedMetricas = {
            sessoes: totalSessoes,
            tempoMedio: totalTempo / totalSessoes,
            bounceRate: totalBounce / totalSessoes,
            taxaConversao: totalConversao / totalSessoes,
          };
          matchedUrl = 'agregado_lps';
        }
      }

      // Determinar categoria de jornada baseada em UTMs
      let categoriaJornada = 'outros';
      if (lead.utm_content) {
        categoriaJornada = categorizarJornada(lead.utm_content);
      } else if (lead.utm_campaign) {
        categoriaJornada = categorizarJornada(lead.utm_campaign);
      } else if (lead.utm_source) {
        // Inferir por source
        if (lead.utm_source === 'facebook' || lead.utm_source === 'instagram') {
          categoriaJornada = 'prospect';
        } else if (lead.utm_source === 'google') {
          categoriaJornada = 'prospect';
        } else if (lead.utm_source === 'email' || lead.utm_source === 'mautic') {
          categoriaJornada = 'engajado';
        }
      }

      // Calcular score e preparar update
      const updateData: Record<string, any> = {
        ga4_categoria_jornada: categoriaJornada,
      };

      if (matchedMetricas) {
        updateData.ga4_landing_page = matchedUrl;
        updateData.ga4_tempo_site_segundos = matchedMetricas.tempoMedio;
        updateData.ga4_bounce_rate = matchedMetricas.bounceRate;
        updateData.ga4_sessoes = matchedMetricas.sessoes;
        updateData.ga4_engajamento_score = calcularEngajamentoScore(
          matchedMetricas.tempoMedio,
          matchedMetricas.bounceRate,
          matchedMetricas.taxaConversao
        );
        enriquecidos++;
      } else {
        // Mesmo sem match de métricas, salvamos a categoria
        updateData.ga4_engajamento_score = 50; // Score neutro
        semMatch++;
      }

      const { error: updateError } = await supabase
        .from('lead')
        .update(updateData)
        .eq('id_lead', lead.id_lead);

      if (updateError) {
        console.error(`[enriquecer-leads-ga4] Erro ao atualizar lead ${lead.id_lead}:`, updateError);
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`[enriquecer-leads-ga4] Concluído: ${enriquecidos} enriquecidos, ${semMatch} sem match de métricas, ${duracao}ms`);

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-leads-ga4',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        id_empresa,
        total_leads: leads?.length || 0,
        enriquecidos,
        sem_match: semMatch,
        urls_com_metricas: Object.keys(metricasPorUrl).length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: leads?.length || 0,
        enriquecidos,
        sem_match: semMatch,
        urls_com_metricas: Object.keys(metricasPorUrl).length,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enriquecer-leads-ga4] Erro:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
