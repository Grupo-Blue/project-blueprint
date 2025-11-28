import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Semana {
  id_semana: string;
  numero_semana: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
}

interface Empresa {
  id_empresa: string;
  nome: string;
}

interface Campanha {
  id_campanha: string;
  nome: string;
  id_conta: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { id_semana } = await req.json();

    console.log('Iniciando cálculo de métricas semanais', { id_semana });

    // 1. Buscar semana (se não fornecida, pega a mais recente)
    let semana: Semana;
    if (id_semana) {
      const { data, error } = await supabase
        .from('semana')
        .select('*')
        .eq('id_semana', id_semana)
        .single();
      
      if (error) throw new Error(`Erro ao buscar semana: ${error.message}`);
      semana = data;
    } else {
      const { data, error } = await supabase
        .from('semana')
        .select('*')
        .order('ano', { ascending: false })
        .order('numero_semana', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw new Error(`Erro ao buscar semana mais recente: ${error.message}`);
      semana = data;
    }

    console.log('Processando semana:', semana);

    // 2. Buscar todas as empresas
    const { data: empresas, error: empresasError } = await supabase
      .from('empresa')
      .select('id_empresa, nome');
    
    if (empresasError) throw new Error(`Erro ao buscar empresas: ${empresasError.message}`);

    console.log(`Encontradas ${empresas?.length || 0} empresas`);

    // 3. Para cada empresa, calcular métricas
    for (const empresa of empresas || []) {
      console.log(`Processando empresa: ${empresa.nome}`);

      // Buscar leads da empresa na semana
      const { data: leads, error: leadsError } = await supabase
        .from('lead')
        .select('*')
        .eq('id_empresa', empresa.id_empresa)
        .gte('data_criacao', semana.data_inicio)
        .lte('data_criacao', semana.data_fim);

      if (leadsError) {
        console.error(`Erro ao buscar leads da empresa ${empresa.nome}:`, leadsError);
        continue;
      }

      const leads_total = leads?.length || 0;
      const mqls = leads?.filter(l => l.is_mql).length || 0;
      const levantadas = leads?.filter(l => l.levantou_mao).length || 0;
      const reunioes = leads?.filter(l => l.tem_reuniao || l.reuniao_realizada).length || 0;
      const vendas = leads?.filter(l => l.venda_realizada).length || 0;

      // Calcular ticket médio
      const vendasComValor = leads?.filter(l => l.venda_realizada && l.valor_venda) || [];
      const somaVendas = vendasComValor.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
      const ticket_medio = vendas > 0 ? somaVendas / vendas : null;

      // Buscar verba investida (soma de todas as campanhas das contas da empresa)
      const { data: contas, error: contasError } = await supabase
        .from('conta_anuncio')
        .select('id_conta')
        .eq('id_empresa', empresa.id_empresa);

      if (contasError) {
        console.error(`Erro ao buscar contas da empresa ${empresa.nome}:`, contasError);
        continue;
      }

      const contaIds = contas?.map(c => c.id_conta) || [];

      let verba_investida = 0;
      if (contaIds.length > 0) {
        const { data: campanhas } = await supabase
          .from('campanha')
          .select('id_campanha')
          .in('id_conta', contaIds);

        const campanhaIds = campanhas?.map(c => c.id_campanha) || [];

        if (campanhaIds.length > 0) {
          const { data: metricasDia } = await supabase
            .from('campanha_metricas_dia')
            .select('verba_investida')
            .in('id_campanha', campanhaIds)
            .gte('data', semana.data_inicio)
            .lte('data', semana.data_fim);

          verba_investida = metricasDia?.reduce((sum, m) => sum + m.verba_investida, 0) || 0;
        }
      }

      // Calcular CPL e CAC
      const cpl = leads_total > 0 ? verba_investida / leads_total : null;
      const cac = vendas > 0 ? verba_investida / vendas : null;

      // Inserir ou atualizar métricas da empresa
      const metricasEmpresa = {
        id_empresa: empresa.id_empresa,
        id_semana: semana.id_semana,
        verba_investida,
        leads_total,
        mqls,
        levantadas,
        reunioes,
        vendas,
        ticket_medio,
        cpl,
        cac,
      };

      const { error: upsertError } = await supabase
        .from('empresa_semana_metricas')
        .upsert(metricasEmpresa, {
          onConflict: 'id_empresa,id_semana',
        });

      if (upsertError) {
        console.error(`Erro ao salvar métricas da empresa ${empresa.nome}:`, upsertError);
      } else {
        console.log(`Métricas da empresa ${empresa.nome} salvas:`, {
          leads_total,
          mqls,
          levantadas,
          reunioes,
          vendas,
          verba_investida,
          cpl,
          cac,
        });
      }
    }

    // 4. Calcular métricas por campanha
    const { data: campanhas, error: campanhasError } = await supabase
      .from('campanha')
      .select(`
        id_campanha,
        nome,
        id_conta,
        conta_anuncio!inner (id_empresa)
      `);

    if (campanhasError) {
      console.error('Erro ao buscar campanhas:', campanhasError);
    } else {
      console.log(`Encontradas ${campanhas?.length || 0} campanhas`);

      for (const campanha of campanhas || []) {
        console.log(`Processando campanha: ${campanha.nome}`);

        // Buscar métricas diárias da campanha
        const { data: metricasDia } = await supabase
          .from('campanha_metricas_dia')
          .select('*')
          .eq('id_campanha', campanha.id_campanha)
          .gte('data', semana.data_inicio)
          .lte('data', semana.data_fim);

        const verba_investida = metricasDia?.reduce((sum, m) => sum + m.verba_investida, 0) || 0;
        const leads = metricasDia?.reduce((sum, m) => sum + m.leads, 0) || 0;

        // Buscar criativos da campanha
        const { data: criativosCampanha } = await supabase
          .from('criativo')
          .select('id_criativo')
          .eq('id_campanha', campanha.id_campanha);

        const idsCreativos = criativosCampanha?.map(c => c.id_criativo) || [];

        // Buscar leads da campanha através dos criativos OU origem_campanha
        let leadsCampanha: any[] = [];
        
        if (idsCreativos.length > 0) {
          const { data: leadsViaCreativos } = await supabase
            .from('lead')
            .select('*')
            .in('id_criativo', idsCreativos)
            .gte('data_criacao', semana.data_inicio)
            .lte('data_criacao', semana.data_fim);
          
          leadsCampanha = leadsViaCreativos || [];
        }
        
        // Adicionar leads que vieram pela origem_campanha (fallback)
        const { data: leadsViaOrigem } = await supabase
          .from('lead')
          .select('*')
          .eq('id_empresa', (campanha as any).conta_anuncio.id_empresa)
          .eq('origem_campanha', campanha.nome)
          .gte('data_criacao', semana.data_inicio)
          .lte('data_criacao', semana.data_fim);
        
        if (leadsViaOrigem && leadsViaOrigem.length > 0) {
          leadsCampanha = [...leadsCampanha, ...leadsViaOrigem];
        }

        const mqls = leadsCampanha?.filter(l => l.is_mql).length || 0;
        const levantadas = leadsCampanha?.filter(l => l.levantou_mao).length || 0;
        const reunioes = leadsCampanha?.filter(l => l.tem_reuniao || l.reuniao_realizada).length || 0;
        const vendas = leadsCampanha?.filter(l => l.venda_realizada).length || 0;

        const vendasComValor = leadsCampanha?.filter(l => l.venda_realizada && l.valor_venda) || [];
        const somaVendas = vendasComValor.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
        const ticket_medio = vendas > 0 ? somaVendas / vendas : null;

        const cpl = leads > 0 ? verba_investida / leads : null;
        const cac = vendas > 0 ? verba_investida / vendas : null;

        const metricasCampanha = {
          id_campanha: campanha.id_campanha,
          id_semana: semana.id_semana,
          verba_investida,
          leads,
          mqls,
          levantadas,
          reunioes,
          vendas,
          ticket_medio,
          cpl,
          cac,
        };

        const { error: upsertCampanhaError } = await supabase
          .from('campanha_semana_metricas')
          .upsert(metricasCampanha, {
            onConflict: 'id_campanha,id_semana',
          });

        if (upsertCampanhaError) {
          console.error(`Erro ao salvar métricas da campanha ${campanha.nome}:`, upsertCampanhaError);
        } else {
          console.log(`Métricas da campanha ${campanha.nome} salvas`);
        }
      }
    }

    console.log('Cálculo de métricas concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Métricas calculadas com sucesso',
        semana: {
          numero_semana: semana.numero_semana,
          ano: semana.ano,
        },
        empresas_processadas: empresas?.length || 0,
        campanhas_processadas: campanhas?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao calcular métricas:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
