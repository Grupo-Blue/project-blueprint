import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IRPFData {
  identificacao: {
    cpf: string;
    nome: string;
    dataNascimento?: string;
    exercicio: number;
    anoCalendario: number;
    tipoDeclaracao?: string;
  };
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    telefoneDdd?: string;
    telefoneNumero?: string;
    celularDdd?: string;
    celularNumero?: string;
    email?: string;
  };
  conjuge?: {
    possui: boolean;
    cpf?: string;
    nome?: string;
  };
  ocupacao?: {
    naturezaCodigo?: string;
    naturezaDescricao?: string;
    ocupacaoCodigo?: string;
    ocupacaoDescricao?: string;
  };
  dependentes: Array<{
    nome: string;
    cpf?: string;
    dataNascimento?: string;
    tipoCodigo?: string;
    tipoDescricao?: string;
  }>;
  rendimentos: Array<{
    categoria: string;
    codigoRendimento?: string;
    descricaoTipo?: string;
    cnpjFonte?: string;
    cpfFonte?: string;
    nomeFonte?: string;
    beneficiario?: string;
    valorRendimento?: number;
    contribuicaoPrevidenciaria?: number;
    impostoRetidoFonte?: number;
  }>;
  bensEDireitos: Array<{
    numeroBem: number;
    grupoCodigo: string;
    grupoDescricao?: string;
    codigoBem: string;
    codigoDescricao?: string;
    discriminacao: string;
    valorAnoAnterior?: number;
    valorAnoAtual?: number;
    pertenceA?: string;
    paisCodigo?: string;
    paisNome?: string;
    // Cripto
    criptoCodigo?: string;
    criptoTipo?: string;
    criptoExchange?: string;
    criptoQuantidade?: number;
    // Imóvel
    imovelTipo?: string;
    imovelAreaTotal?: number;
    imovelEndereco?: string;
    // Veículo
    veiculoTipo?: string;
    veiculoMarca?: string;
    veiculoModelo?: string;
    veiculoPlaca?: string;
    // Participação
    participacaoCnpj?: string;
    participacaoRazaoSocial?: string;
    participacaoPercentual?: number;
    // Conta
    bancoCodigo?: string;
    bancoNome?: string;
    bancoAgencia?: string;
    bancoConta?: string;
  }>;
  dividasEOnus: Array<{
    numeroDivida?: number;
    codigo: string;
    codigoDescricao?: string;
    discriminacao: string;
    situacaoAnoAnterior?: number;
    situacaoAnoAtual?: number;
    valorPagoNoAno?: number;
    credorCpfCnpj?: string;
    credorNome?: string;
    naturezaDivida?: string;
  }>;
  resumoTributario?: {
    tipoTributacao?: string;
    totalRendimentosTributaveis?: number;
    totalDeducoes?: number;
    baseCalculo?: number;
    impostoDevido?: number;
    totalImpostoPago?: number;
    impostoARestituir?: number;
    impostoAPagar?: number;
    aliquotaEfetiva?: number;
  };
  evolucaoPatrimonial?: {
    bensAnoAnterior?: number;
    bensAnoAtual?: number;
    dividasAnoAnterior?: number;
    dividasAnoAtual?: number;
    patrimonioLiquidoAnterior?: number;
    patrimonioLiquidoAtual?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { pdfBase64, id_empresa, arquivo_origem } = await req.json();

    if (!pdfBase64 || !id_empresa) {
      return new Response(
        JSON.stringify({ error: 'pdfBase64 e id_empresa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[processar-irpf] Iniciando processamento com IA...");

    // Chamar Lovable AI para extrair dados do PDF
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de declarações de Imposto de Renda Pessoa Física (IRPF) do Brasil.
Sua tarefa é extrair TODOS os dados do PDF da declaração de forma estruturada.

IMPORTANTE:
- Extraia TODOS os bens e direitos com a discriminação COMPLETA
- Extraia TODAS as dívidas e ônus com a discriminação COMPLETA
- Identifique criptoativos (grupo 08) e classifique o tipo (BTC, ETH, altcoin, stablecoin, NFT)
- Identifique participações societárias (grupo 03) com CNPJ e razão social
- Extraia todos os rendimentos tributáveis e isentos
- Extraia o resumo tributário completo
- Extraia a evolução patrimonial

Retorne APENAS um JSON válido com a estrutura especificada, sem texto adicional.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise este PDF de declaração IRPF e extraia todos os dados no formato JSON:

{
  "identificacao": {
    "cpf": "string (formato XXX.XXX.XXX-XX)",
    "nome": "string",
    "dataNascimento": "YYYY-MM-DD ou null",
    "exercicio": number (ex: 2025),
    "anoCalendario": number (ex: 2024),
    "tipoDeclaracao": "original ou retificadora"
  },
  "endereco": {
    "logradouro": "string",
    "numero": "string",
    "complemento": "string",
    "bairro": "string",
    "municipio": "string",
    "uf": "XX",
    "cep": "XXXXX-XXX",
    "email": "string"
  },
  "conjuge": {
    "possui": boolean,
    "cpf": "string ou null",
    "nome": "string ou null"
  },
  "dependentes": [
    {
      "nome": "string",
      "cpf": "string",
      "dataNascimento": "YYYY-MM-DD",
      "tipoCodigo": "21, 22, 31, etc",
      "tipoDescricao": "Filho, Cônjuge, etc"
    }
  ],
  "rendimentos": [
    {
      "categoria": "pj_titular | pj_dependente | isento | exclusiva_definitiva",
      "codigoRendimento": "string",
      "nomeFonte": "string",
      "cnpjFonte": "string",
      "valorRendimento": number,
      "impostoRetidoFonte": number
    }
  ],
  "bensEDireitos": [
    {
      "numeroBem": number,
      "grupoCodigo": "01-99",
      "grupoDescricao": "Imóveis, Veículos, Criptoativos, etc",
      "codigoBem": "01-99",
      "codigoDescricao": "Apartamento, Casa, BTC, ETH, etc",
      "discriminacao": "TEXTO COMPLETO DA DISCRIMINAÇÃO",
      "valorAnoAnterior": number,
      "valorAnoAtual": number,
      "pertenceA": "titular ou dependente",
      "paisCodigo": "105 = Brasil",
      "paisNome": "Brasil",
      "criptoCodigo": "BTC, ETH, ADA, etc (se grupo 08)",
      "criptoTipo": "bitcoin, altcoin, stablecoin, nft, token",
      "criptoExchange": "Binance, Mercado Bitcoin, etc",
      "criptoQuantidade": number,
      "participacaoCnpj": "XX.XXX.XXX/XXXX-XX (se grupo 03)",
      "participacaoRazaoSocial": "string",
      "participacaoPercentual": number
    }
  ],
  "dividasEOnus": [
    {
      "numeroDivida": number,
      "codigo": "11-15",
      "codigoDescricao": "Estabelecimento Bancário, Financeira, etc",
      "discriminacao": "TEXTO COMPLETO DA DISCRIMINAÇÃO",
      "situacaoAnoAnterior": number,
      "situacaoAnoAtual": number,
      "valorPagoNoAno": number,
      "credorCpfCnpj": "string",
      "credorNome": "string",
      "naturezaDivida": "financiamento, empréstimo, etc"
    }
  ],
  "resumoTributario": {
    "tipoTributacao": "deducoes_legais ou desconto_simplificado",
    "totalRendimentosTributaveis": number,
    "totalDeducoes": number,
    "baseCalculo": number,
    "impostoDevido": number,
    "totalImpostoPago": number,
    "impostoARestituir": number,
    "impostoAPagar": number,
    "aliquotaEfetiva": number (percentual)
  },
  "evolucaoPatrimonial": {
    "bensAnoAnterior": number,
    "bensAnoAtual": number,
    "dividasAnoAnterior": number,
    "dividasAnoAtual": number,
    "patrimonioLiquidoAnterior": number,
    "patrimonioLiquidoAtual": number
  }
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[processar-irpf] Erro na API:", errorText);
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Extrair JSON da resposta
    let irpfData: IRPFData;
    try {
      // Tentar extrair JSON de blocos de código
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      irpfData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("[processar-irpf] Erro ao parsear JSON:", parseError);
      console.log("[processar-irpf] Conteúdo recebido:", content.substring(0, 500));
      throw new Error("Falha ao interpretar resposta da IA como JSON");
    }

    console.log("[processar-irpf] Dados extraídos:", JSON.stringify(irpfData.identificacao));

    // Normalizar CPF
    const cpfNormalizado = irpfData.identificacao.cpf.replace(/\D/g, '');
    const cpfFormatado = cpfNormalizado.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    // 1. Buscar cliente_notion por CPF
    let clienteNotion = null;
    const { data: clienteExistente } = await supabase
      .from('cliente_notion')
      .select('*')
      .or(`cpf_cnpj.eq.${cpfFormatado},cpf_cnpj.eq.${cpfNormalizado}`)
      .maybeSingle();

    if (clienteExistente) {
      clienteNotion = clienteExistente;
      console.log("[processar-irpf] Cliente Notion encontrado:", clienteExistente.nome);
    }

    // 2. Inserir declaração principal
    const { data: declaracao, error: declError } = await supabase
      .from('irpf_declaracao')
      .insert({
        id_empresa,
        id_cliente_notion: clienteNotion?.id_cliente,
        cpf: cpfFormatado,
        nome_contribuinte: irpfData.identificacao.nome,
        data_nascimento: irpfData.identificacao.dataNascimento || null,
        exercicio: irpfData.identificacao.exercicio,
        ano_calendario: irpfData.identificacao.anoCalendario,
        tipo_declaracao: irpfData.identificacao.tipoDeclaracao || 'original',
        possui_conjuge: irpfData.conjuge?.possui || false,
        cpf_conjuge: irpfData.conjuge?.cpf,
        nome_conjuge: irpfData.conjuge?.nome,
        endereco_logradouro: irpfData.endereco?.logradouro,
        endereco_numero: irpfData.endereco?.numero,
        endereco_complemento: irpfData.endereco?.complemento,
        endereco_bairro: irpfData.endereco?.bairro,
        endereco_municipio: irpfData.endereco?.municipio,
        endereco_uf: irpfData.endereco?.uf,
        endereco_cep: irpfData.endereco?.cep,
        email: irpfData.endereco?.email,
        status_processamento: 'concluido',
        arquivo_origem,
      })
      .select()
      .single();

    if (declError) {
      console.error("[processar-irpf] Erro ao inserir declaração:", declError);
      throw new Error(`Erro ao salvar declaração: ${declError.message}`);
    }

    console.log("[processar-irpf] Declaração criada:", declaracao.id);

    // 3. Inserir dependentes
    if (irpfData.dependentes?.length > 0) {
      const dependentes = irpfData.dependentes.map(dep => ({
        id_declaracao: declaracao.id,
        nome: dep.nome,
        cpf: dep.cpf,
        data_nascimento: dep.dataNascimento,
        tipo_dependencia_codigo: dep.tipoCodigo,
        tipo_dependencia_descricao: dep.tipoDescricao,
      }));
      await supabase.from('irpf_dependente').insert(dependentes);
    }

    // 4. Inserir rendimentos
    if (irpfData.rendimentos?.length > 0) {
      const rendimentos = irpfData.rendimentos.map(rend => ({
        id_declaracao: declaracao.id,
        categoria: rend.categoria,
        codigo_rendimento: rend.codigoRendimento,
        descricao_tipo: rend.descricaoTipo,
        cnpj_fonte: rend.cnpjFonte,
        cpf_fonte: rend.cpfFonte,
        nome_fonte: rend.nomeFonte,
        beneficiario: rend.beneficiario || 'titular',
        valor_rendimento: rend.valorRendimento || 0,
        contribuicao_previdenciaria: rend.contribuicaoPrevidenciaria || 0,
        imposto_retido_fonte: rend.impostoRetidoFonte || 0,
      }));
      await supabase.from('irpf_rendimento').insert(rendimentos);
    }

    // 5. Inserir bens e direitos
    let totalBens = 0;
    let totalCripto = 0;
    let tiposCripto: string[] = [];
    let qtdEmpresas = 0;
    let qtdImoveis = 0;
    let valorInvestimentos = 0;

    if (irpfData.bensEDireitos?.length > 0) {
      const bens = irpfData.bensEDireitos.map(bem => {
        totalBens += bem.valorAnoAtual || 0;
        
        // Identificar criptoativos (grupo 08)
        if (bem.grupoCodigo === '08') {
          totalCripto += bem.valorAnoAtual || 0;
          if (bem.criptoCodigo && !tiposCripto.includes(bem.criptoCodigo)) {
            tiposCripto.push(bem.criptoCodigo);
          }
        }
        
        // Identificar participações (grupo 03)
        if (bem.grupoCodigo === '03') {
          qtdEmpresas++;
        }
        
        // Identificar imóveis (grupo 01)
        if (bem.grupoCodigo === '01') {
          qtdImoveis++;
        }
        
        // Identificar investimentos (grupos 04, 06, 07)
        if (['04', '06', '07'].includes(bem.grupoCodigo)) {
          valorInvestimentos += bem.valorAnoAtual || 0;
        }

        return {
          id_declaracao: declaracao.id,
          numero_bem: bem.numeroBem,
          grupo_codigo: bem.grupoCodigo,
          grupo_descricao: bem.grupoDescricao,
          codigo_bem: bem.codigoBem,
          codigo_descricao: bem.codigoDescricao,
          discriminacao: bem.discriminacao,
          valor_ano_anterior: bem.valorAnoAnterior || 0,
          valor_ano_atual: bem.valorAnoAtual || 0,
          pertence_a: bem.pertenceA || 'titular',
          pais_codigo: bem.paisCodigo,
          pais_nome: bem.paisNome,
          cripto_codigo: bem.criptoCodigo,
          cripto_tipo: bem.criptoTipo,
          cripto_exchange: bem.criptoExchange,
          cripto_quantidade: bem.criptoQuantidade,
          imovel_tipo: bem.imovelTipo,
          imovel_area_total: bem.imovelAreaTotal,
          imovel_endereco: bem.imovelEndereco,
          veiculo_tipo: bem.veiculoTipo,
          veiculo_marca: bem.veiculoMarca,
          veiculo_modelo: bem.veiculoModelo,
          veiculo_placa: bem.veiculoPlaca,
          participacao_cnpj: bem.participacaoCnpj,
          participacao_razao_social: bem.participacaoRazaoSocial,
          participacao_percentual: bem.participacaoPercentual,
          banco_codigo: bem.bancoCodigo,
          banco_nome: bem.bancoNome,
          banco_agencia: bem.bancoAgencia,
          banco_conta: bem.bancoConta,
        };
      });
      await supabase.from('irpf_bem_direito').insert(bens);
    }

    // 6. Inserir dívidas e ônus
    let totalDividas = 0;
    if (irpfData.dividasEOnus?.length > 0) {
      const dividas = irpfData.dividasEOnus.map(div => {
        totalDividas += div.situacaoAnoAtual || 0;
        return {
          id_declaracao: declaracao.id,
          numero_divida: div.numeroDivida,
          codigo: div.codigo,
          codigo_descricao: div.codigoDescricao,
          discriminacao: div.discriminacao,
          situacao_ano_anterior: div.situacaoAnoAnterior || 0,
          situacao_ano_atual: div.situacaoAnoAtual || 0,
          valor_pago_no_ano: div.valorPagoNoAno || 0,
          credor_cpf_cnpj: div.credorCpfCnpj,
          credor_nome: div.credorNome,
          natureza_divida: div.naturezaDivida,
        };
      });
      await supabase.from('irpf_divida_onus').insert(dividas);
    }

    // 7. Inserir resumo tributário
    if (irpfData.resumoTributario) {
      await supabase.from('irpf_resumo_tributario').insert({
        id_declaracao: declaracao.id,
        tipo_tributacao: irpfData.resumoTributario.tipoTributacao,
        total_rendimentos_tributaveis: irpfData.resumoTributario.totalRendimentosTributaveis || 0,
        total_deducoes: irpfData.resumoTributario.totalDeducoes || 0,
        base_calculo: irpfData.resumoTributario.baseCalculo || 0,
        total_imposto_devido: irpfData.resumoTributario.impostoDevido || 0,
        total_imposto_pago: irpfData.resumoTributario.totalImpostoPago || 0,
        imposto_a_restituir: irpfData.resumoTributario.impostoARestituir || 0,
        imposto_a_pagar: irpfData.resumoTributario.impostoAPagar || 0,
        aliquota_efetiva: irpfData.resumoTributario.aliquotaEfetiva || 0,
      });
    }

    // 8. Inserir evolução patrimonial
    if (irpfData.evolucaoPatrimonial) {
      await supabase.from('irpf_evolucao_patrimonial').insert({
        id_declaracao: declaracao.id,
        bens_ano_anterior: irpfData.evolucaoPatrimonial.bensAnoAnterior || 0,
        bens_ano_atual: irpfData.evolucaoPatrimonial.bensAnoAtual || 0,
        variacao_bens: (irpfData.evolucaoPatrimonial.bensAnoAtual || 0) - (irpfData.evolucaoPatrimonial.bensAnoAnterior || 0),
        dividas_ano_anterior: irpfData.evolucaoPatrimonial.dividasAnoAnterior || 0,
        dividas_ano_atual: irpfData.evolucaoPatrimonial.dividasAnoAtual || 0,
        variacao_dividas: (irpfData.evolucaoPatrimonial.dividasAnoAtual || 0) - (irpfData.evolucaoPatrimonial.dividasAnoAnterior || 0),
        patrimonio_liquido_anterior: irpfData.evolucaoPatrimonial.patrimonioLiquidoAnterior || 0,
        patrimonio_liquido_atual: irpfData.evolucaoPatrimonial.patrimonioLiquidoAtual || 0,
        variacao_patrimonial: (irpfData.evolucaoPatrimonial.patrimonioLiquidoAtual || 0) - (irpfData.evolucaoPatrimonial.patrimonioLiquidoAnterior || 0),
      });
    }

    // 9. Atualizar cliente_notion com anos_fiscais
    if (clienteNotion) {
      const anosAtuais = (clienteNotion.anos_fiscais as any[]) || [];
      const novoAno = {
        exercicio: irpfData.identificacao.exercicio,
        ano_calendario: irpfData.identificacao.anoCalendario,
        data_importacao: new Date().toISOString().split('T')[0],
      };
      
      // Verificar se já existe este exercício
      const jaExiste = anosAtuais.some((a: any) => a.exercicio === novoAno.exercicio);
      if (!jaExiste) {
        const novosAnos = [...anosAtuais, novoAno].sort((a, b) => b.exercicio - a.exercicio);
        await supabase
          .from('cliente_notion')
          .update({ 
            anos_fiscais: novosAnos,
            updated_at: new Date().toISOString()
          })
          .eq('id_cliente', clienteNotion.id_cliente);
        
        console.log("[processar-irpf] Anos fiscais atualizados no cliente_notion");
      }
    } else {
      // Criar novo cliente_notion
      const { data: novoCliente } = await supabase
        .from('cliente_notion')
        .insert({
          id_notion: `irpf_${cpfNormalizado}`,
          nome: irpfData.identificacao.nome,
          cpf_cnpj: cpfFormatado,
          email: irpfData.endereco?.email,
          status_cliente: 'prospect',
          anos_fiscais: [{
            exercicio: irpfData.identificacao.exercicio,
            ano_calendario: irpfData.identificacao.anoCalendario,
            data_importacao: new Date().toISOString().split('T')[0],
          }],
        })
        .select()
        .single();

      if (novoCliente) {
        await supabase
          .from('irpf_declaracao')
          .update({ id_cliente_notion: novoCliente.id_cliente })
          .eq('id', declaracao.id);
        
        console.log("[processar-irpf] Novo cliente_notion criado:", novoCliente.nome);
      }
    }

    // 10. Buscar e enriquecer lead por email → telefone → cliente_notion (cascata)
    const patrimonioLiquido = totalBens - totalDividas;
    const rendaAnual = irpfData.resumoTributario?.totalRendimentosTributaveis || 0;

    // Calcular perfil
    let perfilInvestidor = 'conservador';
    if (tiposCripto.length > 2 || totalCripto > 100000) perfilInvestidor = 'agressivo';
    else if (tiposCripto.length > 0 || valorInvestimentos > 50000) perfilInvestidor = 'moderado';

    let faixaPatrimonial = 'ate_100k';
    if (patrimonioLiquido > 1000000) faixaPatrimonial = 'acima_1m';
    else if (patrimonioLiquido > 500000) faixaPatrimonial = '500k_1m';
    else if (patrimonioLiquido > 100000) faixaPatrimonial = '100k_500k';

    let complexidade = 'simples';
    if (irpfData.bensEDireitos.length > 15 || qtdEmpresas > 0 || tiposCripto.length > 0) complexidade = 'complexa';
    else if (irpfData.bensEDireitos.length > 5) complexidade = 'media';

    // Normalizar telefone do IRPF para E.164
    let telefoneNormalizado: string | null = null;
    const celularDdd = irpfData.endereco?.celularDdd || irpfData.endereco?.telefoneDdd;
    const celularNumero = irpfData.endereco?.celularNumero || irpfData.endereco?.telefoneNumero;
    if (celularDdd && celularNumero) {
      const numeroLimpo = (celularDdd + celularNumero).replace(/\D/g, '');
      // Inserir 9 após DDD se número tem 10 dígitos (DDD + 8 dígitos)
      const numeroComNove = numeroLimpo.length === 10 
        ? numeroLimpo.slice(0, 2) + '9' + numeroLimpo.slice(2) 
        : numeroLimpo;
      telefoneNormalizado = '+55' + numeroComNove;
      console.log("[processar-irpf] Telefone normalizado:", telefoneNormalizado);
    }

    // Buscar lead em cascata: email → telefone → cliente_notion
    let leadId: string | null = null;
    let metodoVinculacao = '';

    // 1º - Buscar por email (mais confiável)
    if (irpfData.endereco?.email) {
      const { data: leadPorEmail } = await supabase
        .from('lead')
        .select('id_lead')
        .ilike('email', irpfData.endereco.email)
        .eq('id_empresa', id_empresa)
        .maybeSingle();
      
      if (leadPorEmail) {
        leadId = leadPorEmail.id_lead;
        metodoVinculacao = 'email';
        console.log("[processar-irpf] Lead encontrado por email:", leadId);
      }
    }

    // 2º - Buscar por telefone (se email não encontrou)
    if (!leadId && telefoneNormalizado) {
      const { data: leadPorTelefone } = await supabase
        .from('lead')
        .select('id_lead')
        .eq('telefone', telefoneNormalizado)
        .eq('id_empresa', id_empresa)
        .maybeSingle();
      
      if (leadPorTelefone) {
        leadId = leadPorTelefone.id_lead;
        metodoVinculacao = 'telefone';
        console.log("[processar-irpf] Lead encontrado por telefone:", leadId);
      }
    }

    // 3º - Buscar por cliente_notion (se email e telefone não encontraram)
    if (!leadId && clienteNotion?.id_cliente) {
      const { data: leadPorCliente } = await supabase
        .from('lead')
        .select('id_lead')
        .eq('id_cliente_notion', clienteNotion.id_cliente)
        .eq('id_empresa', id_empresa)
        .maybeSingle();
      
      if (leadPorCliente) {
        leadId = leadPorCliente.id_lead;
        metodoVinculacao = 'cliente_notion';
        console.log("[processar-irpf] Lead encontrado por cliente_notion:", leadId);
      }
    }

    if (leadId) {
      await supabase
        .from('lead')
        .update({
          id_irpf_declaracao: declaracao.id,
          irpf_ano_mais_recente: irpfData.identificacao.exercicio,
          irpf_renda_anual: rendaAnual,
          irpf_patrimonio_liquido: patrimonioLiquido,
          irpf_total_bens: totalBens,
          irpf_total_dividas: totalDividas,
          irpf_aliquota_efetiva: irpfData.resumoTributario?.aliquotaEfetiva || 0,
          irpf_imposto_restituir: irpfData.resumoTributario?.impostoARestituir || 0,
          irpf_imposto_pagar: irpfData.resumoTributario?.impostoAPagar || 0,
          irpf_possui_cripto: tiposCripto.length > 0,
          irpf_valor_cripto: totalCripto,
          irpf_tipos_cripto: tiposCripto,
          irpf_possui_empresas: qtdEmpresas > 0,
          irpf_qtd_empresas: qtdEmpresas,
          irpf_possui_imoveis: qtdImoveis > 0,
          irpf_qtd_imoveis: qtdImoveis,
          irpf_possui_investimentos: valorInvestimentos > 0,
          irpf_valor_investimentos: valorInvestimentos,
          irpf_perfil_investidor: perfilInvestidor,
          irpf_faixa_patrimonial: faixaPatrimonial,
          irpf_complexidade_declaracao: complexidade,
        })
        .eq('id_lead', leadId);

      // Atualizar declaração com id_lead
      await supabase
        .from('irpf_declaracao')
        .update({ id_lead: leadId })
        .eq('id', declaracao.id);

      console.log("[processar-irpf] Lead enriquecido via", metodoVinculacao, ":", leadId);
    } else {
      console.log("[processar-irpf] Nenhum lead encontrado para vinculação automática");
    }

    const duracao = Date.now() - startTime;

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'processar-irpf',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        cpf: cpfFormatado,
        exercicio: irpfData.identificacao.exercicio,
        bens: irpfData.bensEDireitos?.length || 0,
        dividas: irpfData.dividasEOnus?.length || 0,
        rendimentos: irpfData.rendimentos?.length || 0,
        lead_enriquecido: !!leadId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        declaracao_id: declaracao.id,
        cpf: cpfFormatado,
        nome: irpfData.identificacao.nome,
        exercicio: irpfData.identificacao.exercicio,
        resumo: {
          bens: irpfData.bensEDireitos?.length || 0,
          dividas: irpfData.dividasEOnus?.length || 0,
          rendimentos: irpfData.rendimentos?.length || 0,
          totalBens,
          totalDividas,
          patrimonioLiquido,
          possuiCripto: tiposCripto.length > 0,
          tiposCripto,
          perfilInvestidor,
          faixaPatrimonial,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[processar-irpf] Erro:", error);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'processar-irpf',
      status: 'erro',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar IRPF',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
