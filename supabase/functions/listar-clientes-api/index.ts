import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const BLUE_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";
const TOKENIZA_ID = "61b5ffeb-fbbc-47c1-8ced-152bb647ed20";

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
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      empresa,
      apenas_clientes = true,
      limit: rawLimit = 100,
      offset = 0,
    } = body;

    // Validações
    if (!empresa || !['BLUE', 'TOKENIZA'].includes(empresa)) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "empresa" obrigatório: "BLUE" ou "TOKENIZA"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limit = Math.min(Math.max(1, Number(rawLimit) || 100), 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (empresa === 'BLUE') {
      return await listarClientesBlue(supabase, { apenas_clientes, limit, offset });
    } else {
      return await listarClientesTokeniza(supabase, { apenas_clientes, limit, offset });
    }

  } catch (error) {
    console.error('[listar-clientes-api] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function listarClientesBlue(
  supabase: ReturnType<typeof createClient>,
  opts: { apenas_clientes: boolean; limit: number; offset: number }
) {
  const { apenas_clientes, limit, offset } = opts;

  // Query base com LEFT JOIN em cliente_notion
  let query = supabase
    .from('lead')
    .select(`
      id_lead,
      nome_lead,
      email,
      telefone,
      organizacao,
      cliente_status,
      venda_realizada,
      valor_venda,
      data_venda,
      stage_atual,
      id_cliente_notion,
      cliente_notion!left(
        status_cliente,
        produtos_contratados,
        nome
      )
    `, { count: 'exact' })
    .eq('id_empresa', BLUE_ID)
    .or('merged.is.null,merged.eq.false')
    .order('data_venda', { ascending: false, nullsFirst: false })
    .order('data_criacao', { ascending: false })
    .range(offset, offset + limit - 1);

  if (apenas_clientes) {
    query = query.or('cliente_status.eq.cliente,venda_realizada.eq.true');
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[listar-clientes-api] Erro Blue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const clientes = (data || []).map((l: any) => {
    const notion = Array.isArray(l.cliente_notion) ? l.cliente_notion[0] : l.cliente_notion;
    const plano_ativo = l.cliente_status === 'cliente' || (notion?.status_cliente === 'cliente');

    return {
      lead_id: l.id_lead,
      nome: l.nome_lead,
      email: l.email,
      telefone: l.telefone,
      organizacao: l.organizacao ?? null,
      plano_ativo,
      plano_atual: notion?.produtos_contratados ?? null,
      stage_atual: l.stage_atual ?? null,
      cliente_status: l.cliente_status ?? null,
      venda_realizada: l.venda_realizada ?? false,
      valor_venda: l.valor_venda ?? null,
      data_venda: l.data_venda ?? null,
      dados_tokeniza: null,
    };
  });

  console.log(`[listar-clientes-api] Blue: ${clientes.length} clientes (total: ${count})`);

  return new Response(
    JSON.stringify({
      total: count ?? 0,
      empresa: 'BLUE',
      limit,
      offset,
      clientes,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function listarClientesTokeniza(
  supabase: ReturnType<typeof createClient>,
  opts: { apenas_clientes: boolean; limit: number; offset: number }
) {
  const { apenas_clientes, limit, offset } = opts;

  let query = supabase
    .from('lead')
    .select(`
      id_lead,
      nome_lead,
      email,
      telefone,
      cliente_status,
      venda_realizada,
      valor_venda,
      data_venda,
      stage_atual,
      tokeniza_investidor,
      tokeniza_valor_investido,
      tokeniza_qtd_investimentos,
      tokeniza_projetos,
      tokeniza_ultimo_investimento,
      tokeniza_carrinho_abandonado,
      tokeniza_valor_carrinho
    `, { count: 'exact' })
    .eq('id_empresa', TOKENIZA_ID)
    .or('merged.is.null,merged.eq.false')
    .order('tokeniza_valor_investido', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (apenas_clientes) {
    query = query.eq('tokeniza_investidor', true);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[listar-clientes-api] Erro Tokeniza:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const clientes = (data || []).map((l: any) => ({
    lead_id: l.id_lead,
    nome: l.nome_lead,
    email: l.email,
    telefone: l.telefone,
    plano_ativo: l.tokeniza_investidor === true,
    stage_atual: l.stage_atual ?? null,
    cliente_status: l.cliente_status ?? null,
    venda_realizada: l.venda_realizada ?? false,
    valor_venda: l.valor_venda ?? null,
    data_venda: l.data_venda ?? null,
    dados_tokeniza: {
      valor_investido: l.tokeniza_valor_investido ?? 0,
      qtd_investimentos: l.tokeniza_qtd_investimentos ?? 0,
      projetos: l.tokeniza_projetos ?? [],
      ultimo_investimento_em: l.tokeniza_ultimo_investimento ?? null,
      carrinho_abandonado: l.tokeniza_carrinho_abandonado ?? false,
      valor_carrinho: l.tokeniza_valor_carrinho ?? 0,
    },
  }));

  console.log(`[listar-clientes-api] Tokeniza: ${clientes.length} clientes (total: ${count})`);

  return new Response(
    JSON.stringify({
      total: count ?? 0,
      empresa: 'TOKENIZA',
      limit,
      offset,
      clientes,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
