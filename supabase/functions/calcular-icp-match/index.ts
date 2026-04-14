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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const targetIcpId = body.id_icp || null;

    console.log('[ICP-Match] Iniciando cálculo...', targetIcpId ? `ICP: ${targetIcpId}` : 'Todos');

    // Fetch ICPs
    let icpQuery = supabase.from('icp_perfil').select('*');
    if (targetIcpId) icpQuery = icpQuery.eq('id', targetIcpId);
    const { data: icps, error: icpError } = await icpQuery;
    if (icpError) throw icpError;
    if (!icps || icps.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum ICP encontrado', matches: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalMatches = 0;

    for (const icp of icps) {
      const regras = icp.regras as Record<string, any>;
      const criterios = regras.criterios || [];
      const pesos = regras.pesos || {};

      // Fetch leads without sale for this company
      const { data: leads, error: leadsError } = await supabase
        .from('lead')
        .select('id_lead, irpf_renda_anual, irpf_valor_investimentos, irpf_patrimonio_total, irpf_possui_empresas, irpf_possui_cripto, irpf_valor_cripto, irpf_complexidade_declaracao, irpf_aliquota_efetiva, tokeniza_investidor, tokeniza_qtd_investimentos, tokeniza_valor_investido, tokeniza_carrinho_abandonado, mautic_score, mautic_page_hits, linkedin_senioridade, linkedin_cargo, utm_source, utm_medium, amelia_icp, origem_canal, stage_atual')
        .eq('id_empresa', icp.id_empresa)
        .or('venda_realizada.is.null,venda_realizada.eq.false')
        .limit(5000);

      if (leadsError) {
        console.error(`[ICP-Match] Erro ao buscar leads para ICP ${icp.nome}:`, leadsError);
        continue;
      }

      if (!leads || leads.length === 0) continue;

      const matches: any[] = [];

      for (const lead of leads) {
        const { score, camposMatch, camposFaltantes } = calcularScore(lead, criterios, pesos);

        if (score > 0) {
          matches.push({
            id_lead: lead.id_lead,
            id_icp: icp.id,
            score_match: Math.min(score, 100),
            campos_match: camposMatch,
            campos_faltantes: camposFaltantes,
            calculated_at: new Date().toISOString(),
          });
        }
      }

      // Delete old matches for this ICP and upsert new ones
      if (matches.length > 0) {
        // Batch upsert in chunks
        for (let i = 0; i < matches.length; i += 200) {
          const chunk = matches.slice(i, i + 200);
          const { error: upsertError } = await supabase
            .from('icp_match')
            .upsert(chunk, { onConflict: 'id_lead,id_icp' });
          if (upsertError) {
            console.error(`[ICP-Match] Erro upsert chunk:`, upsertError);
          }
        }
        totalMatches += matches.length;
      }

      console.log(`[ICP-Match] ICP "${icp.nome}": ${matches.length} matches de ${leads.length} leads`);
    }

    const duracao = Date.now() - startTime;

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-icp-match',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: { icps_processados: icps.length, total_matches: totalMatches },
    });

    return new Response(
      JSON.stringify({ success: true, icps_processados: icps.length, total_matches: totalMatches, duracao_ms: duracao }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ICP-Match] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface ScoreResult {
  score: number;
  camposMatch: string[];
  camposFaltantes: string[];
}

function calcularScore(lead: any, criterios: any[], pesos: Record<string, number>): ScoreResult {
  const camposMatch: string[] = [];
  const camposFaltantes: string[] = [];
  let scoreTotal = 0;

  // Default weights
  const defaultPesos: Record<string, number> = {
    renda: 25,
    patrimonio: 20,
    investidor: 15,
    comportamento: 15,
    linkedin: 10,
    utm: 10,
    amelia: 5,
  };

  const w = { ...defaultPesos, ...pesos };

  for (const criterio of criterios) {
    const { campo, operador, valor, categoria } = criterio;
    const peso = w[categoria] || 10;
    const leadVal = lead[campo];

    if (leadVal === null || leadVal === undefined) {
      camposFaltantes.push(campo);
      continue;
    }

    let match = false;

    switch (operador) {
      case 'gte':
        match = Number(leadVal) >= Number(valor);
        break;
      case 'lte':
        match = Number(leadVal) <= Number(valor);
        break;
      case 'eq':
        match = String(leadVal).toLowerCase() === String(valor).toLowerCase();
        break;
      case 'neq':
        match = String(leadVal).toLowerCase() !== String(valor).toLowerCase();
        break;
      case 'between':
        if (Array.isArray(valor) && valor.length === 2) {
          match = Number(leadVal) >= Number(valor[0]) && Number(leadVal) <= Number(valor[1]);
        }
        break;
      case 'is_true':
        match = leadVal === true;
        break;
      case 'is_false':
        match = leadVal === false || leadVal === null;
        break;
      case 'contains':
        match = String(leadVal).toLowerCase().includes(String(valor).toLowerCase());
        break;
      default:
        match = !!leadVal;
    }

    if (match) {
      camposMatch.push(campo);
      scoreTotal += peso;
    }
  }

  // Bonus: comportamento digital (mautic_score + page_hits)
  if (lead.mautic_score > 50) {
    scoreTotal += Math.min(w.comportamento * 0.5, 8);
    camposMatch.push('mautic_score_alto');
  }
  if (lead.mautic_page_hits > 5) {
    scoreTotal += Math.min(w.comportamento * 0.5, 7);
    camposMatch.push('mautic_engajado');
  }

  // LinkedIn seniority bonus
  const sen = (lead.linkedin_senioridade || '').toLowerCase();
  if (sen.includes('c-level') || sen.includes('diretor') || sen.includes('ceo') || sen.includes('cfo')) {
    scoreTotal += w.linkedin;
    camposMatch.push('linkedin_senioridade');
  } else if (sen.includes('gerente') || sen.includes('head') || sen.includes('senior')) {
    scoreTotal += w.linkedin * 0.6;
    camposMatch.push('linkedin_senioridade');
  }

  // Amelia ICP bonus
  if (lead.amelia_icp) {
    scoreTotal += w.amelia;
    camposMatch.push('amelia_icp');
  }

  return {
    score: Math.round(Math.min(scoreTotal, 100)),
    camposMatch,
    camposFaltantes,
  };
}
