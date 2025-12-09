import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato E.164 brasileiro (+55DDNNNNNNNNN)
// Trata todos os formatos: com/sem +55, com/sem espaços, com/sem 9º dígito
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Remove prefixo 55 se existir para trabalhar só com DDD+número
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }
  
  // Agora temos DDD + número (10 ou 11 dígitos)
  if (digits.length === 10) {
    // Formato sem 9º dígito: 6198626334 → adiciona o 9 após DDD
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    digits = `${ddd}9${numero}`;
  }
  
  // Validação final: deve ter 11 dígitos (DDD + 9 + 8 dígitos)
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  
  // Se ainda não normalizou, log e retorna null para evitar dados incorretos
  console.warn(`[normalizePhone] Telefone inválido: ${phone} → ${digits} (${digits.length} dígitos)`);
  return null;
}

// Cria contato no Mautic
async function createMauticContact(
  config: { url_base: string; login: string; senha: string },
  contactData: { name: string; phone: string; email?: string; inbox?: string }
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    const normalizedBaseUrl = config.url_base.endsWith('/') 
      ? config.url_base.slice(0, -1) 
      : config.url_base;
    
    const basicAuth = btoa(`${config.login}:${config.senha}`);
    
    // Preparar dados do contato
    const mauticPayload = {
      firstname: contactData.name?.split(' ')[0] || 'WhatsApp',
      lastname: contactData.name?.split(' ').slice(1).join(' ') || 'Lead',
      phone: contactData.phone,
      email: contactData.email || null,
      tags: ['whatsapp', 'chatwoot', contactData.inbox || 'inbox'].filter(Boolean),
      // UTMs de origem
      utm_source: 'whatsapp',
      utm_medium: 'chat',
      utm_campaign: `chatwoot-${contactData.inbox || 'inbox'}`,
    };

    console.log('[Mautic] Criando contato:', JSON.stringify(mauticPayload));

    const response = await fetch(`${normalizedBaseUrl}/api/contacts/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mauticPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mautic] Erro ao criar contato: ${response.status} - ${errorText}`);
      return { success: false, error: `Erro Mautic: ${response.status}` };
    }

    const result = await response.json();
    const contactId = result.contact?.id?.toString();
    
    console.log(`[Mautic] Contato criado com sucesso - ID: ${contactId}`);
    return { success: true, contactId };
  } catch (error) {
    console.error('[Mautic] Erro ao criar contato:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
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
    const inboxName = inbox?.name;

    console.log(`[Chatwoot Webhook] Contato - ID: ${contactId}, Email: ${contactEmail}, Telefone: ${contactPhone}, Nome: ${contactName}`);

    if (!contactEmail && !contactPhone) {
      console.log('[Chatwoot Webhook] Contato sem email ou telefone, ignorando');
      return new Response(JSON.stringify({ success: true, message: 'Contato sem identificador' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar lead por email, telefone ou nome (buscar o mais antigo se houver duplicatas)
    // Prioridade: 1. Email, 2. Telefone, 3. Nome (fallback para evitar duplicatas)
    let lead = null;
    let matchMethod = '';
    
    // 1. Busca por email (mais preciso)
    if (contactEmail) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .ilike('email', contactEmail)
        .eq('merged', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      lead = data;
      
      if (lead) {
        matchMethod = 'email';
        console.log(`[Chatwoot Webhook] Lead encontrado por email: ${lead.id_lead}`);
      }
    }

    // 2. Busca por telefone
    if (!lead && contactPhone) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('telefone', contactPhone)
        .eq('merged', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      lead = data;
      
      if (lead) {
        matchMethod = 'telefone';
        console.log(`[Chatwoot Webhook] Lead encontrado por telefone: ${lead.id_lead}`);
      }
    }
    
    // 3. Fallback: Busca por nome similar (evita duplicatas quando lead do Pipedrive não tem telefone)
    // Só usa se tiver um nome razoável (mais de 5 caracteres, mais de uma palavra)
    if (!lead && contactName && contactName.length > 5 && contactName.includes(' ')) {
      console.log(`[Chatwoot Webhook] Tentando fallback de busca por nome: "${contactName}"`);
      
      // Buscar leads com nome similar na mesma empresa (determinada pelo inbox)
      // Usa busca case-insensitive pelo nome completo
      const { data: leadsByName } = await supabase
        .from('lead')
        .select('*')
        .ilike('nome_lead', contactName)
        .eq('merged', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (leadsByName) {
        lead = leadsByName;
        matchMethod = 'nome';
        console.log(`[Chatwoot Webhook] Lead encontrado por nome (fallback): ${lead.id_lead} - "${lead.nome_lead}"`);
      } else {
        // Tentar busca mais flexível ignorando acentos e maiúsculas
        // Busca leads que contenham o primeiro e último nome
        const nameParts = contactName.trim().split(' ');
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          
          const { data: leadsByPartialName } = await supabase
            .from('lead')
            .select('*')
            .ilike('nome_lead', `%${firstName}%${lastName}%`)
            .eq('merged', false)
            .order('created_at', { ascending: true })
            .limit(5);
          
          if (leadsByPartialName && leadsByPartialName.length === 1) {
            // Só usa se encontrar exatamente 1 match (evita ambiguidade)
            lead = leadsByPartialName[0];
            matchMethod = 'nome parcial';
            console.log(`[Chatwoot Webhook] Lead encontrado por nome parcial (fallback): ${lead.id_lead} - "${lead.nome_lead}"`);
          } else if (leadsByPartialName && leadsByPartialName.length > 1) {
            console.log(`[Chatwoot Webhook] Múltiplos leads encontrados por nome parcial (${leadsByPartialName.length}), não usando fallback para evitar erro`);
          }
        }
      }
    }

    // Se lead não existe, criar automaticamente
    if (!lead) {
      console.log(`[Chatwoot Webhook] Lead não encontrado para ${contactEmail || contactPhone}, criando novo lead...`);
      
      // Buscar integração Chatwoot para determinar empresa pelo mapeamento inbox→empresa
      const { data: integracoes } = await supabase
        .from('integracao')
        .select('config_json')
        .eq('tipo', 'CHATWOOT')
        .eq('ativo', true);
      
      let idEmpresa: string | null = null;
      let mauticConfig: { url_base: string; login: string; senha: string } | null = null;
      
      if (integracoes && integracoes.length > 0) {
        const chatwootConfig = integracoes[0].config_json as any;
        
        // Determinar empresa pelo mapeamento inbox→empresa
        if (chatwootConfig.empresas && Array.isArray(chatwootConfig.empresas) && inboxName) {
          console.log(`[Chatwoot Webhook] Buscando empresa para inbox: "${inboxName}"`);
          
          for (const empresaMapping of chatwootConfig.empresas) {
            if (empresaMapping.inboxes && Array.isArray(empresaMapping.inboxes)) {
              const matchedInbox = empresaMapping.inboxes.find(
                (inbox: string) => inbox.toLowerCase().trim() === inboxName.toLowerCase().trim()
              );
              
              if (matchedInbox) {
                idEmpresa = empresaMapping.id_empresa;
                console.log(`[Chatwoot Webhook] Inbox "${inboxName}" mapeada para empresa: ${idEmpresa}`);
                break;
              }
            }
          }
          
          if (!idEmpresa) {
            console.log(`[Chatwoot Webhook] Inbox "${inboxName}" não encontrada no mapeamento. Empresas configuradas:`, 
              chatwootConfig.empresas.map((e: any) => `${e.id_empresa}: ${e.inboxes?.join(', ')}`));
          }
        }
        
        // Fallback para id_empresa legado se não houver mapeamento
        if (!idEmpresa && chatwootConfig.id_empresa) {
          idEmpresa = chatwootConfig.id_empresa;
          console.log(`[Chatwoot Webhook] Usando id_empresa legado: ${idEmpresa}`);
        }
        
        // Buscar integração Mautic para a empresa determinada
        if (idEmpresa) {
          const { data: mauticIntegracoes } = await supabase
            .from('integracao')
            .select('config_json')
            .eq('tipo', 'MAUTIC')
            .eq('ativo', true);
          
          const mauticIntegracao = mauticIntegracoes?.find(i => (i.config_json as any)?.id_empresa === idEmpresa);
          if (mauticIntegracao) {
            mauticConfig = mauticIntegracao.config_json as any;
          }
        }
      }
      
      if (!idEmpresa) {
        // Fallback: buscar primeira empresa ativa
        const { data: empresas } = await supabase
          .from('empresa')
          .select('id_empresa')
          .limit(1);
        
        if (empresas && empresas.length > 0) {
          idEmpresa = empresas[0].id_empresa;
        }
      }
      
      if (!idEmpresa) {
        console.log('[Chatwoot Webhook] Nenhuma empresa encontrada para criar lead');
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Nenhuma empresa configurada'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Verificar/criar contato no Mautic (se integração ativa)
      let idMauticContact: string | null = null;
      let mauticEnrichmentData: any = null;
      
      if (mauticConfig && mauticConfig.url_base && mauticConfig.login && mauticConfig.senha) {
        // Primeiro verificar se contato já existe no Mautic (se tem email)
        if (contactEmail) {
          console.log('[Chatwoot Webhook] Verificando se contato já existe no Mautic...');
          
          try {
            const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('enriquecer-lead-mautic', {
              body: { email: contactEmail, id_empresa: idEmpresa }
            });
            
            if (!enrichError && enrichResult?.success && enrichResult?.data?.id_mautic_contact) {
              // Contato já existe - usar dados existentes
              idMauticContact = enrichResult.data.id_mautic_contact;
              mauticEnrichmentData = enrichResult.data;
              console.log(`[Chatwoot Webhook] Contato Mautic existente encontrado: ${idMauticContact}`);
            } else {
              console.log('[Chatwoot Webhook] Contato não existe no Mautic, criando novo...');
              
              const mauticResult = await createMauticContact(mauticConfig, {
                name: contactName || 'WhatsApp Lead',
                phone: contactPhone || '',
                email: contactEmail,
                inbox: inboxName,
              });
              
              if (mauticResult.success && mauticResult.contactId) {
                idMauticContact = mauticResult.contactId;
                console.log(`[Chatwoot Webhook] Contato Mautic criado: ${idMauticContact}`);
              } else {
                console.log(`[Chatwoot Webhook] Falha ao criar contato Mautic: ${mauticResult.error}`);
              }
            }
          } catch (enrichError) {
            console.log('[Chatwoot Webhook] Erro ao verificar Mautic, tentando criar contato:', enrichError);
            
            const mauticResult = await createMauticContact(mauticConfig, {
              name: contactName || 'WhatsApp Lead',
              phone: contactPhone || '',
              email: contactEmail,
              inbox: inboxName,
            });
            
            if (mauticResult.success && mauticResult.contactId) {
              idMauticContact = mauticResult.contactId;
              console.log(`[Chatwoot Webhook] Contato Mautic criado após erro: ${idMauticContact}`);
            }
          }
        } else {
          // Sem email, criar contato diretamente com telefone
          console.log('[Chatwoot Webhook] Lead sem email, criando contato Mautic diretamente...');
          
          const mauticResult = await createMauticContact(mauticConfig, {
            name: contactName || 'WhatsApp Lead',
            phone: contactPhone || '',
            email: contactEmail,
            inbox: inboxName,
          });
          
          if (mauticResult.success && mauticResult.contactId) {
            idMauticContact = mauticResult.contactId;
            console.log(`[Chatwoot Webhook] Contato Mautic criado: ${idMauticContact}`);
          } else {
            console.log(`[Chatwoot Webhook] Falha ao criar contato Mautic: ${mauticResult.error}`);
          }
        }
      } else {
        console.log('[Chatwoot Webhook] Sem integração Mautic ativa para esta empresa');
      }
      
      // Criar lead no sistema - usar dados Mautic como fallback se disponíveis
      const newLeadData = {
        id_empresa: idEmpresa,
        nome_lead: contactName || 'WhatsApp Lead',
        email: contactEmail || null,
        telefone: contactPhone,
        stage_atual: 'WhatsApp',
        origem_canal: 'WHATSAPP',
        origem_tipo: 'ORGANICO',
        origem_campanha: `Chatwoot - ${inboxName || 'WhatsApp'}`,
        // UTMs: priorizar dados do Mautic (first-touch) se disponíveis
        utm_source: mauticEnrichmentData?.utm_source_mautic || 'whatsapp',
        utm_medium: mauticEnrichmentData?.utm_medium_mautic || 'chat',
        utm_campaign: mauticEnrichmentData?.utm_campaign_mautic || `chatwoot-${inboxName || 'inbox'}`,
        utm_content: mauticEnrichmentData?.utm_content_mautic || null,
        utm_term: mauticEnrichmentData?.utm_term_mautic || null,
        // Dados Chatwoot
        chatwoot_contact_id: contactId,
        chatwoot_inbox: inboxName,
        chatwoot_status_atendimento: conversation?.status || 'open',
        chatwoot_conversas_total: eventType === 'conversation_created' ? 1 : 0,
        chatwoot_mensagens_total: eventType === 'message_created' ? 1 : 0,
        chatwoot_ultima_conversa: new Date().toISOString(),
        // Mautic - usar dados existentes se disponíveis
        id_mautic_contact: idMauticContact,
        mautic_score: mauticEnrichmentData?.mautic_score || null,
        mautic_page_hits: mauticEnrichmentData?.mautic_page_hits || null,
        mautic_last_active: mauticEnrichmentData?.mautic_last_active || null,
        mautic_first_visit: mauticEnrichmentData?.mautic_first_visit || null,
        mautic_tags: mauticEnrichmentData?.mautic_tags || null,
        mautic_segments: mauticEnrichmentData?.mautic_segments || null,
        cidade_mautic: mauticEnrichmentData?.cidade_mautic || null,
        estado_mautic: mauticEnrichmentData?.estado_mautic || null,
        // Marcar como MQL se score alto ou muitos page hits
        is_mql: (mauticEnrichmentData?.mautic_score >= 50 || mauticEnrichmentData?.mautic_page_hits >= 10) || false,
        data_mql: (mauticEnrichmentData?.mautic_score >= 50 || mauticEnrichmentData?.mautic_page_hits >= 10) ? new Date().toISOString() : null,
      };

      // Double-check: verificar novamente se lead não foi criado por race condition
      let existingLead = null;
      if (contactEmail) {
        const { data } = await supabase
          .from('lead')
          .select('*')
          .ilike('email', contactEmail)
          .eq('merged', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        existingLead = data;
      }
      
      if (existingLead) {
        // Lead foi criado por outro request durante o processamento, usar esse
        lead = existingLead;
        console.log(`[Chatwoot Webhook] Lead encontrado em double-check (race condition prevenida): ${lead.id_lead}`);
        
        // Atualizar com dados Chatwoot
        await supabase
          .from('lead')
          .update({
            chatwoot_contact_id: contactId,
            chatwoot_inbox: inboxName,
            chatwoot_status_atendimento: conversation?.status || 'open',
            chatwoot_conversas_total: (existingLead.chatwoot_conversas_total || 0) + 1,
            chatwoot_ultima_conversa: new Date().toISOString(),
            telefone: contactPhone || existingLead.telefone,
            updated_at: new Date().toISOString(),
          })
          .eq('id_lead', lead.id_lead);
      } else {
        // Criar novo lead
        const { data: newLead, error: createError } = await supabase
          .from('lead')
          .insert(newLeadData)
          .select()
          .single();

        if (createError) {
          // Se erro de duplicata, buscar lead existente
          if (createError.code === '23505' || createError.message?.includes('duplicate')) {
            console.log('[Chatwoot Webhook] Erro de duplicata detectado, buscando lead existente...');
            
            const { data: duplicateLead } = await supabase
              .from('lead')
              .select('*')
              .ilike('email', contactEmail || '')
              .eq('merged', false)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            
            if (duplicateLead) {
              lead = duplicateLead;
              console.log(`[Chatwoot Webhook] Lead encontrado após erro de duplicata: ${lead.id_lead}`);
            } else {
              throw createError;
            }
          } else {
            console.error('[Chatwoot Webhook] Erro ao criar lead:', createError);
            throw createError;
          }
        } else {
          lead = newLead;
          console.log(`[Chatwoot Webhook] Lead criado com sucesso: ${lead.id_lead}`);
        }
      }
      
      // Registrar evento de criação
      const mauticStatus = mauticEnrichmentData 
        ? ` - Contato Mautic existente enriquecido (score: ${mauticEnrichmentData.mautic_score || 0})`
        : idMauticContact 
          ? ' - Contato Mautic criado' 
          : '';
      
      await supabase.from('lead_evento').insert({
        id_lead: lead.id_lead,
        etapa: 'LEAD_CRIADO',
        observacao: `Lead criado via WhatsApp (${inboxName || 'Chatwoot'})${mauticStatus}`,
      });
      
      // Disparar webhook SDR para lead novo
      try {
        const { data: destinos } = await supabase
          .from('webhook_destino')
          .select('*')
          .eq('ativo', true)
          .or(`id_empresa.eq.${idEmpresa},id_empresa.is.null`);

        if (destinos && destinos.length > 0) {
          for (const destino of destinos) {
            if (destino.eventos && !destino.eventos.includes('lead_criado')) {
              continue;
            }

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
              dados_chatwoot: {
                contact_id: contactId,
                status: conversation?.status,
                inbox: inboxName,
              },
              event_metadata: {
                source: 'chatwoot',
                original_event: eventType,
                mautic_contact_created: !!idMauticContact,
              },
            };

            try {
              const response = await fetch(destino.url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...destino.headers,
                },
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

              console.log(`[Chatwoot Webhook] Webhook SDR enviado para ${destino.nome}: ${response.status}`);
            } catch (webhookError) {
              console.error(`[Chatwoot Webhook] Erro ao enviar webhook para ${destino.nome}:`, webhookError);
            }
          }
        }
      } catch (sdrError) {
        console.error('[Chatwoot Webhook] Erro ao processar webhook SDR:', sdrError);
      }

      const duration = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        lead_id: lead.id_lead,
        lead_created: true,
        mautic_contact_created: !!idMauticContact,
        event: eventType,
        duration_ms: duration,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Chatwoot Webhook] Lead encontrado: ${lead.id_lead}`);

    // Processar eventos para lead existente
    const updateData: Record<string, any> = {
      chatwoot_contact_id: contactId,
      updated_at: new Date().toISOString(),
    };

    // Atualizar telefone se não existir no lead
    if (contactPhone && !lead.telefone) {
      updateData.telefone = contactPhone;
    }

    // Atualizar dados de conversa
    if (conversation) {
      updateData.chatwoot_status_atendimento = conversation.status; // open, resolved, pending
      updateData.chatwoot_ultima_conversa = new Date().toISOString();
      
      if (inboxName) {
        updateData.chatwoot_inbox = inboxName;
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
                telefone: lead.telefone,
                stage: lead.stage_atual,
              },
              dados_chatwoot: {
                contact_id: contactId,
                status: conversation?.status,
                conversas_total: updateData.chatwoot_conversas_total || lead.chatwoot_conversas_total,
                agente_atual: updateData.chatwoot_agente_atual || lead.chatwoot_agente_atual,
                inbox: updateData.chatwoot_inbox || lead.chatwoot_inbox,
              },
              event_metadata: {
                source: 'chatwoot',
                original_event: eventType,
              },
            };

            try {
              const response = await fetch(destino.url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...destino.headers,
                },
                body: JSON.stringify(sdrPayload),
              });

              // Logar resultado
              await supabase.from('lead_webhook_log').insert({
                id_lead: lead.id_lead,
                id_webhook_destino: destino.id,
                evento: eventoSDR,
                payload: sdrPayload,
                status: response.ok ? 'sucesso' : 'erro',
                status_code: response.status,
                resposta: await response.text().catch(() => null),
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
      lead_created: false,
      event: eventType,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Chatwoot Webhook] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
