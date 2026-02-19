import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Investimento individual detalhado
interface InvestimentoDetalhe {
  oferta_nome: string;
  oferta_id: string;
  valor: number;
  data: string;
  status: string;
  tipo: 'crowdfunding' | 'venda';
}

// Payload no formato esperado pelo SDR IA
interface SDRPayload {
  lead_id: string;
  evento: 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
  empresa: 'TOKENIZA' | 'BLUE';
  timestamp: string;
  score_temperatura: number;
  prioridade: 'URGENTE' | 'QUENTE' | 'MORNO' | 'FRIO';
  dados_lead: {
    nome: string;
    email: string;
    telefone?: string;
    pipedrive_deal_id?: string;
    url_pipedrive?: string;
    organizacao?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    origem_tipo?: string;
    lead_pago?: boolean;
    score: number;
    stage: string;
    data_criacao?: string;
    data_mql?: string;
    data_levantou_mao?: string;
    data_reuniao?: string;
    data_venda?: string;
    valor_venda?: number;
  };
  dados_linkedin?: {
    url?: string;
    cargo?: string;
    empresa?: string;
    setor?: string;
    senioridade?: string;
    conexoes?: number;
  };
  dados_tokeniza?: {
    valor_investido: number;
    qtd_investimentos: number;
    qtd_projetos: number;
    projetos?: string[];
    ultimo_investimento_em?: string;
    carrinho_abandonado?: boolean;
    valor_carrinho?: number;
    investimentos?: InvestimentoDetalhe[];
  };
  dados_blue?: {
    qtd_compras_ir: number;
    ticket_medio: number;
    score_mautic: number;
    cliente_status?: string;
    plano_atual?: string;
  };
  dados_mautic?: {
    contact_id?: string;
    score?: number;
    page_hits?: number;
    last_active?: string;
    first_visit?: string;
    tags?: unknown;
    segments?: unknown;
    cidade?: string;
    estado?: string;
  };
  dados_chatwoot?: {
    contact_id?: number;
    conversas_total?: number;
    mensagens_total?: number;
    ultima_conversa?: string;
    status_atendimento?: string;
    tempo_resposta_medio?: number;
    agente_atual?: string;
    inbox?: string;
  };
  dados_notion?: {
    cliente_id?: string;
    cliente_status?: string;
  };
  event_metadata?: {
    oferta_id?: string;
    valor_simulado?: number;
    pagina_visitada?: string;
    tipo_compra?: string;
  };
}

// IDs das empresas
const TOKENIZA_ID = '61b5ffeb-fbbc-47c1-8ced-152bb647ed20';

function getPrioridade(score: number): 'URGENTE' | 'QUENTE' | 'MORNO' | 'FRIO' {
  if (score >= 120) return 'URGENTE';
  if (score >= 70) return 'QUENTE';
  if (score >= 30) return 'MORNO';
  return 'FRIO';
}

// Buscar mapa de nomes de projetos Tokeniza (project_id -> nome)
async function buscarMapaProjetos(supabase: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('tokeniza_projeto')
    .select('project_id, nome');

  const mapa = new Map<string, string>();
  if (error || !data) {
    console.error('[Webhook] Erro ao buscar mapa de projetos:', error?.message);
    return mapa;
  }
  for (const p of data) {
    if (p.project_id && p.nome) mapa.set(p.project_id, p.nome);
  }
  console.log(`[Webhook] Mapa de projetos carregado: ${mapa.size} projetos`);
  return mapa;
}

