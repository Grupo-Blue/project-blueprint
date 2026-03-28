import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const { data: segmento } = await supabase
      .from('lead_segmento')
      .select('*, id_empresa')
      .eq('id', id_segmento)
      .single();
    if (!segmento) throw new Error('Segmento não encontrado');

    // Get Meta config from empresa_stape_config
    const { data: stapeConfig } = await supabase
      .from('empresa_stape_config')
      .select('meta_pixel_id, meta_capi_token')
      .eq('id_empresa', segmento.id_empresa)
      .eq('ativo', true)
      .maybeSingle();

    if (!stapeConfig?.meta_capi_token) {
      return new Response(JSON.stringify({ error: 'Token Meta CAPI não configurado para esta empresa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get ad_account_id from conta_anuncio
    const { data: contas } = await supabase
      .from('conta_anuncio')
      .select('id_externo')
      .eq('id_empresa', segmento.id_empresa)
      .eq('plataforma', 'META')
      .eq('ativa', true)
      .limit(1);

    if (!contas || contas.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma conta Meta Ads ativa encontrada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adAccountId = contas[0].id_externo.startsWith('act_') 
      ? contas[0].id_externo 
      : `act_${contas[0].id_externo}`;
    const accessToken = stapeConfig.meta_capi_token;

    // Get segment members with email/phone
    const { data: membros } = await supabase
      .from('lead_segmento_membro')
      .select('id_lead, lead:id_lead (email, telefone, nome_lead)')
      .eq('id_segmento', id_segmento)
      .is('removido_em', null);

    // Hash identifiers
    const schema = ['EMAIL', 'PHONE', 'FN', 'LN'];
    const dataRows: string[][] = [];

    for (const membro of (membros || [])) {
      const lead = membro.lead as any;
      if (!lead?.email && !lead?.telefone) continue;

      const email = lead.email ? await sha256(lead.email) : '';
      const phone = lead.telefone ? await sha256(lead.telefone.replace(/\D/g, '')) : '';
      const nomeParts = (lead.nome_lead || '').split(' ');
      const fn = nomeParts[0] ? await sha256(nomeParts[0]) : '';
      const ln = nomeParts.length > 1 ? await sha256(nomeParts[nomeParts.length - 1]) : '';

      dataRows.push([email, phone, fn, ln]);
    }

    if (dataRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro com email ou telefone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let metaAudienceId = segmento.meta_audience_id;

    if (!metaAudienceId) {
      // Create Custom Audience
      const createRes = await fetch(
        `https://graph.facebook.com/v22.0/${adAccountId}/customaudiences`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            name: `SGT - ${segmento.nome}`,
            subtype: 'CUSTOM',
            description: segmento.descricao || 'Segmento sincronizado do SGT',
            customer_file_source: 'USER_PROVIDED_ONLY',
          }),
        }
      );
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(`Erro ao criar audiência: ${JSON.stringify(createData)}`);
      
      metaAudienceId = createData.id;

      await supabase
        .from('lead_segmento')
        .update({ meta_audience_id: metaAudienceId })
        .eq('id', id_segmento);

      console.log(`✅ Custom Audience criada: ${metaAudienceId}`);
    }

    // Upload users in batches of 500
    const batchSize = 500;
    let totalUploaded = 0;

    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      
      const uploadRes = await fetch(
        `https://graph.facebook.com/v22.0/${metaAudienceId}/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            payload: {
              schema,
              data: batch,
            },
          }),
        }
      );
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        console.error(`❌ Erro ao enviar batch ${i}:`, uploadData);
      } else {
        totalUploaded += uploadData.num_received || batch.length;
      }
    }

    console.log(`✅ Meta Ads: ${totalUploaded} usuários enviados para audiência ${metaAudienceId}`);

    return new Response(JSON.stringify({
      success: true,
      meta_audience_id: metaAudienceId,
      usuarios_enviados: totalUploaded,
      total_membros: membros?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro exportar-segmento-meta:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
