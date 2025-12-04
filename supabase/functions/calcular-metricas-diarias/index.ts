import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Empresa {
  id_empresa: string;
  nome: string;
}

interface Lead {
  id_lead: string;
  is_mql: boolean;
  levantou_mao: boolean;
  tem_reuniao: boolean;
  reuniao_realizada: boolean;
  venda_realizada: boolean;
  valor_venda: number | null;
  lead_pago: boolean;
  id_criativo: string | null;
}

interface CampanhaMetricaDia {
  id_campanha: string;
  verba_investida: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pegar data do body ou usar ontem
    const body = await req.json().catch(() => ({}));
    let dataCalculo: string;
    
    if (body.data === 'yesterday' || !body.data) {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      dataCalculo = ontem.toISOString().split('T')[0];
    } else if (body.data === 'today') {
      dataCalculo = new Date().toISOString().split('T')[0];
    } else {
      dataCalculo = body.data;
    }

    console.log(`📊 Calculando métricas diárias para: ${dataCalculo}`);

    // Buscar todas as empresas
    const { data: empresas, error: errorEmpresas } = await supabase
      .from('empresa')
      .select('id_empresa, nome');

    if (errorEmpresas) throw errorEmpresas;
    if (!empresas || empresas.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma empresa encontrada' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📋 Processando ${empresas.length} empresas`);

    let empresasProcessadas = 0;
    let campanhasProcessadas = 0;

    for (const empresa of empresas as Empresa[]) {
      console.log(`\n🏢 Processando empresa: ${empresa.nome}`);

      // Buscar leads criados nesta data
      const { data: leadsCriados, error: errorLeads } = await supabase
        .from('lead')
        .select('id_lead, is_mql, levantou_mao, tem_reuniao, reuniao_realizada, venda_realizada, valor_venda, lead_pago, id_criativo')
        .eq('id_empresa', empresa.id_empresa)
        .gte('data_criacao', `${dataCalculo}T00:00:00`)
        .lt('data_criacao', `${dataCalculo}T23:59:59.999`);

      if (errorLeads) {
        console.error(`Erro ao buscar leads: ${errorLeads.message}`);
        continue;
      }

      // Buscar vendas realizadas nesta data
      const { data: vendasRealizadas, error: errorVendas } = await supabase
        .from('lead')
        .select('id_lead, valor_venda')
        .eq('id_empresa', empresa.id_empresa)
        .eq('venda_realizada', true)
        .gte('data_venda', `${dataCalculo}T00:00:00`)
        .lt('data_venda', `${dataCalculo}T23:59:59.999`);

      if (errorVendas) {
        console.error(`Erro ao buscar vendas: ${errorVendas.message}`);
      }

      // Buscar verba investida nas campanhas da empresa
      const { data: contasAnuncio } = await supabase
        .from('conta_anuncio')
        .select('id_conta')
        .eq('id_empresa', empresa.id_empresa);

      let verbaInvestida = 0;
      
      if (contasAnuncio && contasAnuncio.length > 0) {
        const contaIds = contasAnuncio.map(c => c.id_conta);
        
        const { data: campanhas } = await supabase
          .from('campanha')
          .select('id_campanha')
          .in('id_conta', contaIds);

        if (campanhas && campanhas.length > 0) {
          const campanhaIds = campanhas.map(c => c.id_campanha);
          
          const { data: metricasCampanha } = await supabase
            .from('campanha_metricas_dia')
            .select('verba_investida')
            .in('id_campanha', campanhaIds)
            .eq('data', dataCalculo);

          if (metricasCampanha) {
            verbaInvestida = metricasCampanha.reduce((sum, m) => sum + (Number(m.verba_investida) || 0), 0);
          }
        }
      }

      // Calcular métricas dos leads
      const leads = leadsCriados || [];
      const leadsTotal = leads.length;
      const leadsPagos = leads.filter(l => l.lead_pago === true).length;
      const mqls = leads.filter(l => l.is_mql === true).length;
      const levantadas = leads.filter(l => l.levantou_mao === true).length;
      const reunioes = leads.filter(l => l.tem_reuniao === true || l.reuniao_realizada === true).length;
      
      // Vendas e valor das vendas do dia
      const vendas = vendasRealizadas?.length || 0;
      const valorVendas = vendasRealizadas?.reduce((sum, v) => sum + (Number(v.valor_venda) || 0), 0) || 0;

      // Calcular CPL (apenas leads pagos)
      const cpl = leadsPagos > 0 ? verbaInvestida / leadsPagos : null;
      
      // Calcular CAC
      const cac = vendas > 0 ? verbaInvestida / vendas : null;
      
      // Calcular ticket médio
      const ticketMedio = vendas > 0 ? valorVendas / vendas : null;

      console.log(`  📈 Leads: ${leadsTotal} (pagos: ${leadsPagos}), MQLs: ${mqls}, Reuniões: ${reunioes}, Vendas: ${vendas}`);
      console.log(`  💰 Verba: R$ ${verbaInvestida.toFixed(2)}, CPL: R$ ${cpl?.toFixed(2) || 'N/A'}`);

      // Upsert métricas da empresa
      const { error: errorUpsert } = await supabase
        .from('empresa_metricas_dia')
        .upsert({
          id_empresa: empresa.id_empresa,
          data: dataCalculo,
          verba_investida: verbaInvestida,
          leads_total: leadsTotal,
          leads_pagos: leadsPagos,
          mqls,
          levantadas,
          reunioes,
          vendas,
          valor_vendas: valorVendas,
          cpl,
          cac,
          ticket_medio: ticketMedio,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'id_empresa,data' 
        });

      if (errorUpsert) {
        console.error(`Erro ao salvar métricas empresa: ${errorUpsert.message}`);
      } else {
        empresasProcessadas++;
      }
    }

    // Registrar execução no histórico de cronjobs
    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-metricas-diarias',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        data_calculo: dataCalculo,
        empresas_processadas: empresasProcessadas,
        campanhas_processadas: campanhasProcessadas
      }
    });

    console.log(`\n✅ Cálculo concluído em ${duracao}ms`);
    console.log(`   Empresas: ${empresasProcessadas}, Campanhas: ${campanhasProcessadas}`);

    return new Response(JSON.stringify({
      success: true,
      data_calculo: dataCalculo,
      empresas_processadas: empresasProcessadas,
      campanhas_processadas: campanhasProcessadas,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro:', errorMessage);

    // Registrar erro
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-metricas-diarias',
      status: 'erro',
      duracao_ms: duracao,
      mensagem_erro: errorMessage
    });

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