// Buscar investimentos detalhados de um lead Tokeniza
async function buscarInvestimentosDetalhados(
  supabase: ReturnType<typeof createClient>,
  tokenizaUserId: string,
  mapaProjetos: Map<string, string>
): Promise<InvestimentoDetalhe[]> {
  const investimentos: InvestimentoDetalhe[] = [];

  // 1. Crowdfunding (tokeniza_investimento) - apenas pagos
  const { data: crowdfundings, error: errCrowd } = await supabase
    .from('tokeniza_investimento')
    .select('project_id, amount, status, was_paid, data_criacao')
    .eq('user_id_tokeniza', tokenizaUserId)
    .or('status.eq.FINISHED,status.eq.PAID,was_paid.eq.true');

  if (errCrowd) {
    console.error(`[Webhook] Erro ao buscar investimentos crowdfunding para ${tokenizaUserId}:`, errCrowd.message);
  } else if (crowdfundings) {
    for (const inv of crowdfundings) {
      investimentos.push({
        oferta_nome: mapaProjetos.get(inv.project_id) || inv.project_id || 'Projeto desconhecido',
        oferta_id: inv.project_id || '',
        valor: Number(inv.amount) || 0,
        data: inv.data_criacao || '',
        status: inv.status || 'PAID',
        tipo: 'crowdfunding'
      });
    }
  }

  // 2. Vendas (tokeniza_venda) - apenas pagas
  const { data: vendas, error: errVendas } = await supabase
    .from('tokeniza_venda')
    .select('store_id, total_amount, status, data_criacao')
    .eq('user_id_tokeniza', tokenizaUserId)
    .eq('was_paid', true);

  if (errVendas) {
    console.error(`[Webhook] Erro ao buscar vendas para ${tokenizaUserId}:`, errVendas.message);
  } else if (vendas) {
    for (const v of vendas) {
      investimentos.push({
        oferta_nome: mapaProjetos.get(v.store_id) || v.store_id || 'Venda direta',
        oferta_id: v.store_id || '',
        valor: Number(v.total_amount) || 0,
        data: v.data_criacao || '',
        status: v.status || 'PAID',
        tipo: 'venda'
      });
    }
  }

  // Ordenar por data (mais recente primeiro)
  investimentos.sort((a, b) => {
    if (!a.data) return 1;
    if (!b.data) return -1;
    return new Date(b.data).getTime() - new Date(a.data).getTime();
  });

  return investimentos;
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
      query = query.in('id_lead', body.lead_ids);
    } else {
      const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      query = query
        .gte('score_temperatura', 70)
        .or(`webhook_enviado_em.is.null,updated_at.gte.${quinzeMinutosAtras}`);
    }

    const { data: leadsRaw, error: leadsError } = await query.limit(100);

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

    // Carregar mapa de projetos Tokeniza (uma única vez)
    const temLeadsTokeniza = leads.some(l => l.id_empresa === TOKENIZA_ID);
    const mapaProjetos = temLeadsTokeniza ? await buscarMapaProjetos(supabase) : new Map<string, string>();

    let webhooksEnviados = 0;
    let webhooksErros = 0;

    for (const lead of leads) {
      const scoreTemperatura = lead.score_temperatura || 0;
      const prioridade = getPrioridade(scoreTemperatura);

      const empresaSDR: 'TOKENIZA' | 'BLUE' = lead.id_empresa === TOKENIZA_ID ? 'TOKENIZA' : 'BLUE';
      
      let evento: SDRPayload['evento'] = 'ATUALIZACAO';
      
      if (body.evento) {
        const eventoUpper = body.evento.toUpperCase();
        if (['LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'].includes(eventoUpper)) {
          evento = eventoUpper as SDRPayload['evento'];
        }
      } else if (!lead.webhook_enviado_em) {
        evento = 'LEAD_NOVO';
      } else if (lead.tokeniza_carrinho_abandonado) {
        evento = 'CARRINHO_ABANDONADO';
      } else if (lead.is_mql) {
        evento = 'MQL';
      }
      
      const payload: SDRPayload = {
        lead_id: lead.id_lead,
        evento,
        empresa: empresaSDR,
        timestamp: new Date().toISOString(),
        score_temperatura: scoreTemperatura,
        prioridade,
        dados_lead: {
          nome: lead.nome_lead || 'Não informado',
          email: lead.email || 'nao-informado@placeholder.com',
          telefone: lead.telefone || undefined,
          pipedrive_deal_id: lead.id_lead_externo || undefined,
          url_pipedrive: lead.url_pipedrive || undefined,
          organizacao: lead.organizacao || undefined,
          utm_source: lead.utm_source || undefined,
          utm_medium: lead.utm_medium || undefined,
          utm_campaign: lead.utm_campaign || undefined,
          utm_content: lead.utm_content || undefined,
          utm_term: lead.utm_term || undefined,
          origem_tipo: lead.origem_tipo || undefined,
          lead_pago: lead.lead_pago || false,
          score: lead.mautic_score || 0,
          stage: lead.stage_atual || 'Lead',
          data_criacao: lead.data_criacao || undefined,
          data_mql: lead.data_mql || undefined,
          data_levantou_mao: lead.data_levantou_mao || undefined,
          data_reuniao: lead.data_reuniao || undefined,
          data_venda: lead.data_venda || undefined,
          valor_venda: lead.valor_venda || undefined
        }
      };

      // Adicionar dados LinkedIn se existirem
      if (lead.linkedin_url || lead.linkedin_cargo || lead.linkedin_senioridade) {
        payload.dados_linkedin = {
          url: lead.linkedin_url || undefined,
          cargo: lead.linkedin_cargo || undefined,
          empresa: lead.linkedin_empresa || undefined,
          setor: lead.linkedin_setor || undefined,
          senioridade: lead.linkedin_senioridade || undefined,
          conexoes: lead.linkedin_conexoes || undefined
        };
      }

      // Adicionar dados Mautic se existirem
      if (lead.id_mautic_contact || lead.mautic_score || lead.mautic_page_hits) {
        payload.dados_mautic = {
          contact_id: lead.id_mautic_contact || undefined,
          score: lead.mautic_score || undefined,
          page_hits: lead.mautic_page_hits || undefined,
          last_active: lead.mautic_last_active || undefined,
          first_visit: lead.mautic_first_visit || undefined,
          tags: lead.mautic_tags || undefined,
          segments: lead.mautic_segments || undefined,
          cidade: lead.cidade_mautic || undefined,
          estado: lead.estado_mautic || undefined
        };
      }

      // Adicionar dados Chatwoot se existirem
      if (lead.chatwoot_contact_id || lead.chatwoot_conversas_total) {
        payload.dados_chatwoot = {
          contact_id: lead.chatwoot_contact_id || undefined,
          conversas_total: lead.chatwoot_conversas_total || undefined,
          mensagens_total: lead.chatwoot_mensagens_total || undefined,
          ultima_conversa: lead.chatwoot_ultima_conversa || undefined,
          status_atendimento: lead.chatwoot_status_atendimento || undefined,
          tempo_resposta_medio: lead.chatwoot_tempo_resposta_medio || undefined,
          agente_atual: lead.chatwoot_agente_atual || undefined,
          inbox: lead.chatwoot_inbox || undefined
        };
      }

      // Adicionar dados Notion se existirem
      if (lead.id_cliente_notion || lead.cliente_status) {
        payload.dados_notion = {
          cliente_id: lead.id_cliente_notion || undefined,
          cliente_status: lead.cliente_status || undefined
        };
      }

      // Adicionar dados específicos da Tokeniza
      if (empresaSDR === 'TOKENIZA') {
        const projetosArray = Array.isArray(lead.tokeniza_projetos) ? lead.tokeniza_projetos : [];
        const qtdProjetos = projetosArray.length;
        
        payload.dados_tokeniza = {
          valor_investido: lead.tokeniza_valor_investido || 0,
          qtd_investimentos: lead.tokeniza_qtd_investimentos || 0,
          qtd_projetos: qtdProjetos,
          projetos: projetosArray.length > 0 ? projetosArray : undefined,
          ultimo_investimento_em: lead.tokeniza_ultimo_investimento || undefined,
          carrinho_abandonado: lead.tokeniza_carrinho_abandonado || false,
          valor_carrinho: lead.tokeniza_valor_carrinho || undefined
        };

        // Buscar investimentos detalhados
        if (lead.tokeniza_user_id) {
          const investimentos = await buscarInvestimentosDetalhados(supabase, lead.tokeniza_user_id, mapaProjetos);
          if (investimentos.length > 0) {
            payload.dados_tokeniza.investimentos = investimentos;
          }
          console.log(`[Webhook] Lead ${lead.id_lead}: ${investimentos.length} investimentos detalhados`);
        }

        if (lead.tokeniza_carrinho_abandonado && lead.tokeniza_valor_carrinho) {
          payload.event_metadata = {
            valor_simulado: lead.tokeniza_valor_carrinho,
            pagina_visitada: lead.tokeniza_projeto_nome ? `/investir/${lead.tokeniza_projeto_nome}` : undefined
          };
        }
      }

      // Adicionar dados específicos da Blue
      if (empresaSDR === 'BLUE') {
        payload.dados_blue = {
          qtd_compras_ir: lead.venda_realizada ? 1 : 0,
          ticket_medio: lead.valor_venda || 0,
          score_mautic: lead.mautic_score || 0,
          cliente_status: lead.cliente_status || undefined,
          plano_atual: undefined
        };
      }

      // Enviar para cada destino ativo
      for (const destino of destinos) {
        if (destino.id_empresa && destino.id_empresa !== lead.id_empresa) {
          continue;
        }

        if (destino.eventos && !destino.eventos.includes(evento)) {
          continue;
        }

        if (!body.lead_ids?.length) {
          const scoreMinimo = destino.score_minimo_crm ?? 70;
          if (scoreTemperatura < scoreMinimo) {
            console.log(`[Webhook] Lead ${lead.id_lead} score ${scoreTemperatura} < mínimo ${scoreMinimo} do destino ${destino.nome}, pulando`);
            continue;
          }
        }

        try {
          const customHeaders = destino.headers || {};
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...customHeaders
          };

          if (headers['x-webhook-secret'] === '{{SGT_WEBHOOK_SECRET}}') {
            const webhookSecret = Deno.env.get('SGT_WEBHOOK_SECRET');
            if (webhookSecret) {
              headers['x-webhook-secret'] = webhookSecret;
            } else {
              console.warn('[Webhook] SGT_WEBHOOK_SECRET não configurado, enviando sem autenticação');
            }
          }

          console.log(`[Webhook] Enviando lead ${lead.id_lead} (score: ${scoreTemperatura}, ${prioridade}) para ${destino.nome}`);

          const response = await fetch(destino.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          const statusCode = response.status;
          const resposta = await response.text();

          await supabase.from('lead_webhook_log').insert({
            id_lead: lead.id_lead,
            id_webhook_destino: destino.id,
            evento,
            payload,
            status: statusCode >= 200 && statusCode < 300 ? 'enviado' : 'erro',
            status_code: statusCode,
            resposta: resposta.substring(0, 1000)
          });

          if (statusCode >= 200 && statusCode < 300) {
            webhooksEnviados++;
            console.log(`[Webhook] Lead ${lead.id_lead} enviado para ${destino.nome} - ${statusCode}`);
          } else {
            webhooksErros++;
            console.error(`[Webhook] Erro ao enviar lead ${lead.id_lead} para ${destino.nome} - ${statusCode}: ${resposta}`);
          }
        } catch (sendError) {
          webhooksErros++;
          console.error(`[Webhook] Erro ao enviar para ${destino.nome}:`, sendError);

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
