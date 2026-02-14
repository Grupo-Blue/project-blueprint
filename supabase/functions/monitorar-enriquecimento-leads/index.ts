import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tags que indicam intenção de compra/contato (replicado de lead-scoring.ts)
const TAGS_INTENCAO = [
  "clicou-whatsapp",
  "clicou-agendar",
  "pediu-contato",
  "formulario-contato",
  "solicitou-demo",
];

function differenceInDays(dateA: Date, dateB: Date): number {
  const diffMs = dateA.getTime() - dateB.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function calcularScoreTemperatura(lead: Record<string, unknown>): number {
  let score = 0;

  // === Engajamento Mautic (max ~90 pts) ===
  score += ((lead.mautic_score as number) || 0) * 0.4;
  score += Math.min(((lead.mautic_page_hits as number) || 0) * 5, 50);

  // Bônus de recência Mautic
  if (lead.mautic_last_active) {
    const diasInativo = differenceInDays(new Date(), new Date(lead.mautic_last_active as string));
    if (diasInativo <= 3) score += 15;
    else if (diasInativo <= 7) score += 8;
    else if (diasInativo > 30) score -= 15;
  }

  // Bônus por tags de intenção
  if (lead.mautic_tags) {
    const tags: string[] = Array.isArray(lead.mautic_tags)
      ? lead.mautic_tags
      : typeof lead.mautic_tags === "string"
        ? (lead.mautic_tags as string).split(",").map((t: string) => t.trim().toLowerCase())
        : [];
    const temTagIntencao = tags.some((tag) =>
      TAGS_INTENCAO.some((ti) => tag.toLowerCase().includes(ti))
    );
    if (temTagIntencao) score += 20;
  }

  // === Sinais comerciais (max ~100 pts) ===
  if (lead.levantou_mao) score += 30;
  if (lead.tem_reuniao) score += 50;
  if (lead.is_mql) score += 20;

  // === Dados Tokeniza (max ~70 pts) ===
  if (lead.tokeniza_investidor) score += 40;
  score += Math.min(((lead.tokeniza_qtd_investimentos as number) || 0) * 10, 30);
  if (lead.tokeniza_carrinho_abandonado) score += 35;

  // === Atendimento Chatblue (max ~60 pts) ===
  if (lead.chatblue_sla_violado) score += 25;
  if (lead.chatblue_prioridade === "alta" || lead.chatblue_prioridade === "urgente") score += 15;
  if (lead.chatwoot_status_atendimento === "open") score += 30;
  else if (lead.chatwoot_status_atendimento === "resolved") score += 15;
  score += Math.min(((lead.chatwoot_conversas_total as number) || 0) * 10, 50);
  if (lead.chatwoot_tempo_resposta_medio && (lead.chatwoot_tempo_resposta_medio as number) > 86400) {
    score -= 20;
  }

  // === Qualificação LinkedIn (max ~25 pts) ===
  const senioridade = ((lead.linkedin_senioridade as string) || "").toLowerCase();
  if (senioridade.includes("c-level") || senioridade.includes("diretor") || senioridade.includes("ceo") || senioridade.includes("cfo") || senioridade.includes("cto")) {
    score += 25;
  } else if (senioridade.includes("sênior") || senioridade.includes("senior") || senioridade.includes("gerente") || senioridade.includes("head")) {
    score += 15;
  } else if (senioridade.includes("pleno") || senioridade.includes("analista")) {
    score += 8;
  }

  // === Cliente existente (Notion) ===
  if (lead.id_cliente_notion) score += 25;

  // === Dados Metricool Ads (max ~15 pts) ===
  if (lead.metricool_roas_campanha && (lead.metricool_roas_campanha as number) > 3) {
    score += 10;
  }
  if (lead.metricool_ctr_campanha && (lead.metricool_ctr_campanha as number) > 2) {
    score += 5;
  }

  // === Penalidades ===
  const ultimaData = (lead.data_reuniao || lead.data_levantou_mao || lead.data_mql || lead.data_criacao) as string | null;
  if (ultimaData) {
    const dias = differenceInDays(new Date(), new Date(ultimaData));
    if (dias > 7 && !["Vendido", "Perdido"].includes((lead.stage_atual as string) || "")) {
      score -= Math.min((dias - 7) * 2, 30);
    }
  }

  return Math.max(0, Math.round(score));
}

function getPrioridade(score: number): string {
  if (score >= 120) return "URGENTE";
  if (score >= 70) return "QUENTE";
  if (score >= 30) return "MORNO";
  return "FRIO";
}

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
      .select('id_lead, email, id_empresa, is_mql, levantou_mao, tem_reuniao, stage_atual, mautic_score, mautic_page_hits, mautic_last_active, mautic_tags, mautic_first_visit, mautic_segments, cidade_mautic, estado_mautic, id_mautic_contact, tokeniza_investidor, tokeniza_valor_investido, tokeniza_qtd_investimentos, tokeniza_carrinho_abandonado, chatblue_sla_violado, chatblue_prioridade, chatwoot_status_atendimento, chatwoot_conversas_total, chatwoot_tempo_resposta_medio, linkedin_senioridade, id_cliente_notion, data_criacao, data_mql, data_levantou_mao, data_reuniao, score_temperatura, updated_at, webhook_enviado_em, id_campanha_vinculada, metricool_roas_campanha, metricool_cpc_campanha, metricool_ctr_campanha, metricool_conversao_valor, metricool_fonte, utm_source, utm_medium')
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
    let leadsMetricoolMudou = 0;
    let leadsScoreCruzouThreshold = 0;
    let leadsScoreAtualizado = 0;

    for (const lead of leads || []) {
      if (!lead.email) continue;

      let mauticMudou = false;
      let tokenizaMudou = false;
      let metricoolMudou = false;

      // Verificar mudanças no Mautic
      try {
        const mauticResponse = await supabase.functions.invoke('enriquecer-lead-mautic', {
          body: { email: lead.email, id_empresa: lead.id_empresa }
        });

        if (mauticResponse.data?.success && mauticResponse.data?.data) {
          const novoMautic = mauticResponse.data.data;
          
          if (
            lead.mautic_score !== novoMautic.score ||
            lead.mautic_page_hits !== novoMautic.pageHits ||
            JSON.stringify(lead.mautic_tags) !== JSON.stringify(novoMautic.tags)
          ) {
            mauticMudou = true;
            leadsMauticMudou++;
            
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

      // === Enriquecer com dados Metricool Ads ===
      if (lead.id_campanha_vinculada) {
        try {
          // Buscar métricas Metricool da campanha vinculada (últimos 30 dias)
          const { data: metricasCampanha } = await supabase
            .from('campanha_metricas_dia')
            .select('verba_investida, cliques, impressoes, conversoes, valor_conversao, fonte_conversoes')
            .eq('id_campanha', lead.id_campanha_vinculada)
            .not('fonte_conversoes', 'is', null)
            .order('data', { ascending: false })
            .limit(30);

          if (metricasCampanha && metricasCampanha.length > 0) {
            // Agregar métricas
            let totalSpent = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalConversionValue = 0;
            let fonte = '';
            for (const m of metricasCampanha) {
              totalSpent += m.verba_investida || 0;
              totalClicks += m.cliques || 0;
              totalImpressions += m.impressoes || 0;
              totalConversions += m.conversoes || 0;
              totalConversionValue += m.valor_conversao || 0;
              if (!fonte && m.fonte_conversoes) {
                fonte = m.fonte_conversoes.includes('GOOGLE') ? 'GOOGLE' : 'META';
              }
            }

            const roas = totalSpent > 0 ? totalConversionValue / totalSpent : 0;
            const cpc = totalClicks > 0 ? totalSpent / totalClicks : 0;
            const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

            // Verificar se mudou
            const roasAnterior = (lead.metricool_roas_campanha as number) || 0;
            const cpcAnterior = (lead.metricool_cpc_campanha as number) || 0;

            if (Math.abs(roas - roasAnterior) > 0.1 || Math.abs(cpc - cpcAnterior) > 0.5) {
              await supabase.from('lead').update({
                metricool_roas_campanha: Math.round(roas * 100) / 100,
                metricool_cpc_campanha: Math.round(cpc * 100) / 100,
                metricool_ctr_campanha: Math.round(ctr * 100) / 100,
                metricool_conversao_valor: Math.round(totalConversionValue * 100) / 100,
                metricool_fonte: fonte || null,
              }).eq('id_lead', lead.id_lead);

              metricoolMudou = true;
              leadsMetricoolMudou++;
              console.log(`[Metricool] Lead ${lead.id_lead} enriquecido - ROAS: ${roas.toFixed(2)}, CPC: ${cpc.toFixed(2)}, fonte: ${fonte}`);
            }
          }
        } catch (metricoolError) {
          console.error(`[Metricool] Erro ao enriquecer lead ${lead.id_lead}:`, metricoolError);
        }
      }

      // === Vincular lead a post orgânico ===
      if (!lead.id_post_organico_vinculado && lead.utm_source && lead.utm_medium === 'organic') {
        try {
          const rede = (lead.utm_source as string).toLowerCase();
          if (['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'].includes(rede)) {
            const dataCriacao = lead.data_criacao as string;
            if (dataCriacao) {
              const dataLead = new Date(dataCriacao);
              const dataInicio = new Date(dataLead);
              dataInicio.setDate(dataInicio.getDate() - 3); // 3 dias antes

              const { data: postsProximos } = await supabase
                .from('social_posts')
                .select('id')
                .eq('id_empresa', lead.id_empresa)
                .eq('rede', rede)
                .gte('data_publicacao', dataInicio.toISOString())
                .lte('data_publicacao', dataCriacao)
                .order('data_publicacao', { ascending: false })
                .limit(1);

              if (postsProximos && postsProximos.length > 0) {
                await supabase.from('lead').update({
                  id_post_organico_vinculado: postsProximos[0].id,
                }).eq('id_lead', lead.id_lead);
                console.log(`[Orgânico] Lead ${lead.id_lead} vinculado ao post ${postsProximos[0].id}`);
              }
            }
          }
        } catch (orgError) {
          console.error(`[Orgânico] Erro ao vincular lead ${lead.id_lead}:`, orgError);
        }
      }

      if (mauticMudou || tokenizaMudou || metricoolMudou) {
        leadsAtualizados++;
      }

      // === Calcular score de temperatura ===
      // Re-fetch lead with latest data after enrichment
      const { data: leadAtualizado } = await supabase
        .from('lead')
        .select('*')
        .eq('id_lead', lead.id_lead)
        .single();

      if (!leadAtualizado) continue;

      const scoreAnterior = lead.score_temperatura || 0;
      const scoreNovo = calcularScoreTemperatura(leadAtualizado);
      const prioridade = getPrioridade(scoreNovo);

      // Persistir score se mudou
      if (scoreNovo !== scoreAnterior) {
        await supabase.from('lead').update({
          score_temperatura: scoreNovo
        }).eq('id_lead', lead.id_lead);

        console.log(`[Score] Lead ${lead.id_lead}: ${scoreAnterior} -> ${scoreNovo} (${prioridade})`);
      }

      // === Verificar se deve disparar webhook para CRM ===
      const DEFAULT_THRESHOLD = 70;

      // Caso 1: Lead cruzou o threshold (era frio/morno, agora quente)
      if (scoreAnterior < DEFAULT_THRESHOLD && scoreNovo >= DEFAULT_THRESHOLD) {
        leadsScoreCruzouThreshold++;
        console.log(`[CRM] Lead ${lead.id_lead} cruzou threshold! Score: ${scoreNovo} - Disparando MQL`);
        
        try {
          await supabase.functions.invoke('disparar-webhook-leads', {
            body: {
              lead_ids: [lead.id_lead],
              evento: 'MQL'
            }
          });
        } catch (webhookError) {
          console.error(`[CRM] Erro ao disparar webhook MQL para lead ${lead.id_lead}:`, webhookError);
        }
      }
      // Caso 2: Lead já estava quente e score mudou significativamente (>15 pts)
      else if (scoreAnterior >= DEFAULT_THRESHOLD && scoreNovo >= DEFAULT_THRESHOLD && Math.abs(scoreNovo - scoreAnterior) > 15) {
        leadsScoreAtualizado++;
        console.log(`[CRM] Lead ${lead.id_lead} score atualizado significativamente: ${scoreAnterior} -> ${scoreNovo}`);
        
        try {
          await supabase.functions.invoke('disparar-webhook-leads', {
            body: {
              lead_ids: [lead.id_lead],
              evento: 'SCORE_ATUALIZADO'
            }
          });
        } catch (webhookError) {
          console.error(`[CRM] Erro ao disparar webhook SCORE_ATUALIZADO para lead ${lead.id_lead}:`, webhookError);
        }
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
        tokeniza_mudancas: leadsTokenizaMudou,
        metricool_mudancas: leadsMetricoolMudou,
        leads_cruzaram_threshold: leadsScoreCruzouThreshold,
        leads_score_atualizado: leadsScoreAtualizado
      }
    });

    console.log(`[Monitorar Enriquecimento] Concluído em ${duracao}ms - ${leadsAtualizados} atualizados, ${leadsMetricoolMudou} metricool, ${leadsScoreCruzouThreshold} cruzaram threshold`);

    return new Response(JSON.stringify({
      success: true,
      leads_verificados: leads?.length || 0,
      leads_atualizados: leadsAtualizados,
      mautic_mudancas: leadsMauticMudou,
      tokeniza_mudancas: leadsTokenizaMudou,
      metricool_mudancas: leadsMetricoolMudou,
      leads_cruzaram_threshold: leadsScoreCruzouThreshold,
      leads_score_atualizado: leadsScoreAtualizado,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    console.error('[Monitorar Enriquecimento] Erro:', error);

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
