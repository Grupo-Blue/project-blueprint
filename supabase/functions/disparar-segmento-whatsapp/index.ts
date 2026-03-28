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

    const { id_segmento, nome_disparo, descricao } = await req.json();
    if (!id_segmento) {
      return new Response(JSON.stringify({ error: 'id_segmento obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get segment
    const { data: segmento } = await supabase
      .from('lead_segmento')
      .select('*')
      .eq('id', id_segmento)
      .single();
    if (!segmento) throw new Error('Segmento não encontrado');

    // Get members with phone
    const { data: membros } = await supabase
      .from('lead_segmento_membro')
      .select('id_lead, lead:id_lead (telefone, nome_lead)')
      .eq('id_segmento', id_segmento)
      .is('removido_em', null);

    const leadsComTelefone = (membros || []).filter((m: any) => {
      const tel = m.lead?.telefone?.replace(/\D/g, '');
      return tel && tel.length >= 10;
    });

    if (leadsComTelefone.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum membro com telefone válido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create disparo_whatsapp record
    const { data: disparo, error: disparoErr } = await supabase
      .from('disparo_whatsapp')
      .insert({
        id_empresa: segmento.id_empresa,
        nome: nome_disparo || `Segmento: ${segmento.nome}`,
        descricao: descricao || `Disparo automático do segmento ${segmento.nome}`,
        qtd_leads: leadsComTelefone.length,
        created_by: user.id,
        filtros_aplicados: { segmento_id: id_segmento, segmento_nome: segmento.nome },
        enviado: false,
      })
      .select()
      .single();

    if (disparoErr) throw new Error(`Erro ao criar disparo: ${disparoErr.message}`);

    // Link leads to disparo in batches
    const batchSize = 500;
    for (let i = 0; i < leadsComTelefone.length; i += batchSize) {
      const batch = leadsComTelefone.slice(i, i + batchSize).map((m: any) => ({
        id_disparo: disparo.id,
        id_lead: m.id_lead,
      }));
      await supabase.from('disparo_whatsapp_lead').insert(batch);
    }

    console.log(`✅ Disparo WhatsApp criado: ${disparo.id} com ${leadsComTelefone.length} leads`);

    return new Response(JSON.stringify({
      success: true,
      id_disparo: disparo.id,
      leads_com_telefone: leadsComTelefone.length,
      total_membros: membros?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro disparar-segmento-whatsapp:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
