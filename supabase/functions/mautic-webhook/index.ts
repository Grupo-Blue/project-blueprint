import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tags que disparam levantou_mao (case-insensitive)
const TAGS_LEVANTOU_MAO = [
  'clicou-whatsapp',
  'levantou-mao',
  'pediu-contato',
  'agendou-reuniao',
];

// Limites para MQL automático
const MQL_SCORE_MINIMO = 50;
const MQL_PAGE_HITS_MINIMO = 10;

// Normalizar telefone para E.164 brasileiro
function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let digits = telefone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }
  if (digits.length === 10) {
    digits = digits.substring(0, 2) + '9' + digits.substring(2);
  }
  if (digits.length !== 11) return null;
  return `+55${digits}`;
}

// Extrair contato do payload do Mautic (suporta múltiplos formatos de evento)
function extrairContato(body: Record<string, unknown>): { contact: Record<string, unknown>; eventType: string } | null {
  const eventTypes = [
    'mautic.lead_post_save_update',
    'mautic.lead_post_save_new',
    'mautic.lead_points_change',
    'mautic.page_on_hit',
  ];

  for (const eventType of eventTypes) {
    const eventData = body[eventType];
    if (eventData && Array.isArray(eventData) && eventData.length > 0) {
      const entry = eventData[0];
      // page_on_hit tem contato em hit.lead ao invés de contact
      if (entry?.contact) {
        return { contact: entry.contact, eventType };
      }
      if (entry?.hit?.lead) {
        return { contact: entry.hit.lead, eventType };
      }
    }
    // Formato alternativo: objeto direto (não array)
    if (eventData && typeof eventData === 'object' && !Array.isArray(eventData)) {
      const entry = eventData as Record<string, unknown>;
      if (entry?.contact) {
        return { contact: entry.contact as Record<string, unknown>, eventType };
      }
      if ((entry as any)?.hit?.lead) {
        return { contact: (entry as any).hit.lead as Record<string, unknown>, eventType };
      }
    }
  }

  // Fallback: payload pode ser o contato diretamente
  if (body.contact) {
    return { contact: body.contact as Record<string, unknown>, eventType: 'unknown' };
  }

  return null;
}

