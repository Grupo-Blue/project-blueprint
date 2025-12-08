import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadPayload {
  evento: string;
  timestamp: string;
  lead_id: string;
  email: string | null;
  empresa: string;
  lead: {
    id: string;
    nome: string | null;
    email: string | null;
    empresa: string;
    id_empresa: string;
    stage_atual: string | null;
    is_mql: boolean;
    levantou_mao: boolean;
    tem_reuniao: boolean;
    reuniao_realizada: boolean;
    venda_realizada: boolean;
    valor_venda: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    origem_tipo: string | null;
    lead_pago: boolean | null;
    mautic: {
      score: number | null;
      page_hits: number | null;
      last_active: string | null;
      first_visit: string | null;
      tags: any;
      segments: any;
      cidade: string | null;
      estado: string | null;
    };
    tokeniza: {
      investidor: boolean | null;
      valor_investido: number | null;
      qtd_investimentos: number | null;
      projetos: any;
      carrinho_abandonado: boolean | null;
      valor_carrinho: number | null;
      projeto_nome: string | null;
    };
    url_pipedrive: string | null;
    data_criacao: string;
    data_atualizacao: string;
    data_mql: string | null;
    data_levantou_mao: string | null;
    data_reuniao: string | null;
    data_venda: string | null;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Disparar Webhook] Iniciando disparo de webhooks...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parâmetros opcionais para disparo imediato de leads específicos
    let body: { lead_ids?: string[], evento?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Buscar leads pendentes de webhook
    let query = supabase
      .from('lead')
      .select(`
        *,
        empresa:id_empresa (nome)
      `)
      .eq('merged', false);

    if (body.lead_ids && body.lead_ids.length > 0) {
      // Disparo imediato de leads específicos
      query = query.in('id_lead', body.lead_ids);
    } else {
      // Buscar leads atualizados nos últimos 15 minutos OU sem webhook enviado
      const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      query = query.or(`webhook_enviado_em.is.null,updated_at.gte.${quinzeMinutosAtras}`);
    }

    const { data: leadsRaw, error: leadsError } = await query.limit(100);

    // Filtrar no código: leads onde updated_at > webhook_enviado_em OU webhook_enviado_em IS NULL
    const leads = body.lead_ids?.length 
      ? leadsRaw 
      : leadsRaw?.filter(lead => 
          !lead.webhook_enviado_em || 
          new Date(lead.updated_at) > new Date(lead.webhook_enviado_em)
        ).slice(0, 50);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`[Disparar Webhook] ${leads?.length || 0} leads para enviar`);

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        leads_enviados: 0,
        message: 'Nenhum lead pendente de webhook'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar destinos de webhook ativos
    const { data: destinos, error: destinosError } = await supabase
      .from('webhook_destino')
      .select('*')
      .eq('ativo', true);

    if (destinosError) {
      throw new Error(`Erro ao buscar destinos: ${destinosError.message}`);
    }

    if (!destinos || destinos.length === 0) {
      console.log('[Disparar Webhook] Nenhum destino de webhook ativo configurado');
      return new Response(JSON.stringify({
        success: true,
        leads_enviados: 0,
        message: 'Nenhum destino de webhook ativo'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let webhooksEnviados = 0;
    let webhooksErros = 0;

    for (const lead of leads) {
      // Mapear eventos para formato esperado pelo destino
      const eventoInterno = body.evento || (lead.webhook_enviado_em ? 'lead_atualizado' : 'lead_criado');
      const mapaEventos: Record<string, string> = {
        'lead_criado': 'LEAD_NOVO',
        'lead_atualizado': 'ATUALIZACAO',
        'enriquecimento': 'ATUALIZACAO'
      };
      const evento = mapaEventos[eventoInterno] || eventoInterno.toUpperCase();
      
      // Montar payload completo
      const payload: LeadPayload = {
        evento,
        timestamp: new Date().toISOString(),
        lead_id: lead.id_lead,
        email: lead.email,
        empresa: lead.empresa?.nome || '',
        lead: {
          id: lead.id_lead,
          nome: lead.nome_lead,
          email: lead.email,
          empresa: lead.empresa?.nome || '',
          id_empresa: lead.id_empresa,
          stage_atual: lead.stage_atual,
          is_mql: lead.is_mql,
          levantou_mao: lead.levantou_mao,
          tem_reuniao: lead.tem_reuniao,
          reuniao_realizada: lead.reuniao_realizada,
          venda_realizada: lead.venda_realizada,
          valor_venda: lead.valor_venda,
          utm_source: lead.utm_source,
          utm_medium: lead.utm_medium,
          utm_campaign: lead.utm_campaign,
          utm_content: lead.utm_content,
          utm_term: lead.utm_term,
          origem_tipo: lead.origem_tipo,
          lead_pago: lead.lead_pago,
          mautic: {
            score: lead.mautic_score,
            page_hits: lead.mautic_page_hits,
            last_active: lead.mautic_last_active,
            first_visit: lead.mautic_first_visit,
            tags: lead.mautic_tags,
            segments: lead.mautic_segments,
            cidade: lead.cidade_mautic,
            estado: lead.estado_mautic
          },
          tokeniza: {
            investidor: lead.tokeniza_investidor,
            valor_investido: lead.tokeniza_valor_investido,
            qtd_investimentos: lead.tokeniza_qtd_investimentos,
            projetos: lead.tokeniza_projetos,
            carrinho_abandonado: lead.tokeniza_carrinho_abandonado,
            valor_carrinho: lead.tokeniza_valor_carrinho,
            projeto_nome: lead.tokeniza_projeto_nome
          },
          url_pipedrive: lead.url_pipedrive,
          data_criacao: lead.data_criacao,
          data_atualizacao: lead.updated_at,
          data_mql: lead.data_mql,
          data_levantou_mao: lead.data_levantou_mao,
          data_reuniao: lead.data_reuniao,
          data_venda: lead.data_venda
        }
      };

      // Enviar para cada destino ativo
      for (const destino of destinos) {
        // Verificar se destino é para empresa específica ou todas
        if (destino.id_empresa && destino.id_empresa !== lead.id_empresa) {
          continue;
        }

        // Verificar se evento está na lista de eventos do destino
        if (destino.eventos && !destino.eventos.includes(evento)) {
          continue;
        }

        try {
          // Preparar headers
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(destino.headers || {})
          };

          // Enviar webhook
          const response = await fetch(destino.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          const statusCode = response.status;
          const resposta = await response.text();

          // Registrar log
          await supabase.from('lead_webhook_log').insert({
            id_lead: lead.id_lead,
            id_webhook_destino: destino.id,
            evento,
            payload,
            status: statusCode >= 200 && statusCode < 300 ? 'enviado' : 'erro',
            status_code: statusCode,
            resposta: resposta.substring(0, 1000) // Limitar tamanho da resposta
          });

          if (statusCode >= 200 && statusCode < 300) {
            webhooksEnviados++;
            console.log(`[Webhook] Lead ${lead.id_lead} enviado para ${destino.nome} - ${statusCode}`);
          } else {
            webhooksErros++;
            console.error(`[Webhook] Erro ao enviar lead ${lead.id_lead} para ${destino.nome} - ${statusCode}`);
          }
        } catch (sendError) {
          webhooksErros++;
          console.error(`[Webhook] Erro ao enviar para ${destino.nome}:`, sendError);

          // Registrar erro no log
          await supabase.from('lead_webhook_log').insert({
            id_lead: lead.id_lead,
            id_webhook_destino: destino.id,
            evento,
            payload,
            status: 'erro',
            resposta: sendError instanceof Error ? sendError.message : String(sendError)
          });
        }
      }

      // Atualizar webhook_enviado_em no lead
      await supabase
        .from('lead')
        .update({ webhook_enviado_em: new Date().toISOString() })
        .eq('id_lead', lead.id_lead);
    }

    const duracao = Date.now() - startTime;

    // Registrar execução do cronjob (apenas se não for disparo imediato)
    if (!body.lead_ids) {
      await supabase.from('cronjob_execucao').insert({
        nome_cronjob: 'disparar-webhook-leads',
        status: webhooksErros > 0 && webhooksEnviados === 0 ? 'erro' : 'sucesso',
        duracao_ms: duracao,
        detalhes_execucao: {
          leads_processados: leads.length,
          webhooks_enviados: webhooksEnviados,
          webhooks_erros: webhooksErros,
          destinos_ativos: destinos.length
        }
      });
    }

    console.log(`[Disparar Webhook] Concluído em ${duracao}ms - ${webhooksEnviados} enviados, ${webhooksErros} erros`);

    return new Response(JSON.stringify({
      success: true,
      leads_processados: leads.length,
      webhooks_enviados: webhooksEnviados,
      webhooks_erros: webhooksErros,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    console.error('[Disparar Webhook] Erro:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
