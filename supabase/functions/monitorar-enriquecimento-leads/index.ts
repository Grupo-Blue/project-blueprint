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
  console.log('[Monitorar Enriquecimento] Iniciando verificação de mudanças...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar leads atualizados nos últimos 10 minutos OU que nunca foram verificados
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, email, id_empresa, is_mql, mautic_score, mautic_page_hits, mautic_last_active, mautic_tags, tokeniza_investidor, tokeniza_valor_investido, tokeniza_qtd_investimentos, tokeniza_carrinho_abandonado, updated_at, webhook_enviado_em')
      .or(`updated_at.gte.${tenMinutesAgo},webhook_enviado_em.is.null`)
      .not('email', 'is', null)
      .eq('merged', false)
      .limit(100);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`[Monitorar Enriquecimento] ${leads?.length || 0} leads para verificar`);

    let leadsAtualizados = 0;
    let leadsMauticMudou = 0;
    let leadsTokenizaMudou = 0;

    for (const lead of leads || []) {
      if (!lead.email) continue;

      let mauticMudou = false;
      let tokenizaMudou = false;

      // Verificar mudanças no Mautic
      try {
        const mauticResponse = await supabase.functions.invoke('enriquecer-lead-mautic', {
          body: { email: lead.email, id_empresa: lead.id_empresa }
        });

        if (mauticResponse.data?.success && mauticResponse.data?.data) {
          const novoMautic = mauticResponse.data.data;
          
          // Comparar valores
          if (
            lead.mautic_score !== novoMautic.score ||
            lead.mautic_page_hits !== novoMautic.pageHits ||
            JSON.stringify(lead.mautic_tags) !== JSON.stringify(novoMautic.tags)
          ) {
            mauticMudou = true;
            leadsMauticMudou++;
            
            // Atualizar lead com novos dados Mautic
            await supabase.from('lead').update({
              mautic_score: novoMautic.score,
              mautic_page_hits: novoMautic.pageHits,
              mautic_last_active: novoMautic.lastActive,
              mautic_first_visit: novoMautic.firstVisit,
              mautic_tags: novoMautic.tags,
              mautic_segments: novoMautic.segments,
              cidade_mautic: novoMautic.cidade,
              estado_mautic: novoMautic.estado,
              id_mautic_contact: novoMautic.mauticId,
              // Atualizar MQL se atingir critérios
              is_mql: novoMautic.score >= 50 || novoMautic.pageHits >= 10 || lead.is_mql
            }).eq('id_lead', lead.id_lead);

            console.log(`[Mautic] Lead ${lead.id_lead} atualizado - score: ${novoMautic.score}`);
          }
        }
      } catch (mauticError) {
        console.error(`[Mautic] Erro ao verificar lead ${lead.id_lead}:`, mauticError);
      }

      // Verificar mudanças na Tokeniza
      try {
        const tokenizaResponse = await supabase.functions.invoke('enriquecer-leads-tokeniza', {
          body: { email: lead.email, id_lead: lead.id_lead }
        });

        if (tokenizaResponse.data?.enriched && tokenizaResponse.data?.data) {
          const novoTokeniza = tokenizaResponse.data.data;
          
          // Comparar valores
          if (
            lead.tokeniza_investidor !== novoTokeniza.investidor ||
            lead.tokeniza_valor_investido !== novoTokeniza.valor_investido ||
            lead.tokeniza_qtd_investimentos !== novoTokeniza.qtd_investimentos ||
            lead.tokeniza_carrinho_abandonado !== novoTokeniza.carrinho_abandonado
          ) {
            tokenizaMudou = true;
            leadsTokenizaMudou++;
            console.log(`[Tokeniza] Lead ${lead.id_lead} atualizado - investidor: ${novoTokeniza.investidor}`);
          }
        }
      } catch (tokenizaError) {
        console.error(`[Tokeniza] Erro ao verificar lead ${lead.id_lead}:`, tokenizaError);
      }

      if (mauticMudou || tokenizaMudou) {
        leadsAtualizados++;
      }
    }

    const duracao = Date.now() - startTime;

    // Registrar execução do cronjob
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'monitorar-enriquecimento-leads',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        leads_verificados: leads?.length || 0,
        leads_atualizados: leadsAtualizados,
        mautic_mudancas: leadsMauticMudou,
        tokeniza_mudancas: leadsTokenizaMudou
      }
    });

    console.log(`[Monitorar Enriquecimento] Concluído em ${duracao}ms - ${leadsAtualizados} leads atualizados`);

    return new Response(JSON.stringify({
      success: true,
      leads_verificados: leads?.length || 0,
      leads_atualizados: leadsAtualizados,
      mautic_mudancas: leadsMauticMudou,
      tokeniza_mudancas: leadsTokenizaMudou,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    console.error('[Monitorar Enriquecimento] Erro:', error);

    // Criar cliente para registrar erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from('cronjob_execucao').insert({
        nome_cronjob: 'monitorar-enriquecimento-leads',
        status: 'erro',
        duracao_ms: duracao,
        mensagem_erro: error instanceof Error ? error.message : String(error)
      });
    } catch (logError) {
      console.error('[Monitorar Enriquecimento] Erro ao registrar log:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
