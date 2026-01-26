import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadSemUTM {
  id_lead: string;
  id_empresa: string;
  nome_lead: string | null;
  email: string | null;
  data_criacao: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  problema: string;
}

function detectarProblemasUTM(lead: any): string[] {
  const problemas: string[] = [];
  
  // Verificar ausência total de UTMs
  if (!lead.utm_source && !lead.utm_medium && !lead.utm_campaign) {
    problemas.push('SEM_UTM');
    return problemas; // Se não tem UTM nenhum, já retorna
  }
  
  // Verificar placeholders não resolvidos
  const campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  for (const campo of campos) {
    const valor = lead[campo];
    if (valor && /\{\{[^}]+\}\}/.test(valor)) {
      problemas.push(`PLACEHOLDER_NAO_RESOLVIDO_${campo.toUpperCase()}`);
    }
  }
  
  // Verificar UTMs incompletos
  if (lead.utm_source && !lead.utm_medium) {
    problemas.push('UTM_MEDIUM_FALTANDO');
  }
  if (lead.utm_source && !lead.utm_campaign) {
    problemas.push('UTM_CAMPAIGN_FALTANDO');
  }
  
  return problemas;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[alertar-leads-sem-utm] Iniciando análise...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar leads das últimas 24 horas
    const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: leadsRecentes, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, id_empresa, nome_lead, email, data_criacao, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
      .gte('data_criacao', ontemISO)
      .eq('merged', false)
      .order('data_criacao', { ascending: false });

    if (leadsError) {
      console.error('[alertar-leads-sem-utm] Erro ao buscar leads:', leadsError);
      throw leadsError;
    }

    console.log(`[alertar-leads-sem-utm] ${leadsRecentes?.length || 0} leads nas últimas 24h`);

    const leadsSemUTM: LeadSemUTM[] = [];
    const leadsComPlaceholder: LeadSemUTM[] = [];
    const leadsIncompletos: LeadSemUTM[] = [];

    for (const lead of leadsRecentes || []) {
      const problemas = detectarProblemasUTM(lead);
      
      for (const problema of problemas) {
        const registro: LeadSemUTM = {
          id_lead: lead.id_lead,
          id_empresa: lead.id_empresa,
          nome_lead: lead.nome_lead,
          email: lead.email,
          data_criacao: lead.data_criacao,
          utm_source: lead.utm_source,
          utm_medium: lead.utm_medium,
          utm_campaign: lead.utm_campaign,
          utm_content: lead.utm_content,
          problema,
        };

        if (problema === 'SEM_UTM') {
          leadsSemUTM.push(registro);
        } else if (problema.startsWith('PLACEHOLDER')) {
          leadsComPlaceholder.push(registro);
        } else {
          leadsIncompletos.push(registro);
        }
      }
    }

    console.log(`[alertar-leads-sem-utm] Problemas encontrados:`);
    console.log(`  - Sem UTM: ${leadsSemUTM.length}`);
    console.log(`  - Com placeholder: ${leadsComPlaceholder.length}`);
    console.log(`  - UTM incompleto: ${leadsIncompletos.length}`);

    // Agrupar por empresa para relatório
    const resumoPorEmpresa: Record<string, { semUtm: number; placeholder: number; incompleto: number }> = {};
    
    for (const lead of [...leadsSemUTM, ...leadsComPlaceholder, ...leadsIncompletos]) {
      if (!resumoPorEmpresa[lead.id_empresa]) {
        resumoPorEmpresa[lead.id_empresa] = { semUtm: 0, placeholder: 0, incompleto: 0 };
      }
      if (lead.problema === 'SEM_UTM') resumoPorEmpresa[lead.id_empresa].semUtm++;
      else if (lead.problema.startsWith('PLACEHOLDER')) resumoPorEmpresa[lead.id_empresa].placeholder++;
      else resumoPorEmpresa[lead.id_empresa].incompleto++;
    }

    // Registrar execução
    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'alertar-leads-sem-utm',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        leads_analisados: leadsRecentes?.length || 0,
        sem_utm: leadsSemUTM.length,
        com_placeholder: leadsComPlaceholder.length,
        incompletos: leadsIncompletos.length,
        resumo_por_empresa: resumoPorEmpresa,
      },
    });

    console.log(`[alertar-leads-sem-utm] Concluído em ${duracao}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_analisados: leadsRecentes?.length || 0,
        problemas: {
          sem_utm: leadsSemUTM.length,
          com_placeholder: leadsComPlaceholder.length,
          incompletos: leadsIncompletos.length,
        },
        resumo_por_empresa: resumoPorEmpresa,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[alertar-leads-sem-utm] Erro:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'alertar-leads-sem-utm',
      status: 'erro',
      mensagem_erro: error.message,
      duracao_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
