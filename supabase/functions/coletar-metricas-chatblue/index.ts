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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar integrações Chatblue ativas (usa tipo CHATWOOT do enum)
    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'CHATWOOT')
      .eq('ativo', true);

    if (intError) throw intError;
    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma integração Chatblue ativa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const apiUrl = config.api_url;
      // Priorizar secret do ambiente, fallback para config_json
      const apiToken = Deno.env.get('CHATBLUE_API_TOKEN') || config.api_token;

      if (!apiUrl || !apiToken) {
        resultados.push({ integracao: integracao.id_integracao, error: 'api_url ou api_token não configurado' });
        continue;
      }

      // Buscar empresas mapeadas
      const empresas = config.empresas || [];
      if (empresas.length === 0) {
        resultados.push({ integracao: integracao.id_integracao, error: 'Nenhuma empresa mapeada' });
        continue;
      }

      for (const empresaMapping of empresas) {
        const idEmpresa = empresaMapping.id_empresa;
        const companyId = empresaMapping.company_id;

        try {
          // Coletar métricas do dashboard
          const metricsUrl = `${apiUrl}/external/metrics${companyId ? `?companyId=${companyId}` : ''}`;
          console.log(`[Chatblue Metrics] Coletando de: ${metricsUrl}`);

          const metricsResponse = await fetch(metricsUrl, {
            headers: {
              'X-API-Key': apiToken,
              'Content-Type': 'application/json',
            },
          });

          if (!metricsResponse.ok) {
            const errText = await metricsResponse.text();
            resultados.push({
              integracao: integracao.id_integracao,
              empresa: idEmpresa,
              error: `Erro ${metricsResponse.status}: ${errText}`,
            });
            continue;
          }

          const metricsData = await metricsResponse.json();
          console.log(`[Chatblue Metrics] Dados recebidos:`, JSON.stringify(metricsData));

          // Upsert métricas na tabela
          const hoje = new Date().toISOString().split('T')[0];

          const metricasRow = {
            id_empresa: idEmpresa,
            data: hoje,
            tickets_total: metricsData.ticketsTotal || metricsData.total || 0,
            tickets_pendentes: metricsData.ticketsPending || metricsData.pending || 0,
            tickets_resolvidos: metricsData.ticketsResolved || metricsData.resolved || 0,
            tickets_sla_violado: metricsData.ticketsSlaBreached || metricsData.slaBreached || 0,
            tickets_ia: metricsData.ticketsAI || metricsData.aiHandled || 0,
            tempo_resposta_medio_seg: metricsData.avgResponseTime || metricsData.responseTime || null,
            tempo_resolucao_medio_seg: metricsData.avgResolutionTime || metricsData.resolutionTime || null,
            sla_compliance: metricsData.slaCompliance || null,
            nps_score: metricsData.npsScore || metricsData.nps || null,
            dados_departamentos: metricsData.departments || metricsData.departamentos || null,
          };

          const { error: upsertError } = await supabase
            .from('metricas_atendimento')
            .upsert(metricasRow, { onConflict: 'id_empresa,data' });

          if (upsertError) {
            console.error(`[Chatblue Metrics] Erro ao salvar métricas:`, upsertError);
            resultados.push({
              integracao: integracao.id_integracao,
              empresa: idEmpresa,
              error: upsertError.message,
            });
          } else {
            console.log(`[Chatblue Metrics] Métricas salvas para empresa ${idEmpresa}`);
            resultados.push({
              integracao: integracao.id_integracao,
              empresa: idEmpresa,
              success: true,
              metricas: metricasRow,
            });
          }
        } catch (empresaError) {
          console.error(`[Chatblue Metrics] Erro para empresa ${idEmpresa}:`, empresaError);
          resultados.push({
            integracao: integracao.id_integracao,
            empresa: idEmpresa,
            error: empresaError instanceof Error ? empresaError.message : 'Erro desconhecido',
          });
        }
      }
    }

    // Registrar execução do cronjob
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-metricas-chatblue',
      status: resultados.some(r => r.error) ? 'parcial' : 'sucesso',
      detalhes_execucao: { resultados },
    });

    return new Response(JSON.stringify({
      success: true,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Chatblue Metrics] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
