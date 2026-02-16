import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

function normalizarTelefone(telefone: string): string[] {
  // Remove todos os caracteres não numéricos
  let digits = telefone.replace(/\D/g, '');

  // Se começar com 55 e tiver mais de 11 dígitos, remover DDI
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }

  const variants: string[] = [];

  // Se tiver 10 dígitos (DDD + 8), gerar variante com 9
  if (digits.length === 10) {
    const with9 = digits.substring(0, 2) + '9' + digits.substring(2);
    variants.push(with9, `+55${with9}`, digits, `+55${digits}`);
  } else if (digits.length === 11) {
    // Já tem 11 dígitos, gerar variante sem o 9
    const without9 = digits.substring(0, 2) + digits.substring(3);
    variants.push(digits, `+55${digits}`, without9, `+55${without9}`);
  } else {
    variants.push(digits);
    if (digits.length > 0) variants.push(`+55${digits}`);
  }

  // Deduplicate
  return [...new Set(variants)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação via x-api-key
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

    // Estratégia 2: Busca por telefone (fallback se email não encontrou)
    if (!lead && telefone) {
      const variants = normalizarTelefone(telefone);
      console.log(`[buscar-lead-api] Variantes de telefone geradas:`, variants);

      // Construir filtro OR com todas as variantes
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

      // Fallback: busca parcial via ilike se não encontrou match exato
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

    return new Response(
      JSON.stringify({ found: true, lead }),
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
