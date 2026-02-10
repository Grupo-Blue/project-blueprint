import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Normaliza telefone para formato E.164 brasileiro (+55DDNNNNNNNNN)
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    digits = `${ddd}9${numero}`;
  }
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  console.warn(`[normalizePhone] Telefone inválido: ${phone} → ${digits} (${digits.length} dígitos)`);
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const payload = await req.json();
    console.log('[Chatblue Webhook] Evento recebido:', JSON.stringify(payload, null, 2));

    const eventType = payload.event; // ticket.created, ticket.updated, message.created
    const ticket = payload.ticket;
    const contact = payload.contact;
    const connection = payload.connection;
    const message = payload.message;
    const company = payload.company;

    if (!eventType) {
      console.log('[Chatblue Webhook] Evento sem tipo, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'Evento sem tipo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair dados do contato
    const contactEmail = contact?.email?.toLowerCase() || null;
    const contactPhone = normalizePhone(contact?.phone);
    const contactName = contact?.name;
    const inboxName = connection?.name;
    const ticketId = ticket?.id;
    const ticketProtocol = ticket?.protocol;
    const ticketStatus = ticket?.status; // PENDING, IN_PROGRESS, CLOSED, etc.
    const ticketPriority = ticket?.priority;
    const ticketDepartment = ticket?.departmentName;
    const ticketResponseTime = ticket?.responseTime;
    const ticketResolutionTime = ticket?.resolutionTime;
    const ticketSlaBreached = ticket?.slaBreached || false;
    const ticketIsAI = ticket?.isAIHandled || false;
    const assignedAgent = ticket?.assignedTo?.name || null;

    console.log(`[Chatblue Webhook] Contato - Email: ${contactEmail}, Telefone: ${contactPhone}, Nome: ${contactName}`);

    if (!contactEmail && !contactPhone) {
      console.log('[Chatblue Webhook] Contato sem email ou telefone, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'Contato sem identificador' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determinar empresa pelo mapeamento company_id → empresa no config
    const { data: integracoes } = await supabase
      .from('integracao')
      .select('config_json')
      .eq('tipo', 'CHATWOOT') // Reutiliza o tipo CHATWOOT do enum
      .eq('ativo', true);

    let idEmpresa: string | null = null;

    if (integracoes && integracoes.length > 0) {
      const config = integracoes[0].config_json as any;

      // Verificar webhook_secret se configurado
      const webhookSecret = config.webhook_secret;
      if (webhookSecret) {
        const receivedSecret = req.headers.get('x-webhook-secret');
        if (receivedSecret !== webhookSecret) {
          console.log('[Chatblue Webhook] Webhook secret inválido');
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Mapear company_id do Chatblue para id_empresa do SGT
      if (config.empresas && Array.isArray(config.empresas) && company?.id) {
        const empresaMapping = config.empresas.find(
          (e: any) => e.company_id === company.id
        );
        if (empresaMapping) {
          idEmpresa = empresaMapping.id_empresa;
          console.log(`[Chatblue Webhook] Company "${company.name}" mapeada para empresa: ${idEmpresa}`);
        }
      }

      // Fallback: mapear por inbox name (compatível com formato antigo)
      if (!idEmpresa && config.empresas && Array.isArray(config.empresas) && inboxName) {
        for (const empresaMapping of config.empresas) {
          if (empresaMapping.inboxes && Array.isArray(empresaMapping.inboxes)) {
            const matched = empresaMapping.inboxes.find(
              (inbox: string) => inbox.toLowerCase().trim() === inboxName.toLowerCase().trim()
            );
            if (matched) {
              idEmpresa = empresaMapping.id_empresa;
              console.log(`[Chatblue Webhook] Inbox "${inboxName}" mapeada para empresa: ${idEmpresa}`);
              break;
            }
          }
        }
      }
    }

    if (!idEmpresa) {
      // Fallback: primeira empresa
      const { data: empresas } = await supabase
        .from('empresa')
        .select('id_empresa')
        .limit(1);
      if (empresas && empresas.length > 0) {
        idEmpresa = empresas[0].id_empresa;
      }
    }

    if (!idEmpresa) {
      console.log('[Chatblue Webhook] Nenhuma empresa encontrada');
      return new Response(JSON.stringify({ success: false, message: 'Nenhuma empresa configurada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar lead existente por chatblue_ticket_id, email ou telefone
    let lead: any = null;

    // 1. Busca por ticket_id (mais preciso para Chatblue)
    if (ticketId) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('chatblue_ticket_id', ticketId)
        .eq('merged', false)
        .limit(1)
        .maybeSingle();
      if (data) {
        lead = data;
        console.log(`[Chatblue Webhook] Lead encontrado por ticket_id: ${lead.id_lead}`);
      }
    }

    // 2. Busca por email
    if (!lead && contactEmail) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .ilike('email', contactEmail)
        .eq('merged', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        lead = data;
        console.log(`[Chatblue Webhook] Lead encontrado por email: ${lead.id_lead}`);
      }
    }

    // 3. Busca por telefone
    if (!lead && contactPhone) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('telefone', contactPhone)
        .eq('merged', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        lead = data;
        console.log(`[Chatblue Webhook] Lead encontrado por telefone: ${lead.id_lead}`);
      }
    }

    // Mapear status Chatblue → status atendimento SGT
    const statusMap: Record<string, string> = {
      'PENDING': 'open',
      'IN_PROGRESS': 'in_progress',
      'CLOSED': 'resolved',
      'WAITING': 'pending',
    };
    const mappedStatus = statusMap[ticketStatus] || ticketStatus?.toLowerCase() || 'open';

    // Se lead não existe, criar automaticamente
    if (!lead) {
      console.log(`[Chatblue Webhook] Lead não encontrado, criando novo lead...`);

      const newLeadData: Record<string, any> = {
        id_empresa: idEmpresa,
        nome_lead: contactName || 'WhatsApp Lead',
        email: contactEmail || null,
        telefone: contactPhone,
        stage_atual: 'WhatsApp',
        origem_canal: 'WHATSAPP',
        origem_tipo: 'ORGANICO',
        origem_campanha: `Chatblue - ${inboxName || 'WhatsApp'}`,
        utm_source: 'whatsapp',
        utm_medium: 'chat',
        utm_campaign: `chatblue-${inboxName || 'inbox'}`,
        // Dados Chatblue
        chatblue_ticket_id: ticketId,
        chatblue_protocolo: ticketProtocol,
        chatblue_departamento: ticketDepartment,
        chatblue_prioridade: ticketPriority,
        chatblue_sla_violado: ticketSlaBreached,
        chatblue_atendido_por_ia: ticketIsAI,
        chatblue_tempo_resolucao_seg: ticketResolutionTime,
        // Dados legado (compat com campos chatwoot existentes)
        chatwoot_status_atendimento: mappedStatus,
        chatwoot_agente_atual: assignedAgent,
        chatwoot_inbox: inboxName,
        chatwoot_conversas_total: eventType === 'ticket.created' ? 1 : 0,
        chatwoot_mensagens_total: eventType === 'message.created' ? 1 : 0,
        chatwoot_ultima_conversa: new Date().toISOString(),
        chatwoot_tempo_resposta_medio: ticketResponseTime,
      };

      // Double-check para evitar duplicatas
      let existingLead = null;
      if (contactEmail) {
        const { data } = await supabase
          .from('lead')
          .select('*')
          .ilike('email', contactEmail)
          .eq('merged', false)
          .limit(1)
          .maybeSingle();
        existingLead = data;
      }
      if (!existingLead && contactPhone) {
        const { data } = await supabase
          .from('lead')
          .select('*')
          .eq('telefone', contactPhone)
          .eq('id_empresa', idEmpresa)
          .eq('merged', false)
          .limit(1)
          .maybeSingle();
        existingLead = data;
      }

      if (existingLead) {
        lead = existingLead;
        console.log(`[Chatblue Webhook] Lead encontrado em double-check: ${lead.id_lead}`);
        // Atualizar com dados Chatblue
        await supabase
          .from('lead')
          .update({
            chatblue_ticket_id: ticketId,
            chatblue_protocolo: ticketProtocol,
            chatblue_departamento: ticketDepartment,
            chatblue_prioridade: ticketPriority,
            chatblue_sla_violado: ticketSlaBreached,
            chatblue_atendido_por_ia: ticketIsAI,
            chatwoot_status_atendimento: mappedStatus,
            chatwoot_agente_atual: assignedAgent,
            chatwoot_inbox: inboxName,
            chatwoot_conversas_total: (existingLead.chatwoot_conversas_total || 0) + 1,
            chatwoot_ultima_conversa: new Date().toISOString(),
            telefone: contactPhone || existingLead.telefone,
            updated_at: new Date().toISOString(),
          })
          .eq('id_lead', lead.id_lead);
      } else {
        const { data: newLead, error: createError } = await supabase
          .from('lead')
          .insert(newLeadData)
          .select()
          .single();

        if (createError) {
          if (createError.code === '23505') {
            console.log('[Chatblue Webhook] Duplicata detectada, buscando lead existente...');
            const { data: dupLead } = await supabase
              .from('lead')
              .select('*')
              .or(`email.ilike.${contactEmail},telefone.eq.${contactPhone}`)
              .eq('merged', false)
              .limit(1)
              .maybeSingle();
            if (dupLead) lead = dupLead;
            else throw createError;
          } else {
            throw createError;
          }
        } else {
          lead = newLead;
          console.log(`[Chatblue Webhook] Lead criado: ${lead.id_lead}`);
        }

        // Registrar evento
        if (lead) {
          await supabase.from('lead_evento').insert({
            id_lead: lead.id_lead,
            etapa: 'LEAD_CRIADO',
            observacao: `Lead criado via WhatsApp (${inboxName || 'Chatblue'}) - Protocolo: ${ticketProtocol || 'N/A'}`,
          });
        }
      }

      // Disparar webhooks SDR
      if (lead) {
        try {
          const { data: destinos } = await supabase
            .from('webhook_destino')
            .select('*')
            .eq('ativo', true)
            .or(`id_empresa.eq.${idEmpresa},id_empresa.is.null`);

          if (destinos && destinos.length > 0) {
            for (const destino of destinos) {
              if (destino.eventos && !destino.eventos.includes('lead_criado')) continue;

              const sdrPayload = {
                lead_id: lead.id_lead,
                evento: 'LEAD_NOVO',
                empresa: idEmpresa,
                timestamp: new Date().toISOString(),
                dados_lead: {
                  nome: lead.nome_lead,
                  email: lead.email,
                  telefone: lead.telefone,
                  stage: 'novo',
                },
                dados_chatblue: {
                  ticket_id: ticketId,
                  protocolo: ticketProtocol,
                  status: mappedStatus,
                  departamento: ticketDepartment,
                  inbox: inboxName,
                  atendido_por_ia: ticketIsAI,
                },
                event_metadata: {
                  source: 'chatblue',
                  original_event: eventType,
                },
              };

              try {
                const response = await fetch(destino.url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...destino.headers },
                  body: JSON.stringify(sdrPayload),
                });
                await supabase.from('lead_webhook_log').insert({
                  id_lead: lead.id_lead,
                  id_webhook_destino: destino.id,
                  evento: 'LEAD_NOVO',
                  payload: sdrPayload,
                  status: response.ok ? 'sucesso' : 'erro',
                  status_code: response.status,
                  resposta: await response.text().catch(() => null),
                });
              } catch (webhookError) {
                console.error(`[Chatblue Webhook] Erro webhook ${destino.nome}:`, webhookError);
              }
            }
          }
        } catch (sdrError) {
          console.error('[Chatblue Webhook] Erro SDR:', sdrError);
        }
      }

      const duration = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        lead_id: lead?.id_lead,
        lead_created: true,
        event: eventType,
        duration_ms: duration,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Lead existe — atualizar com dados do evento
    console.log(`[Chatblue Webhook] Lead encontrado: ${lead.id_lead}`);

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
      chatblue_ticket_id: ticketId || lead.chatblue_ticket_id,
      chatblue_protocolo: ticketProtocol || lead.chatblue_protocolo,
    };

    if (contactPhone && !lead.telefone) {
      updateData.telefone = contactPhone;
    }

    if (ticket) {
      updateData.chatwoot_status_atendimento = mappedStatus;
      updateData.chatwoot_ultima_conversa = new Date().toISOString();
      updateData.chatblue_departamento = ticketDepartment || lead.chatblue_departamento;
      updateData.chatblue_prioridade = ticketPriority || lead.chatblue_prioridade;
      updateData.chatblue_sla_violado = ticketSlaBreached;
      updateData.chatblue_atendido_por_ia = ticketIsAI;

      if (assignedAgent) {
        updateData.chatwoot_agente_atual = assignedAgent;
      }
      if (inboxName) {
        updateData.chatwoot_inbox = inboxName;
      }
      if (ticketResponseTime) {
        updateData.chatwoot_tempo_resposta_medio = ticketResponseTime;
      }
      if (ticketResolutionTime) {
        updateData.chatblue_tempo_resolucao_seg = ticketResolutionTime;
      }

      if (eventType === 'ticket.created') {
        updateData.chatwoot_conversas_total = (lead.chatwoot_conversas_total || 0) + 1;
      }
    }

    if (eventType === 'message.created' && message) {
      updateData.chatwoot_mensagens_total = (lead.chatwoot_mensagens_total || 0) + 1;
      updateData.chatwoot_ultima_conversa = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('lead')
      .update(updateData)
      .eq('id_lead', lead.id_lead);

    if (updateError) {
      console.error('[Chatblue Webhook] Erro ao atualizar lead:', updateError);
      throw updateError;
    }

    console.log(`[Chatblue Webhook] Lead ${lead.id_lead} atualizado`);

    // Disparar webhook SDR para eventos relevantes
    if (['ticket.created', 'ticket.updated'].includes(eventType)) {
      try {
        const { data: destinos } = await supabase
          .from('webhook_destino')
          .select('*')
          .eq('ativo', true)
          .or(`id_empresa.eq.${lead.id_empresa},id_empresa.is.null`);

        if (destinos && destinos.length > 0) {
          const eventoSDR = eventType === 'ticket.created' ? 'CONVERSA_INICIADA' : 'ATENDIMENTO_ATUALIZADO';

          for (const destino of destinos) {
            if (destino.eventos && !destino.eventos.includes(eventoSDR.toLowerCase())) continue;

            const sdrPayload = {
              lead_id: lead.id_lead,
              evento: eventoSDR,
              empresa: lead.id_empresa,
              timestamp: new Date().toISOString(),
              dados_lead: {
                nome: lead.nome_lead,
                email: lead.email,
                telefone: lead.telefone,
                stage: lead.stage_atual,
              },
              dados_chatblue: {
                ticket_id: ticketId,
                protocolo: ticketProtocol,
                status: mappedStatus,
                departamento: ticketDepartment,
                agente: assignedAgent,
                inbox: inboxName,
                sla_violado: ticketSlaBreached,
                atendido_por_ia: ticketIsAI,
              },
              event_metadata: {
                source: 'chatblue',
                original_event: eventType,
              },
            };

            try {
              const response = await fetch(destino.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...destino.headers },
                body: JSON.stringify(sdrPayload),
              });
              await supabase.from('lead_webhook_log').insert({
                id_lead: lead.id_lead,
                id_webhook_destino: destino.id,
                evento: eventoSDR,
                payload: sdrPayload,
                status: response.ok ? 'sucesso' : 'erro',
                status_code: response.status,
                resposta: await response.text().catch(() => null),
              });
            } catch (webhookError) {
              console.error(`[Chatblue Webhook] Erro webhook ${destino.nome}:`, webhookError);
            }
          }
        }
      } catch (sdrError) {
        console.error('[Chatblue Webhook] Erro SDR:', sdrError);
      }
    }

    const duration = Date.now() - startTime;
    return new Response(JSON.stringify({
      success: true,
      lead_id: lead.id_lead,
      lead_created: false,
      event: eventType,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Chatblue Webhook] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
