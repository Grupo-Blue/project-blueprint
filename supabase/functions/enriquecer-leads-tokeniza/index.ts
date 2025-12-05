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
    const { email, id_lead } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Se recebeu email específico, enriquecer apenas esse lead
    if (email) {
      console.log(`[enriquecer-leads-tokeniza] Enriquecendo lead com email: ${email}`);
      const result = await enrichLeadByEmail(supabase, email, id_lead);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Caso contrário, enriquecer todos os leads em lote
    console.log('[enriquecer-leads-tokeniza] Iniciando enriquecimento em lote');

    // Buscar todos os leads com email
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, email')
      .not('email', 'is', null);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`[enriquecer-leads-tokeniza] ${leads?.length || 0} leads encontrados`);

    let totalEnriquecidos = 0;
    let totalInvestidores = 0;
    let totalCarrinhosAbandonados = 0;

    for (const lead of leads || []) {
      const result = await enrichLeadByEmail(supabase, lead.email, lead.id_lead);
      if (result.enriched) {
        totalEnriquecidos++;
        if (result.data?.tokeniza_investidor) totalInvestidores++;
        if (result.data?.tokeniza_carrinho_abandonado) totalCarrinhosAbandonados++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[enriquecer-leads-tokeniza] Concluído em ${duration}ms - ${totalEnriquecidos} enriquecidos`);

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-leads-tokeniza',
      status: 'sucesso',
      duracao_ms: duration,
      detalhes_execucao: {
        total_leads: leads?.length || 0,
        total_enriquecidos: totalEnriquecidos,
        total_investidores: totalInvestidores,
        total_carrinhos_abandonados: totalCarrinhosAbandonados
      }
    });

    return new Response(JSON.stringify({
      success: true,
      totalLeads: leads?.length || 0,
      totalEnriquecidos,
      totalInvestidores,
      totalCarrinhosAbandonados,
      duracaoMs: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[enriquecer-leads-tokeniza] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function enrichLeadByEmail(supabase: any, email: string, id_lead?: string) {
  try {
    // 1. Buscar usuário Tokeniza pelo email (case-insensitive)
    const { data: tokenizaUser, error: userError } = await supabase
      .from('tokeniza_usuario')
      .select('user_id_tokeniza, email, first_name, last_name')
      .ilike('email', email)
      .maybeSingle();

    if (userError) {
      console.error(`[enriquecer-leads-tokeniza] Erro ao buscar usuário: ${userError.message}`);
      return { enriched: false, error: userError.message };
    }

    if (!tokenizaUser) {
      // Usuário não encontrado na base Tokeniza
      return { enriched: false, reason: 'usuario_nao_encontrado' };
    }

    const userId = tokenizaUser.user_id_tokeniza;

    // 2. Buscar investimentos FINISHED do usuário
    const { data: investimentos, error: investError } = await supabase
      .from('tokeniza_investimento')
      .select('id, amount, status, data_criacao, project_id')
      .eq('user_id_tokeniza', userId);

    if (investError) {
      console.error(`[enriquecer-leads-tokeniza] Erro ao buscar investimentos: ${investError.message}`);
      return { enriched: false, error: investError.message };
    }

    // 3. Buscar vendas do usuário
    const { data: vendas, error: vendasError } = await supabase
      .from('tokeniza_venda')
      .select('id, total_amount, status, data_criacao, was_paid')
      .eq('user_id_tokeniza', userId);

    if (vendasError) {
      console.error(`[enriquecer-leads-tokeniza] Erro ao buscar vendas: ${vendasError.message}`);
    }

    // 4. Calcular métricas
    const investimentosFinished = (investimentos || []).filter((i: any) => i.status === 'FINISHED');
    const investimentosPendentes = (investimentos || []).filter((i: any) => i.status === 'CREATED');
    
    const valorInvestido = investimentosFinished.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
    const qtdInvestimentos = investimentosFinished.length;
    const projetos = [...new Set(investimentosFinished.map((i: any) => i.project_id).filter(Boolean))];
    
    // Ordenar por data para encontrar primeiro e último
    const investimentosOrdenados = investimentosFinished
      .filter((i: any) => i.data_criacao)
      .sort((a: any, b: any) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime());
    
    const primeiroInvestimento = investimentosOrdenados[0]?.data_criacao || null;
    const ultimoInvestimento = investimentosOrdenados[investimentosOrdenados.length - 1]?.data_criacao || null;

    // Carrinho abandonado: tem CREATED sem FINISHED correspondente
    const carrinhoAbandonado = investimentosPendentes.length > 0;
    const valorCarrinho = investimentosPendentes.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);

    // Também considerar vendas pagas
    const vendasPagas = (vendas || []).filter((v: any) => v.was_paid);
    const valorVendas = vendasPagas.reduce((sum: number, v: any) => sum + (Number(v.total_amount) || 0), 0);

    // Dados de enriquecimento
    const enrichmentData = {
      tokeniza_user_id: userId,
      tokeniza_investidor: qtdInvestimentos > 0 || vendasPagas.length > 0,
      tokeniza_valor_investido: valorInvestido + valorVendas,
      tokeniza_qtd_investimentos: qtdInvestimentos + vendasPagas.length,
      tokeniza_primeiro_investimento: primeiroInvestimento,
      tokeniza_ultimo_investimento: ultimoInvestimento,
      tokeniza_projetos: projetos,
      tokeniza_carrinho_abandonado: carrinhoAbandonado,
      tokeniza_valor_carrinho: valorCarrinho
    };

    // 5. Atualizar lead
    let updateQuery = supabase.from('lead').update(enrichmentData);
    
    if (id_lead) {
      updateQuery = updateQuery.eq('id_lead', id_lead);
    } else {
      updateQuery = updateQuery.eq('email', email);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error(`[enriquecer-leads-tokeniza] Erro ao atualizar lead: ${updateError.message}`);
      return { enriched: false, error: updateError.message };
    }

    console.log(`[enriquecer-leads-tokeniza] Lead enriquecido: ${email} - Investidor: ${enrichmentData.tokeniza_investidor}, Valor: R$ ${enrichmentData.tokeniza_valor_investido}`);

    return { 
      enriched: true, 
      data: enrichmentData 
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[enriquecer-leads-tokeniza] Erro ao enriquecer ${email}:`, error);
    return { enriched: false, error: errorMessage };
  }
}
