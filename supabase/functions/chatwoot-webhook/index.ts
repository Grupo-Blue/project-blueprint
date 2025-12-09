import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato E.164 brasileiro (+55...)
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('55')) return `+${digits}`;
  return phone;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const payload = await req.json();
    console.log('[Chatwoot Webhook] Evento recebido:', JSON.stringify(payload, null, 2));

    const eventType = payload.event;
    const conversation = payload.conversation;
    const message = payload.message;
    // O cliente real está sempre em conversation.meta.sender, não em payload.sender (que pode ser agente)
    const contact = conversation?.meta?.sender || payload.contact;
    const inbox = payload.inbox || conversation?.inbox;
    const account = payload.account;

    if (!eventType) {
      console.log('[Chatwoot Webhook] Evento sem tipo, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'Evento sem tipo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair dados do contato
    const contactId = contact?.id;
    const contactEmail = contact?.email?.toLowerCase();
    const contactPhone = normalizePhone(contact?.phone_number);
    const contactName = contact?.name;

    console.log(`[Chatwoot Webhook] Contato - ID: ${contactId}, Email: ${contactEmail}, Telefone: ${contactPhone}`);

    if (!contactEmail && !contactPhone) {
      console.log('[Chatwoot Webhook] Contato sem email ou telefone, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'Contato sem identificador' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar lead por email ou telefone
    let lead = null;
    
    if (contactEmail) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .ilike('email', contactEmail)
        .maybeSingle();
      lead = data;
    }

    if (!lead && contactPhone) {
      // Tentar buscar por telefone (campo não existe ainda, mas pode ser adicionado)
      console.log('[Chatwoot Webhook] Lead não encontrado por email, tentando telefone...');
    }

    if (!lead) {
      console.log(`[Chatwoot Webhook] Lead não encontrado para ${contactEmail || contactPhone}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Lead não encontrado',
        contact: { email: contactEmail, phone: contactPhone }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Chatwoot Webhook] Lead encontrado: ${lead.id_lead}`);

    // Processar eventos
    const updateData: Record<string, any> = {
      chatwoot_contact_id: contactId,
      updated_at: new Date().toISOString()
    };

    // Atualizar dados de conversa
    if (conversation) {
      updateData.chatwoot_status_atendimento = conversation.status; // open, resolved, pending
      updateData.chatwoot_ultima_conversa = new Date().toISOString();
      
      if (inbox?.name) {
        updateData.chatwoot_inbox = inbox.name;
      }

      // Contar conversas (incrementar)
      if (eventType === 'conversation_created') {
        updateData.chatwoot_conversas_total = (lead.chatwoot_conversas_total || 0) + 1;
      }
    }

    // Contar mensagens
    if (eventType === 'message_created' && message) {
      updateData.chatwoot_mensagens_total = (lead.chatwoot_mensagens_total || 0) + 1;
      updateData.chatwoot_ultima_conversa = new Date().toISOString();

      // Identificar agente
      if (message.sender?.type === 'user') {
        updateData.chatwoot_agente_atual = message.sender.name;
      }
    }

    // Atualizar status
    if (eventType === 'conversation_status_changed') {
      updateData.chatwoot_status_atendimento = conversation?.status;
    }

    // Aplicar update no lead
    const { error: updateError } = await supabase
      .from('lead')
      .update(updateData)
      .eq('id_lead', lead.id_lead);

    if (updateError) {
      console.error('[Chatwoot Webhook] Erro ao atualizar lead:', updateError);
      throw updateError;
    }

    console.log(`[Chatwoot Webhook] Lead ${lead.id_lead} atualizado com dados Chatwoot`);

    // Disparar webhook para SDR IA se for evento relevante
    const sdrEvents = ['conversation_created', 'conversation_status_changed'];
    if (sdrEvents.includes(eventType)) {
      try {
        // Buscar destinos webhook ativos para a empresa do lead
        const { data: destinos } = await supabase
          .from('webhook_destino')
          .select('*')
          .eq('ativo', true)
          .or(`id_empresa.eq.${lead.id_empresa},id_empresa.is.null`);

        if (destinos && destinos.length > 0) {
          const eventoSDR = eventType === 'conversation_created' ? 'CONVERSA_INICIADA' : 'ATENDIMENTO_ATUALIZADO';
          
          for (const destino of destinos) {
            // Verificar se o destino aceita este tipo de evento
            if (destino.eventos && !destino.eventos.includes(eventoSDR.toLowerCase())) {
              continue;
            }

            const sdrPayload = {
              lead_id: lead.id_lead,
              evento: eventoSDR,
              empresa: lead.id_empresa,
              timestamp: new Date().toISOString(),
              dados_lead: {
                nome: lead.nome_lead,
                email: lead.email,
                stage: lead.stage_atual
              },
              dados_chatwoot: {
                contact_id: contactId,
                status: conversation?.status,
                conversas_total: updateData.chatwoot_conversas_total || lead.chatwoot_conversas_total,
                agente_atual: updateData.chatwoot_agente_atual || lead.chatwoot_agente_atual,
                inbox: updateData.chatwoot_inbox || lead.chatwoot_inbox
              },
              event_metadata: {
                source: 'chatwoot',
                original_event: eventType
              }
            };

            try {
              const response = await fetch(destino.url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...destino.headers
                },
                body: JSON.stringify(sdrPayload)
              });

              // Logar resultado
              await supabase.from('lead_webhook_log').insert({
                id_lead: lead.id_lead,
                id_webhook_destino: destino.id,
                evento: eventoSDR,
                payload: sdrPayload,
                status: response.ok ? 'sucesso' : 'erro',
                status_code: response.status,
                resposta: await response.text().catch(() => null)
              });

              console.log(`[Chatwoot Webhook] Webhook SDR enviado para ${destino.nome}: ${response.status}`);
            } catch (webhookError) {
              console.error(`[Chatwoot Webhook] Erro ao enviar webhook para ${destino.nome}:`, webhookError);
            }
          }
        }
      } catch (sdrError) {
        console.error('[Chatwoot Webhook] Erro ao processar webhook SDR:', sdrError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Chatwoot Webhook] Processado em ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      lead_id: lead.id_lead,
      event: eventType,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Chatwoot Webhook] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
