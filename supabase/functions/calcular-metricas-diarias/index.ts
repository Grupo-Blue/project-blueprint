import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Empresa {
  id_empresa: string;
  nome: string;
}

// Classificar lead como NB ou Renovação baseado no cliente_status
function classificarTipoNegocio(clienteStatus: string | null): 'new_business' | 'renovacao' {
  if (clienteStatus && ['cliente', 'ex_cliente'].includes(clienteStatus.toLowerCase())) {
    return 'renovacao';
  }
  return 'new_business';
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
    const datasParaCalcular: string[] = [];
    
    if (body.batch_days && typeof body.batch_days === 'number') {
      for (let i = 1; i <= body.batch_days; i++) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        datasParaCalcular.push(data.toISOString().split('T')[0]);
      }
      console.log(`📊 Modo batch: calculando métricas para ${body.batch_days} dias`);
    } else if (body.data === 'yesterday' || !body.data) {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      datasParaCalcular.push(ontem.toISOString().split('T')[0]);
    } else if (body.data === 'today') {
      datasParaCalcular.push(new Date().toISOString().split('T')[0]);
    } else {
      datasParaCalcular.push(body.data);
    }

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

    let totalRegistros = 0;
    const resultadosPorDia: Record<string, { empresas: number; leads: number; vendas: number }> = {};

    for (const dataCalculo of datasParaCalcular) {
      console.log(`\n📅 Processando: ${dataCalculo}`);
      resultadosPorDia[dataCalculo] = { empresas: 0, leads: 0, vendas: 0 };

      for (const empresa of empresas as Empresa[]) {
        // Buscar leads criados nesta data COM cliente_status para classificação
        const { data: leadsCriados, error: errorLeads } = await supabase
          .from('lead')
          .select('id_lead, is_mql, levantou_mao, tem_reuniao, reuniao_realizada, venda_realizada, valor_venda, lead_pago, id_criativo, cliente_status')
          .eq('id_empresa', empresa.id_empresa)
          .gte('data_criacao', `${dataCalculo}T00:00:00`)
          .lt('data_criacao', `${dataCalculo}T23:59:59.999`);

        if (errorLeads) {
          console.error(`Erro ao buscar leads: ${errorLeads.message}`);
          continue;
        }

        // Buscar vendas realizadas nesta data COM cliente_status
        const { data: vendasRealizadas, error: errorVendas } = await supabase
          .from('lead')
          .select('id_lead, valor_venda, cliente_status')
          .eq('id_empresa', empresa.id_empresa)
          .eq('venda_realizada', true)
          .gte('data_venda', `${dataCalculo}T00:00:00`)
          .lt('data_venda', `${dataCalculo}T23:59:59.999`);

        if (errorVendas) {
          console.error(`Erro ao buscar vendas: ${errorVendas.message}`);
        }

        // Buscar verba investida
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

        const leads = leadsCriados || [];
        
        // Separar leads por tipo de negócio
        const leadsNB = leads.filter(l => classificarTipoNegocio(l.cliente_status) === 'new_business');
        const leadsRenov = leads.filter(l => classificarTipoNegocio(l.cliente_status) === 'renovacao');
        
        const vendasNB = (vendasRealizadas || []).filter(v => classificarTipoNegocio(v.cliente_status) === 'new_business');
        const vendasRenov = (vendasRealizadas || []).filter(v => classificarTipoNegocio(v.cliente_status) === 'renovacao');

        // Função helper para calcular métricas de um grupo de leads
        const calcularMetricas = (leadsGrupo: any[], vendasGrupo: any[], verba: number) => {
          const leadsTotal = leadsGrupo.length;
          const leadsPagos = leadsGrupo.filter(l => l.lead_pago === true).length;
          const mqls = leadsGrupo.filter(l => l.is_mql === true).length;
          const levantadas = leadsGrupo.filter(l => l.levantou_mao === true).length;
          const reunioes = leadsGrupo.filter(l => l.tem_reuniao === true || l.reuniao_realizada === true).length;
          const vendas = vendasGrupo.length;
          const valorVendas = vendasGrupo.reduce((sum, v) => sum + (Number(v.valor_venda) || 0), 0);
          const cpl = leadsPagos > 0 ? verba / leadsPagos : null;
          const cac = vendas > 0 ? verba / vendas : null;
          const ticketMedio = vendas > 0 ? valorVendas / vendas : null;

          return {
            verba_investida: verba,
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
          };
        };

        // Calcular 3 registros: total, new_business, renovacao
        const metricasTotal = calcularMetricas(leads, vendasRealizadas || [], verbaInvestida);
        const metricasNB = calcularMetricas(leadsNB, vendasNB, verbaInvestida); // verba vai toda pra NB por enquanto
        const metricasRenov = calcularMetricas(leadsRenov, vendasRenov, 0); // renovação não tem verba de ads

        const registros = [
          { id_empresa: empresa.id_empresa, data: dataCalculo, tipo_negocio: 'total', ...metricasTotal },
          { id_empresa: empresa.id_empresa, data: dataCalculo, tipo_negocio: 'new_business', ...metricasNB },
          { id_empresa: empresa.id_empresa, data: dataCalculo, tipo_negocio: 'renovacao', ...metricasRenov },
        ];

        const { error: errorUpsert } = await supabase
          .from('empresa_metricas_dia')
          .upsert(registros, { onConflict: 'id_empresa,data,tipo_negocio' });

        if (errorUpsert) {
          console.error(`Erro ao salvar métricas: ${errorUpsert.message}`);
        } else {
          totalRegistros += 3;
          resultadosPorDia[dataCalculo].empresas++;
          resultadosPorDia[dataCalculo].leads += leads.length;
          resultadosPorDia[dataCalculo].vendas += (vendasRealizadas?.length || 0);
        }
      }
      
      console.log(`  ✓ ${resultadosPorDia[dataCalculo].empresas} empresas, ${resultadosPorDia[dataCalculo].leads} leads, ${resultadosPorDia[dataCalculo].vendas} vendas`);
    }

    // Registrar execução
    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-metricas-diarias',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        dias_processados: datasParaCalcular.length,
        total_registros: totalRegistros,
        resultados_por_dia: resultadosPorDia
      }
    });

    console.log(`\n✅ Cálculo concluído em ${duracao}ms (${totalRegistros} registros)`);

    return new Response(JSON.stringify({
      success: true,
      dias_processados: datasParaCalcular.length,
      total_registros: totalRegistros,
      resultados_por_dia: resultadosPorDia,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const duracao = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro:', errorMessage);

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
