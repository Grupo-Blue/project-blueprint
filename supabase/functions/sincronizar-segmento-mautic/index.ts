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

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id_segmento } = await req.json();
    if (!id_segmento) {
      return new Response(JSON.stringify({ error: 'id_segmento obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get segment info
    const { data: segmento, error: segErr } = await supabase
      .from('lead_segmento')
      .select('*')
      .eq('id', id_segmento)
      .single();
    if (segErr || !segmento) throw new Error('Segmento não encontrado');

    // Get Mautic integration
    const { data: integracoes } = await supabase
      .from('integracao')
      .select('config_json')
      .eq('tipo', 'MAUTIC')
      .eq('ativo', true);

    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma integração Mautic ativa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = integracoes[0].config_json as any;
    const mauticUrl = config.mautic_url?.replace(/\/$/, '');
    const mauticUser = config.mautic_user || config.username;
    const mauticPass = config.mautic_password || config.password;

    if (!mauticUrl || !mauticUser || !mauticPass) {
      throw new Error('Configuração Mautic incompleta');
    }

    const mauticAuth = btoa(`${mauticUser}:${mauticPass}`);
    const mauticHeaders = {
      'Authorization': `Basic ${mauticAuth}`,
      'Content-Type': 'application/json',
    };

    // Check if segment already has a Mautic ID
    let mauticSegmentId = segmento.mautic_segment_id;

    if (!mauticSegmentId) {
      // Create segment in Mautic
      const createRes = await fetch(`${mauticUrl}/api/segments/new`, {
        method: 'POST',
        headers: mauticHeaders,
        body: JSON.stringify({
          name: `SGT - ${segmento.nome}`,
          description: segmento.descricao || `Segmento sincronizado do SGT`,
          isPublished: true,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(`Erro ao criar segmento Mautic: ${JSON.stringify(createData)}`);
      
      mauticSegmentId = String(createData.list?.id || createData.segment?.id);
      
      // Save Mautic segment ID
      await supabase
        .from('lead_segmento')
        .update({ mautic_segment_id: mauticSegmentId })
        .eq('id', id_segmento);
      
      console.log(`✅ Segmento Mautic criado: ${mauticSegmentId}`);
    }

    // Get segment members with email
    const { data: membros } = await supabase
      .from('lead_segmento_membro')
      .select('id_lead, lead:id_lead (email, id_mautic_contact)')
      .eq('id_segmento', id_segmento)
      .is('removido_em', null);

    let adicionados = 0;
    let semEmail = 0;

    for (const membro of (membros || [])) {
      const lead = membro.lead as any;
      if (!lead?.email) { semEmail++; continue; }

      const mauticContactId = lead.id_mautic_contact;

      if (mauticContactId) {
        // Add existing contact to segment
        const addRes = await fetch(
          `${mauticUrl}/api/segments/${mauticSegmentId}/contact/${mauticContactId}/add`,
          { method: 'POST', headers: mauticHeaders }
        );
        if (addRes.ok) adicionados++;
      } else {
        // Search contact by email first
        const searchRes = await fetch(
          `${mauticUrl}/api/contacts?search=email:${encodeURIComponent(lead.email)}&limit=1`,
          { headers: mauticHeaders }
        );
        const searchData = await searchRes.json();
        const contacts = searchData.contacts || {};
        const contactId = Object.keys(contacts)[0];

        if (contactId) {
          const addRes = await fetch(
            `${mauticUrl}/api/segments/${mauticSegmentId}/contact/${contactId}/add`,
            { method: 'POST', headers: mauticHeaders }
          );
          if (addRes.ok) adicionados++;
        }
      }
    }

    console.log(`✅ Sincronização Mautic: ${adicionados} adicionados, ${semEmail} sem email`);

    return new Response(JSON.stringify({
      success: true,
      mautic_segment_id: mauticSegmentId,
      adicionados,
      sem_email: semEmail,
      total_membros: membros?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro sincronizar-segmento-mautic:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
