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

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Optional: pass batch_size and offset for pagination
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 50;
    const offset = body.offset || 0;

    // Get Mautic integration config
    const { data: integracoes } = await supabase
      .from('integracao')
      .select('config_json')
      .eq('tipo', 'MAUTIC')
      .eq('ativo', true)
      .limit(1);

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma integração Mautic ativa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = integracoes[0].config_json as any;
    const mauticUrl = (config.url_base || config.mautic_url || '').replace(/\/$/, '');
    const mauticUser = config.login || config.mautic_user || config.username;
    const mauticPass = config.senha || config.mautic_password || config.password;

    if (!mauticUrl || !mauticUser || !mauticPass) {
      return new Response(JSON.stringify({ error: 'Config Mautic incompleta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const basicAuth = btoa(`${mauticUser}:${mauticPass}`);
    const mauticHeaders = {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    };

    // Get leads with mautic contact ID but no segments populated yet
    const { data: leads, error: leadsErr } = await supabase
      .from('lead')
      .select('id_lead, id_mautic_contact, email')
      .eq('merged', false)
      .not('id_mautic_contact', 'is', null)
      .is('mautic_segments', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (leadsErr) throw new Error(`Erro ao buscar leads: ${leadsErr.message}`);
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, done: true, processed: 0, 
        message: 'Todos os leads já foram processados' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Batch Mautic] Processando ${leads.length} leads (offset: ${offset})`);

    let updated = 0;
    let errors = 0;
    let doNotContactCount = 0;

    for (const lead of leads) {
      try {
        // Fetch contact details from Mautic
        const res = await fetch(
          `${mauticUrl}/api/contacts/${lead.id_mautic_contact}`,
          { headers: mauticHeaders }
        );

        if (!res.ok) {
          console.warn(`[Batch Mautic] Erro ao buscar contato ${lead.id_mautic_contact}: ${res.status}`);
          errors++;
          continue;
        }

        const data = await res.json();
        const contact = data.contact;
        if (!contact) { errors++; continue; }

        // Extract segments
        const segments: { id: number; name: string }[] = [];
        if (contact.segments && typeof contact.segments === 'object') {
          for (const key of Object.keys(contact.segments)) {
            const seg = contact.segments[key];
            if (seg && seg.id) {
              segments.push({ id: Number(seg.id), name: seg.name || seg.alias || '' });
            }
          }
        }

        // Extract doNotContact
        const dnc = Array.isArray(contact.doNotContact) && contact.doNotContact.length > 0;
        if (dnc) doNotContactCount++;

        // Update lead
        const updateData: Record<string, unknown> = {
          mautic_segments: segments.length > 0 ? segments : [],
          mautic_do_not_contact: dnc,
        };

        const { error: upErr } = await supabase
          .from('lead')
          .update(updateData)
          .eq('id_lead', lead.id_lead);

        if (upErr) {
          console.warn(`[Batch Mautic] Erro ao atualizar lead ${lead.id_lead}: ${upErr.message}`);
          errors++;
        } else {
          updated++;
        }

        // Small delay to not hammer Mautic API
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.warn(`[Batch Mautic] Erro no lead ${lead.id_lead}:`, err);
        errors++;
      }
    }

    const duracao = Date.now() - startTime;
    const hasMore = leads.length === batchSize;

    console.log(`[Batch Mautic] ✅ Concluído: ${updated} atualizados, ${errors} erros, ${doNotContactCount} DNC, ${duracao}ms`);

    return new Response(JSON.stringify({
      success: true,
      done: !hasMore,
      processed: leads.length,
      updated,
      errors,
      do_not_contact_found: doNotContactCount,
      next_offset: hasMore ? offset + batchSize : null,
      duracao_ms: duracao,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Batch Mautic] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
