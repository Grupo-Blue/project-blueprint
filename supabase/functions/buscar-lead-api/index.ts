import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const TOKENIZA_ID = "61b5ffeb-fbbc-47c1-8ced-152bb647ed20";

interface InvestimentoDetalhe {
  oferta_nome: string;
  oferta_id: string;
  valor: number;
  data: string;
  status: string;
  tipo: 'crowdfunding' | 'venda';
}

function normalizarTelefone(telefone: string): string[] {
  let digits = telefone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }
  const variants: string[] = [];
  if (digits.length === 10) {
    const with9 = digits.substring(0, 2) + '9' + digits.substring(2);
    variants.push(with9, `+55${with9}`, digits, `+55${digits}`);
  } else if (digits.length === 11) {
    const without9 = digits.substring(0, 2) + digits.substring(3);
    variants.push(digits, `+55${digits}`, without9, `+55${without9}`);
  } else {
    variants.push(digits);
    if (digits.length > 0) variants.push(`+55${digits}`);
  }
  return [...new Set(variants)];
}

async function buscarMapaProjetos(supabase: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('tokeniza_projeto')
    .select('project_id, nome');
  const mapa = new Map<string, string>();
  if (error || !data) return mapa;
  for (const p of data) {
    if (p.project_id && p.nome) mapa.set(p.project_id, p.nome);
  }
  return mapa;
}

async function buscarInvestimentosDetalhados(
  supabase: ReturnType<typeof createClient>,
  tokenizaUserId: string,
  mapaProjetos: Map<string, string>
): Promise<InvestimentoDetalhe[]> {
  const investimentos: InvestimentoDetalhe[] = [];

  const { data: crowdfundings } = await supabase
    .from('tokeniza_investimento')
    .select('project_id, amount, status, was_paid, data_criacao')
    .eq('user_id_tokeniza', tokenizaUserId)
    .or('status.eq.FINISHED,status.eq.PAID,was_paid.eq.true');

  if (crowdfundings) {
    for (const inv of crowdfundings) {
      investimentos.push({
        oferta_nome: mapaProjetos.get(inv.project_id) || inv.project_id || 'Projeto desconhecido',
        oferta_id: inv.project_id || '',
        valor: Number(inv.amount) || 0,
        data: inv.data_criacao || '',
        status: inv.status || 'PAID',
        tipo: 'crowdfunding'
      });
    }
  }

  const { data: vendas } = await supabase
    .from('tokeniza_venda')
    .select('store_id, total_amount, status, data_criacao')
    .eq('user_id_tokeniza', tokenizaUserId)
    .eq('was_paid', true);

  if (vendas) {
    for (const v of vendas) {
      investimentos.push({
        oferta_nome: mapaProjetos.get(v.store_id) || v.store_id || 'Venda direta',
        oferta_id: v.store_id || '',
        valor: Number(v.total_amount) || 0,
        data: v.data_criacao || '',
        status: v.status || 'PAID',
        tipo: 'venda'
      });
    }
  }

  investimentos.sort((a, b) => {
    if (!a.data) return 1;
    if (!b.data) return -1;
    return new Date(b.data).getTime() - new Date(a.data).getTime();
  });

  return investimentos;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('SGT_WEBHOOK_SECRET');

    if (!apiKey || apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ found: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, telefone } = await req.json();

    if (!email && !telefone) {
      return new Response(
        JSON.stringify({ found: false, error: 'Informe email ou telefone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const selectFields = `
      id_lead, nome_lead, email, telefone, organizacao,
      origem_canal, stage_atual, id_empresa, data_criacao,
      venda_realizada, valor_venda, data_venda,
      is_mql, levantou_mao, tem_reuniao,
      score_temperatura, proprietario_nome,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      mautic_score, mautic_page_hits, mautic_tags, cidade_mautic, estado_mautic,
      linkedin_cargo, linkedin_empresa, linkedin_setor, linkedin_senioridade,
      tokeniza_investidor, tokeniza_valor_investido, tokeniza_qtd_investimentos,
      tokeniza_user_id, tokeniza_projetos, tokeniza_ultimo_investimento,
      tokeniza_carrinho_abandonado, tokeniza_valor_carrinho,
      ga4_landing_page, ga4_engajamento_score, ga4_sessoes,
      stape_paginas_visitadas, stape_eventos,
      irpf_renda_anual, irpf_patrimonio_liquido, irpf_perfil_investidor,
      metricool_roas_campanha, metricool_cpc_campanha
    `;

    let lead = null;

    // Estratégia 1: Busca por email
    if (email) {
      const { data } = await supabase
        .from('lead')
        .select(selectFields)
        .ilike('email', email)
        .or('merged.is.null,merged.eq.false')
        .order('data_criacao', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        lead = data[0];
      }
    }

    // Estratégia 2: Busca por telefone (fallback)
    if (!lead && telefone) {
      const variants = normalizarTelefone(telefone);
      console.log(`[buscar-lead-api] Variantes de telefone geradas:`, variants);

      const orFilter = variants.map(v => `telefone.eq.${v}`).join(',');
      const { data } = await supabase
        .from('lead')
        .select(selectFields)
        .or(orFilter)
        .or('merged.is.null,merged.eq.false')
        .order('data_criacao', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        lead = data[0];
      }

      // Fallback: busca parcial
      if (!lead && variants.length > 0) {
        const mainVariant = variants[0];
        const { data: partialData } = await supabase
          .from('lead')
          .select(selectFields)
          .ilike('telefone', `%${mainVariant}%`)
          .or('merged.is.null,merged.eq.false')
          .order('data_criacao', { ascending: false })
          .limit(1);

        if (partialData && partialData.length > 0) {
          lead = partialData[0];
        }
      }
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ found: false, message: 'Lead não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[buscar-lead-api] Lead encontrado: ${lead.id_lead} - ${lead.nome_lead}`);

    // Enriquecer com investimentos detalhados se for Tokeniza
    const response: Record<string, unknown> = { found: true, lead };

    if (lead.id_empresa === TOKENIZA_ID && lead.tokeniza_user_id) {
      const mapaProjetos = await buscarMapaProjetos(supabase);
      const investimentos = await buscarInvestimentosDetalhados(supabase, lead.tokeniza_user_id, mapaProjetos);

      response.dados_tokeniza = {
        valor_investido: lead.tokeniza_valor_investido || 0,
        qtd_investimentos: lead.tokeniza_qtd_investimentos || 0,
        projetos: lead.tokeniza_projetos || [],
        ultimo_investimento_em: lead.tokeniza_ultimo_investimento || null,
        carrinho_abandonado: lead.tokeniza_carrinho_abandonado || false,
        valor_carrinho: lead.tokeniza_valor_carrinho || 0,
        investimentos,
      };

      console.log(`[buscar-lead-api] Tokeniza enriquecido: ${investimentos.length} investimentos`);
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[buscar-lead-api] Erro:', error);
    return new Response(
      JSON.stringify({ found: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
