import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'id_empresa é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar dados da empresa
    const { data: empresa } = await supabase
      .from('empresa')
      .select('nome')
      .eq('id_empresa', id_empresa)
      .single();

    // Buscar métricas agregadas dos últimos 30 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);

    const { data: metricas } = await supabase
      .from('landingpage_metricas')
      .select('*')
      .eq('id_empresa', id_empresa)
      .gte('data', dataInicio.toISOString().split('T')[0]);

    // Buscar conteúdo das LPs
    const { data: conteudos } = await supabase
      .from('landingpage_conteudo')
      .select('*')
      .eq('id_empresa', id_empresa);

    if (!metricas || metricas.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Nenhuma métrica encontrada para análise' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Agregar métricas por URL
    const metricasPorUrl = new Map<string, {
      sessoes: number;
      conversoes: number;
      bounce_rate_sum: number;
      bounce_count: number;
      tempo_total: number;
      dias: number;
    }>();

    for (const m of metricas) {
      const existing = metricasPorUrl.get(m.url) || {
        sessoes: 0, conversoes: 0, bounce_rate_sum: 0, bounce_count: 0, tempo_total: 0, dias: 0
      };
      existing.sessoes += m.sessoes || 0;
      existing.conversoes += m.conversoes || 0;
      if (m.bounce_rate !== null) {
        existing.bounce_rate_sum += m.bounce_rate;
        existing.bounce_count++;
      }
      existing.tempo_total += m.tempo_medio_segundos || 0;
      existing.dias++;
      metricasPorUrl.set(m.url, existing);
    }

    // Calcular métricas finais e combinar com conteúdo
    const lpsAnalisadas = Array.from(metricasPorUrl.entries()).map(([url, m]) => {
      const conteudo = conteudos?.find(c => c.url === url);
      return {
        url,
        sessoes_total: m.sessoes,
        conversoes_total: m.conversoes,
        taxa_conversao: m.sessoes > 0 ? ((m.conversoes / m.sessoes) * 100).toFixed(2) : '0.00',
        bounce_rate_medio: m.bounce_count > 0 ? (m.bounce_rate_sum / m.bounce_count).toFixed(2) : null,
        tempo_medio: m.dias > 0 ? (m.tempo_total / m.dias).toFixed(0) : null,
        h1: conteudo?.titulo_h1 || null,
        h2s: conteudo?.subtitulos_h2 || [],
        ctas: conteudo?.ctas || [],
        primeiro_paragrafo: conteudo?.primeiro_paragrafo || null,
        meta_description: conteudo?.meta_description || null
      };
    }).sort((a, b) => b.sessoes_total - a.sessoes_total);

    // Identificar top e bottom performers
    const topPerformers = [...lpsAnalisadas]
      .filter(lp => lp.sessoes_total >= 10)
      .sort((a, b) => parseFloat(b.taxa_conversao) - parseFloat(a.taxa_conversao))
      .slice(0, 5);

    const bottomPerformers = [...lpsAnalisadas]
      .filter(lp => lp.sessoes_total >= 10)
      .sort((a, b) => parseFloat(a.taxa_conversao) - parseFloat(b.taxa_conversao))
      .slice(0, 5);

    // Preparar contexto para IA
    const contexto = {
      empresa: empresa?.nome || 'Empresa',
      periodo: '30 dias',
      total_lps: lpsAnalisadas.length,
      total_sessoes: lpsAnalisadas.reduce((s, lp) => s + lp.sessoes_total, 0),
      total_conversoes: lpsAnalisadas.reduce((s, lp) => s + lp.conversoes_total, 0),
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      todas_lps: lpsAnalisadas.slice(0, 20) // Limitar para não exceder tokens
    };

    const prompt = `Você é um especialista em CRO (Conversion Rate Optimization) e copywriting.
Analise os dados de performance das landing pages abaixo e identifique padrões nos elementos de copy que correlacionam com melhores taxas de conversão.

CONTEXTO:
- Empresa: ${contexto.empresa}
- Período: ${contexto.periodo}
- Total de Landing Pages: ${contexto.total_lps}
- Total de Sessões: ${contexto.total_sessoes}
- Total de Conversões: ${contexto.total_conversoes}

TOP 5 LANDING PAGES (maior conversão):
${JSON.stringify(contexto.top_performers, null, 2)}

BOTTOM 5 LANDING PAGES (menor conversão):
${JSON.stringify(contexto.bottom_performers, null, 2)}

TODAS AS LANDING PAGES (amostra):
${JSON.stringify(contexto.todas_lps, null, 2)}

Analise e retorne insights sobre:
1. Padrões de headlines (H1) que correlacionam com alta conversão
2. Padrões de subtítulos (H2) que funcionam melhor
3. CTAs mais efetivos
4. Diferenças de bounce rate e tempo na página
5. Recomendações específicas para melhorar as páginas de baixa performance`;

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em CRO e copywriting. Responda em português.' },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analisar_landing_pages',
            description: 'Retorna análise estruturada das landing pages',
            parameters: {
              type: 'object',
              properties: {
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      categoria: { type: 'string', description: 'Categoria do insight (headlines, ctas, bounce, tempo, etc)' },
                      descoberta: { type: 'string', description: 'O que foi descoberto na análise' },
                      impacto: { type: 'string', enum: ['alto', 'medio', 'baixo'] }
                    },
                    required: ['categoria', 'descoberta', 'impacto']
                  }
                },
                recomendacoes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      pagina: { type: 'string', description: 'URL ou nome da página' },
                      acao: { type: 'string', description: 'Ação recomendada' },
                      prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] }
                    },
                    required: ['pagina', 'acao', 'prioridade']
                  }
                },
                padroes_sucesso: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      elemento: { type: 'string', description: 'Elemento de copy (headline, cta, etc)' },
                      padrao: { type: 'string', description: 'Padrão identificado' },
                      exemplos: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['elemento', 'padrao']
                  }
                },
                analise_geral: { type: 'string', description: 'Resumo geral da análise' }
              },
              required: ['insights', 'recomendacoes', 'padroes_sucesso', 'analise_geral']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analisar_landing_pages' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit excedido, tente novamente em alguns minutos' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Extrair resultado da função
    let analise;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analise = JSON.parse(toolCall.function.arguments);
      } else {
        throw new Error('Resposta da IA não contém análise estruturada');
      }
    } catch (parseError) {
      console.error('Erro ao parsear resposta da IA:', parseError);
      analise = {
        insights: [],
        recomendacoes: [],
        padroes_sucesso: [],
        analise_geral: aiData.choices?.[0]?.message?.content || 'Análise não disponível'
      };
    }

    // Salvar análise
    const { error: insertError } = await supabase
      .from('landingpage_analise')
      .insert({
        id_empresa,
        insights: analise.insights || [],
        recomendacoes: analise.recomendacoes || [],
        top_performers: topPerformers,
        padroes_identificados: analise.padroes_sucesso || [],
        analise_texto: analise.analise_geral
      });

    if (insertError) {
      console.error('Erro ao salvar análise:', insertError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      analise: {
        ...analise,
        top_performers: topPerformers,
        bottom_performers: bottomPerformers,
        metricas_gerais: {
          total_lps: contexto.total_lps,
          total_sessoes: contexto.total_sessoes,
          total_conversoes: contexto.total_conversoes,
          taxa_conversao_geral: contexto.total_sessoes > 0 
            ? ((contexto.total_conversoes / contexto.total_sessoes) * 100).toFixed(2)
            : '0.00'
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
