import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[consultar-irpf] Iniciando consulta...");

  try {
    // Validar autenticação via Bearer token
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('IRPF_WEBHOOK_SECRET');

    if (!expectedToken) {
      console.error("[consultar-irpf] IRPF_WEBHOOK_SECRET não configurado");
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de autenticação ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[consultar-irpf] Token não fornecido");
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providedToken = authHeader.replace('Bearer ', '');
    if (providedToken !== expectedToken) {
      console.log("[consultar-irpf] Token inválido");
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear body
    const body = await req.json();
    const { cpf, email } = body;

    if (!cpf && !email) {
      console.log("[consultar-irpf] Nenhum CPF ou email informado");
      return new Response(
        JSON.stringify({ success: false, error: 'Informe cpf ou email para consulta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[consultar-irpf] Parâmetros:", { cpf: cpf ? 'informado' : 'não', email: email ? 'informado' : 'não' });

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Normalizar CPF (remover pontos, traços e espaços)
    const cpfLimpo = cpf?.replace(/\D/g, '');

    // Buscar declarações
    let query = supabase.from('irpf_declaracao').select('*');

    if (cpfLimpo) {
      // CPF pode estar armazenado com ou sem formatação
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      query = query.or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`);
      console.log("[consultar-irpf] Buscando por CPF:", cpfLimpo);
    } else if (email) {
      query = query.ilike('email', email);
      console.log("[consultar-irpf] Buscando por email:", email);
    }

    const { data: declaracoes, error: erroDeclaracoes } = await query.order('exercicio', { ascending: false });

    if (erroDeclaracoes) {
      console.error("[consultar-irpf] Erro ao buscar declarações:", erroDeclaracoes);
      throw erroDeclaracoes;
    }

    if (!declaracoes || declaracoes.length === 0) {
      console.log("[consultar-irpf] Nenhuma declaração encontrada");
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma declaração encontrada para os critérios informados' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[consultar-irpf] Encontradas ${declaracoes.length} declaração(ões)`);

    // Para cada declaração, buscar todos os dados relacionados
    const declaracoesCompletas = await Promise.all(declaracoes.map(async (declaracao) => {
      const id = declaracao.id;

      // Buscar todas as tabelas relacionadas em paralelo
      const [
        dependentes,
        alimentandos,
        rendimentos,
        impostosPagos,
        pagamentosDeducoes,
        doacoes,
        bensEDireitos,
        dividasEOnus,
        atividadesRurais,
        ganhosCapital,
        rendaVariavel,
        fundosImobiliarios,
        demonstrativoLei14754,
        resumoTributario,
        evolucaoPatrimonial,
        outrasInformacoes
      ] = await Promise.all([
        supabase.from('irpf_dependente').select('*').eq('id_declaracao', id),
        supabase.from('irpf_alimentando').select('*').eq('id_declaracao', id),
        supabase.from('irpf_rendimento').select('*').eq('id_declaracao', id),
        supabase.from('irpf_imposto_pago').select('*').eq('id_declaracao', id),
        supabase.from('irpf_pagamento_deducao').select('*').eq('id_declaracao', id),
        supabase.from('irpf_doacao').select('*').eq('id_declaracao', id),
        supabase.from('irpf_bem_direito').select('*').eq('id_declaracao', id),
        supabase.from('irpf_divida_onus').select('*').eq('id_declaracao', id),
        supabase.from('irpf_atividade_rural').select('*').eq('id_declaracao', id),
        supabase.from('irpf_ganho_capital').select('*').eq('id_declaracao', id),
        supabase.from('irpf_renda_variavel').select('*').eq('id_declaracao', id),
        supabase.from('irpf_fundo_imobiliario').select('*').eq('id_declaracao', id),
        supabase.from('irpf_demonstrativo_lei_14754').select('*').eq('id_declaracao', id),
        supabase.from('irpf_resumo_tributario').select('*').eq('id_declaracao', id).maybeSingle(),
        supabase.from('irpf_evolucao_patrimonial').select('*').eq('id_declaracao', id).maybeSingle(),
        supabase.from('irpf_outras_informacoes').select('*').eq('id_declaracao', id).maybeSingle()
      ]);

      // Para atividades rurais, buscar rebanhos associados
      let atividadesRuraisComRebanho = [];
      if (atividadesRurais.data && atividadesRurais.data.length > 0) {
        atividadesRuraisComRebanho = await Promise.all(atividadesRurais.data.map(async (atividade) => {
          const { data: rebanhos } = await supabase
            .from('irpf_atividade_rural_rebanho')
            .select('*')
            .eq('id_atividade_rural', atividade.id);
          return {
            ...atividade,
            rebanhos: rebanhos || []
          };
        }));
      }

      return {
        declaracao,
        dependentes: dependentes.data || [],
        alimentandos: alimentandos.data || [],
        rendimentos: rendimentos.data || [],
        impostosPagos: impostosPagos.data || [],
        pagamentosDeducoes: pagamentosDeducoes.data || [],
        doacoes: doacoes.data || [],
        bensEDireitos: bensEDireitos.data || [],
        dividasEOnus: dividasEOnus.data || [],
        atividadesRurais: atividadesRuraisComRebanho.length > 0 ? atividadesRuraisComRebanho : (atividadesRurais.data || []),
        ganhosCapital: ganhosCapital.data || [],
        rendaVariavel: rendaVariavel.data || [],
        fundosImobiliarios: fundosImobiliarios.data || [],
        demonstrativoLei14754: demonstrativoLei14754.data || [],
        resumoTributario: resumoTributario.data || null,
        evolucaoPatrimonial: evolucaoPatrimonial.data || null,
        outrasInformacoes: outrasInformacoes.data || null
      };
    }));

    const duracao = Date.now() - startTime;
    console.log(`[consultar-irpf] Consulta concluída em ${duracao}ms - ${declaracoesCompletas.length} declaração(ões)`);

    return new Response(
      JSON.stringify({
        success: true,
        declaracoes: declaracoesCompletas,
        total: declaracoesCompletas.length,
        duracao_ms: duracao
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("[consultar-irpf] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno ao processar consulta',
        detalhes: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