// Extrair campo de core fields do Mautic
function getCoreField(contact: Record<string, unknown>, fieldName: string): string | null {
  const fields = contact.fields as Record<string, unknown> | undefined;
  if (!fields) return null;
  
  const core = fields.core as Record<string, unknown> | undefined;
  if (!core) return null;
  
  const field = core[fieldName] as Record<string, unknown> | undefined;
  if (!field) return null;
  
  return (field.value as string) || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Mautic Webhook] Recebendo webhook...');

  try {
    // 1. Ler body como texto para validação HMAC
    const rawBody = await req.text();

    // 2. Validar secret via HMAC-SHA256 (Mautic envia signature no header `Webhook-Signature`)
    const webhookSecret = Deno.env.get('MAUTIC_WEBHOOK_SECRET');
    const webhookSignature = req.headers.get('webhook-signature') || req.headers.get('Webhook-Signature');

    if (webhookSecret && webhookSignature) {
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(webhookSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
        const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

        if (computedSignature !== webhookSignature) {
          console.error(`[Mautic Webhook] HMAC inválido. Esperado: ${computedSignature}, Recebido: ${webhookSignature}`);
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('[Mautic Webhook] ✅ Assinatura HMAC validada com sucesso');
      } catch (hmacErr) {
        console.error('[Mautic Webhook] Erro ao validar HMAC:', hmacErr);
        return new Response(JSON.stringify({ error: 'Signature validation failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (!webhookSecret) {
      console.warn('[Mautic Webhook] MAUTIC_WEBHOOK_SECRET não configurado, pulando validação');
    } else {
      console.warn('[Mautic Webhook] Webhook-Signature header ausente, pulando validação HMAC');
    }

    // 3. Parse do body
    const body = JSON.parse(rawBody);
    console.log('[Mautic Webhook] Evento recebido:', JSON.stringify(body).substring(0, 500));

    // 3. Extrair contato
    const resultado = extrairContato(body);
    if (!resultado) {
      console.warn('[Mautic Webhook] Payload sem contato válido');
      return new Response(JSON.stringify({ success: false, message: 'Payload sem contato' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contact, eventType } = resultado;
    console.log(`[Mautic Webhook] Evento: ${eventType}, Mautic ID: ${contact.id}`);

    // 4. Extrair dados do contato
    const email = getCoreField(contact, 'email');
    const telefoneRaw = getCoreField(contact, 'phone');
    const telefone = normalizarTelefone(telefoneRaw);
    const firstName = getCoreField(contact, 'firstname') || '';
    const lastName = getCoreField(contact, 'lastname') || '';
    const nome = [firstName, lastName].filter(Boolean).join(' ') || null;
    const cidade = getCoreField(contact, 'city') || null;
    const estado = getCoreField(contact, 'state') || null;
    const mauticContactId = String(contact.id || '');
    const score = typeof contact.points === 'number' ? contact.points : 0;

    // Tags
    const tagsArray = Array.isArray(contact.tags)
      ? (contact.tags as Array<{ tag?: string } | string>).map(t => typeof t === 'string' ? t : (t?.tag || '')).filter(Boolean)
      : [];

    // UTMs
    const utmtags = Array.isArray(contact.utmtags) ? (contact.utmtags as Array<Record<string, unknown>>) : [];
    const latestUtm = utmtags.length > 0 ? utmtags[0] : null;

    if (!email && !telefone) {
      console.warn('[Mautic Webhook] Contato sem email nem telefone válido');
      return new Response(JSON.stringify({ success: false, message: 'Contato sem identificador' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Mautic Webhook] Contato: ${email || telefone}, Score: ${score}, Tags: ${tagsArray.join(',')}`);

    // 5. Conectar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 6. Buscar lead existente por email ou telefone
    let leadExistente: Record<string, unknown> | null = null;

    if (email) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('email', email)
        .eq('merged', false)
        .limit(1)
        .maybeSingle();
      if (data) leadExistente = data;
    }

    if (!leadExistente && telefone) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('telefone', telefone)
        .eq('merged', false)
        .limit(1)
        .maybeSingle();
      if (data) leadExistente = data;
    }

    if (!leadExistente && mauticContactId) {
      const { data } = await supabase
        .from('lead')
        .select('*')
        .eq('id_mautic_contact', mauticContactId)
        .eq('merged', false)
        .limit(1)
        .maybeSingle();
      if (data) leadExistente = data;
    }

    // 7. Determinar empresa (buscar integração Mautic ativa para saber a empresa)
    let idEmpresa: string | null = null;

    if (leadExistente) {
      idEmpresa = leadExistente.id_empresa as string;
    } else {
      // Buscar empresa que tem integração Mautic ativa
      const { data: integracoes } = await supabase
        .from('integracao')
        .select('id_empresa')
        .eq('tipo', 'MAUTIC')
        .eq('ativo', true)
        .limit(1);

      if (integracoes && integracoes.length > 0) {
        idEmpresa = integracoes[0].id_empresa;
      }
    }

    if (!idEmpresa) {
      console.error('[Mautic Webhook] Nenhuma empresa com integração Mautic ativa');
      return new Response(JSON.stringify({ success: false, message: 'Nenhuma empresa Mautic configurada' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Preparar dados de atualização
    const dadosMautic: Record<string, unknown> = {
      id_mautic_contact: mauticContactId || undefined,
      mautic_score: score,
      mautic_tags: tagsArray.length > 0 ? tagsArray : undefined,
      mautic_last_active: new Date().toISOString(),
      cidade_mautic: cidade || undefined,
      estado_mautic: estado || undefined,
    };

    // UTMs do Mautic
    if (latestUtm) {
      dadosMautic.utm_source_mautic = (latestUtm as Record<string, unknown>).utmSource || null;
      dadosMautic.utm_medium_mautic = (latestUtm as Record<string, unknown>).utmMedium || null;
      dadosMautic.utm_campaign_mautic = (latestUtm as Record<string, unknown>).utmCampaign || null;
      dadosMautic.utm_content_mautic = (latestUtm as Record<string, unknown>).utmContent || null;
      dadosMautic.utm_term_mautic = (latestUtm as Record<string, unknown>).utmTerm || null;
    }

    // 9. Lógica de MQL
    const eraIsMql = leadExistente ? (leadExistente.is_mql as boolean) : false;
    const eraLevantouMao = leadExistente ? (leadExistente.levantou_mao as boolean) : false;
    const pageHitsAntigos = leadExistente ? (leadExistente.mautic_page_hits as number || 0) : 0;

    // Incrementar page_hits se for evento de page_on_hit
    let pageHitsNovo = pageHitsAntigos;
    if (eventType === 'mautic.page_on_hit') {
      pageHitsNovo = pageHitsAntigos + 1;
    }
    dadosMautic.mautic_page_hits = pageHitsNovo;

    // Verificar MQL
    const deveSerMql = score >= MQL_SCORE_MINIMO || pageHitsNovo >= MQL_PAGE_HITS_MINIMO;
    if (deveSerMql && !eraIsMql) {
      dadosMautic.is_mql = true;
      dadosMautic.data_mql = new Date().toISOString();
      console.log(`[Mautic Webhook] 🎯 Lead virou MQL! Score: ${score}, Page Hits: ${pageHitsNovo}`);
    }

    // Verificar levantou_mao via tags
    const temTagLevantouMao = tagsArray.length > 0 && tagsArray.some(tag =>
      tag && TAGS_LEVANTOU_MAO.some(tl => tag.toLowerCase().includes(tl))
    );
    if (temTagLevantouMao && !eraLevantouMao) {
      dadosMautic.levantou_mao = true;
      dadosMautic.data_levantou_mao = new Date().toISOString();
      console.log(`[Mautic Webhook] 🔥 Lead levantou a mão! Tags: ${tagsArray.join(', ')}`);
    }

    // 10. Upsert do lead
    let leadId: string;
    let eventoWebhook: string;

    if (leadExistente) {
      // Atualizar lead existente
      leadId = leadExistente.id_lead as string;
      eventoWebhook = deveSerMql && !eraIsMql ? 'MQL' : 'SCORE_ATUALIZADO';

      // Remover undefined values
      const updateData = Object.fromEntries(
        Object.entries(dadosMautic).filter(([, v]) => v !== undefined)
      );

      const { error: updateError } = await supabase
        .from('lead')
        .update(updateData)
        .eq('id_lead', leadId);

      if (updateError) {
        console.error(`[Mautic Webhook] Erro ao atualizar lead ${leadId}:`, updateError.message);
        throw new Error(`Erro ao atualizar lead: ${updateError.message}`);
      }

      console.log(`[Mautic Webhook] ✅ Lead atualizado: ${leadId}`);
    } else {
      // Criar lead básico
      eventoWebhook = 'LEAD_NOVO';

      const novoLead: Record<string, unknown> = {
        id_empresa: idEmpresa,
        email: email || null,
        telefone: telefone || null,
        nome_lead: nome,
        origem_tipo: 'ORGANICO',
        origem_canal: 'MAUTIC',
        ...Object.fromEntries(
          Object.entries(dadosMautic).filter(([, v]) => v !== undefined)
        ),
      };

      // Se já é MQL no momento da criação
      if (deveSerMql) {
        novoLead.is_mql = true;
        novoLead.data_mql = new Date().toISOString();
      }

      if (temTagLevantouMao) {
        novoLead.levantou_mao = true;
        novoLead.data_levantou_mao = new Date().toISOString();
      }

      const { data: leadCriado, error: insertError } = await supabase
        .from('lead')
        .insert(novoLead)
        .select('id_lead')
        .single();

      if (insertError) {
        console.error('[Mautic Webhook] Erro ao criar lead:', insertError.message);
        throw new Error(`Erro ao criar lead: ${insertError.message}`);
      }

      leadId = leadCriado.id_lead;
      console.log(`[Mautic Webhook] ✅ Lead criado: ${leadId}`);
    }

    // 11. Registrar evento no lead_evento
    try {
      await supabase.from('lead_evento').insert({
        id_lead: leadId,
        tipo_evento: `MAUTIC_${eventType.replace('mautic.', '').toUpperCase()}`,
        descricao: `Webhook Mautic: ${eventType} | Score: ${score} | Tags: ${tagsArray.join(', ')}`,
        metadados: {
          mautic_contact_id: mauticContactId,
          score,
          tags: tagsArray,
          evento_mautic: eventType,
        },
      });
    } catch (evtErr) {
      console.warn('[Mautic Webhook] Erro ao registrar evento (não-crítico):', evtErr);
    }

    // 12. Disparar webhook SDR se houve transição relevante
    const houveTransicaoMql = deveSerMql && !eraIsMql;
    const houveTransicaoLevantouMao = temTagLevantouMao && !eraLevantouMao;
    const isLeadNovo = !leadExistente;

    if (houveTransicaoMql || houveTransicaoLevantouMao || isLeadNovo) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        console.log(`[Mautic Webhook] 🚀 Disparando webhook SDR - Evento: ${eventoWebhook}`);

        const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/disparar-webhook-leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            lead_ids: [leadId],
            evento: eventoWebhook,
          }),
        });

        const webhookResult = await webhookResponse.text();
        console.log(`[Mautic Webhook] Webhook SDR disparado: ${webhookResponse.status} - ${webhookResult.substring(0, 200)}`);
      } catch (wErr) {
        console.error('[Mautic Webhook] Erro ao disparar webhook SDR (não-crítico):', wErr);
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`[Mautic Webhook] Concluído em ${duracao}ms`);

    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      evento: eventoWebhook,
      is_novo: isLeadNovo,
      mql: deveSerMql,
      levantou_mao: temTagLevantouMao,
      duracao_ms: duracao,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    console.error('[Mautic Webhook] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duracao_ms: duracao,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
