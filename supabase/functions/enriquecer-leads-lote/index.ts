import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      throw new Error('id_empresa é obrigatório');
    }

    console.log(`[Lote Mautic] Iniciando enriquecimento em lote para empresa: ${id_empresa}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os leads da empresa que têm email
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, email, id_empresa, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
      .eq('id_empresa', id_empresa)
      .not('email', 'is', null);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead com email encontrado para enriquecer',
          processados: 0,
          enriquecidos: 0,
          erros: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[Lote Mautic] ${leads.length} leads encontrados com email`);

    let processados = 0;
    let enriquecidos = 0;
    let erros = 0;

    // Processar cada lead
    for (const lead of leads) {
      try {
        console.log(`[Lote Mautic] Processando lead ${lead.id_lead} - ${lead.email}`);

        // Chamar a função de enriquecimento
        const { data: enrichmentData, error: enrichmentError } = await supabase.functions.invoke(
          'enriquecer-lead-mautic',
          {
            body: { 
              email: lead.email,
              id_empresa: lead.id_empresa
            }
          }
        );

        if (enrichmentError) {
          console.error(`[Lote Mautic] Erro ao enriquecer lead ${lead.id_lead}:`, enrichmentError);
          erros++;
          processados++;
          continue;
        }

        // Se o enriquecimento foi bem-sucedido, atualizar o lead
        if (enrichmentData?.success && enrichmentData?.data) {
          const { error: updateError } = await supabase
            .from('lead')
            .update({
              id_mautic_contact: enrichmentData.data.id_mautic_contact,
              mautic_score: enrichmentData.data.mautic_score,
              mautic_page_hits: enrichmentData.data.mautic_page_hits,
              mautic_last_active: enrichmentData.data.mautic_last_active,
              mautic_first_visit: enrichmentData.data.mautic_first_visit,
              mautic_tags: enrichmentData.data.mautic_tags,
              mautic_segments: enrichmentData.data.mautic_segments,
              cidade_mautic: enrichmentData.data.cidade_mautic,
              estado_mautic: enrichmentData.data.estado_mautic,
              // UTM fallback: só atualiza se estiver vazio no lead
              utm_source: lead.utm_source || enrichmentData.data.utm_source_mautic,
              utm_medium: lead.utm_medium || enrichmentData.data.utm_medium_mautic,
              utm_campaign: lead.utm_campaign || enrichmentData.data.utm_campaign_mautic,
              utm_content: lead.utm_content || enrichmentData.data.utm_content_mautic,
              utm_term: lead.utm_term || enrichmentData.data.utm_term_mautic,
            })
            .eq('id_lead', lead.id_lead);

          if (updateError) {
            console.error(`[Lote Mautic] Erro ao atualizar lead ${lead.id_lead}:`, updateError);
            erros++;
          } else {
            console.log(`[Lote Mautic] Lead ${lead.id_lead} enriquecido com sucesso`);
            enriquecidos++;
          }
        } else {
          console.log(`[Lote Mautic] Lead ${lead.id_lead} - contato não encontrado no Mautic`);
        }

        processados++;

      } catch (error) {
        console.error(`[Lote Mautic] Erro ao processar lead ${lead.id_lead}:`, error);
        erros++;
        processados++;
      }
    }

    console.log(`[Lote Mautic] Processamento concluído - ${processados} processados, ${enriquecidos} enriquecidos, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Enriquecimento em lote concluído`,
        processados,
        enriquecidos,
        erros,
        total_leads: leads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Lote Mautic] Erro no processamento em lote:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Erro ao processar enriquecimento em lote' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
