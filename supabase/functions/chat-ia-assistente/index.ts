import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Tool definitions for Gemini function calling
const toolDeclarations = [
  // === EXISTING TOOLS (6) ===
  {
    name: "buscar_metricas_empresa",
    description: "Busca métricas consolidadas de uma empresa: leads, vendas, CPL, CAC, verba investida, ticket médio. Use para responder sobre performance geral.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias: { type: "number", description: "Últimos N dias para buscar (padrão 30)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_campanhas",
    description: "Busca campanhas com métricas agregadas (leads, verba, cliques, impressões). Pode filtrar por ativas, plataforma e ordenação.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        ativas_apenas: { type: "boolean", description: "Filtrar só campanhas ativas" },
        dias: { type: "number", description: "Período em dias (padrão 30)" },
        limite: { type: "number", description: "Máximo de campanhas (padrão 20)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_leads",
    description: "Busca leads com filtros. Pode filtrar por período, se converteu em venda, canal de origem, etc.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias: { type: "number", description: "Últimos N dias (padrão 30)" },
        com_venda: { type: "boolean", description: "Filtrar apenas leads que viraram venda" },
        limite: { type: "number", description: "Máximo de leads retornados (padrão 50)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_criativos",
    description: "Busca criativos (anúncios) com métricas de performance: leads, cliques, impressões, verba, CPL.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias: { type: "number", description: "Período em dias (padrão 30)" },
        limite: { type: "number", description: "Máximo de criativos (padrão 15)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_demandas",
    description: "Busca demandas/tarefas de campanhas de tráfego. Permite ver o que está pendente, em andamento ou concluído.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        status: { type: "string", description: "Filtrar por status: pendente, em_andamento, concluida, cancelada" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "resumo_geral",
    description: "Gera um resumo rápido e consolidado da empresa: total de leads, vendas, verba, CPL médio e campanhas ativas no mês atual.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
      },
      required: ["id_empresa"],
    },
  },

  // === NEW READING TOOLS (9) ===
  {
    name: "comparar_periodos",
    description: "Compara métricas entre dois períodos (ex: últimos 30 dias vs 30 dias anteriores). Calcula variação percentual de leads, vendas, CPL, verba e CAC.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias_periodo: { type: "number", description: "Tamanho do período em dias (padrão 30). Compara os últimos N dias com os N dias anteriores." },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_alertas",
    description: "Busca alertas automáticos do sistema (CPL alto, queda de leads, campanhas sem impressões, etc). Pode filtrar por severidade e status de resolução.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        severidade: { type: "string", description: "Filtrar por severidade: info, warning, critical" },
        apenas_pendentes: { type: "boolean", description: "Mostrar apenas alertas não resolvidos (padrão true)" },
        limite: { type: "number", description: "Máximo de alertas (padrão 20)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_concorrentes",
    description: "Busca anúncios de concorrentes detectados pelo sistema. Pode filtrar por nome do concorrente, plataforma e status.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        concorrente_nome: { type: "string", description: "Filtrar por nome do concorrente" },
        plataforma: { type: "string", description: "Filtrar por plataforma: meta, google, linkedin" },
        limite: { type: "number", description: "Máximo de anúncios (padrão 20)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_hipoteses",
    description: "Busca hipóteses de teste registradas. Pode filtrar por resultado (confirmada, refutada, inconclusiva) ou apenas pendentes.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        resultado: { type: "string", description: "Filtrar por resultado: confirmada, refutada, inconclusiva, pendente" },
        limite: { type: "number", description: "Máximo de hipóteses (padrão 20)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_aprendizados",
    description: "Busca aprendizados semanais registrados pela equipe. Inclui insights, descobertas e lições aprendidas.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        tipo: { type: "string", description: "Filtrar por tipo de aprendizado" },
        limite: { type: "number", description: "Máximo de aprendizados (padrão 20)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_metricas_instagram",
    description: "Busca métricas de redes sociais orgânicas: seguidores, alcance, impressões, cliques no website e visitas ao perfil.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias: { type: "number", description: "Últimos N dias (padrão 30)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "funil_conversao",
    description: "Calcula o funil de conversão completo: Leads Total → Leads Pagos → Levantadas → MQLs → Reuniões → Vendas, com taxas de conversão entre cada etapa.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        dias: { type: "number", description: "Período em dias (padrão 30)" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "listar_empresas",
    description: "Lista todas as empresas cadastradas no sistema com nome, CPL máximo, CAC máximo e meta de verba mensal. Útil quando nenhuma empresa está selecionada ou para comparar parâmetros.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "buscar_landing_pages",
    description: "Busca dados de performance de landing pages: sessões, conversões, taxa de rejeição e análises de IA existentes.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        limite: { type: "number", description: "Máximo de LPs (padrão 10)" },
      },
      required: ["id_empresa"],
    },
  },

  // === NEW WRITING TOOLS (4) ===
  {
    name: "criar_demanda_campanha",
    description: "Cria uma nova demanda/briefing de campanha de tráfego. SEMPRE peça confirmação do usuário antes de usar esta ferramenta.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        titulo: { type: "string", description: "Título da demanda" },
        descricao: { type: "string", description: "Descrição detalhada da campanha" },
        plataforma: { type: "string", description: "Plataforma: META ou GOOGLE" },
        prioridade: { type: "string", description: "Prioridade: BAIXA, MEDIA, ALTA, URGENTE" },
        verba_diaria: { type: "number", description: "Verba diária em reais" },
        verba_total: { type: "number", description: "Verba total em reais" },
        data_inicio: { type: "string", description: "Data de início (YYYY-MM-DD)" },
        data_fim: { type: "string", description: "Data de fim (YYYY-MM-DD)" },
        utm_source: { type: "string", description: "UTM source sugerido" },
        utm_medium: { type: "string", description: "UTM medium sugerido" },
        utm_campaign: { type: "string", description: "UTM campaign sugerido" },
      },
      required: ["id_empresa", "titulo", "plataforma"],
    },
  },
  {
    name: "criar_alerta",
    description: "Cria um alerta manual para a equipe acompanhar. SEMPRE peça confirmação do usuário antes de usar esta ferramenta.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        tipo: { type: "string", description: "Tipo do alerta (ex: cpl_alto, queda_leads, anomalia)" },
        severidade: { type: "string", description: "Severidade: info, warning, critical" },
        titulo: { type: "string", description: "Título do alerta" },
        descricao: { type: "string", description: "Descrição detalhada" },
      },
      required: ["id_empresa", "tipo", "severidade", "titulo"],
    },
  },
  {
    name: "criar_hipotese",
    description: "Registra uma nova hipótese de teste. SEMPRE peça confirmação do usuário antes de usar esta ferramenta.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        id_semana: { type: "string", description: "UUID da semana (se não fornecido, usa a semana atual)" },
        tipo: { type: "string", description: "Tipo da hipótese (ex: criativo, publico, verba, landing_page)" },
        descricao: { type: "string", description: "Descrição da hipótese" },
        criterio_sucesso: { type: "string", description: "Critério para considerar a hipótese confirmada" },
      },
      required: ["id_empresa", "tipo", "descricao", "criterio_sucesso"],
    },
  },
  {
    name: "criar_aprendizado",
    description: "Registra um novo aprendizado/insight semanal. SEMPRE peça confirmação do usuário antes de usar esta ferramenta.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
        id_semana: { type: "string", description: "UUID da semana (se não fornecido, usa a semana atual)" },
        tipo: { type: "string", description: "Tipo do aprendizado" },
        descricao: { type: "string", description: "Descrição do aprendizado" },
        metricas_suporte: { type: "string", description: "Métricas que suportam este aprendizado" },
      },
      required: ["id_empresa", "tipo", "descricao"],
    },
  },
];

// Tool execution functions
async function executeTool(name: string, args: Record<string, any>, userId?: string): Promise<any> {
  const id_empresa = args.id_empresa;

  switch (name) {
    // === EXISTING TOOLS ===
    case "buscar_metricas_empresa": {
      const dias = args.dias || 30;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabaseAdmin
        .from("empresa_metricas_dia")
        .select("data, leads_total, leads_pagos, vendas, valor_vendas, verba_investida, cpl, cac, ticket_medio, levantadas, mqls, reunioes")
        .eq("id_empresa", id_empresa)
        .gte("data", dataInicio.toISOString().split("T")[0])
        .order("data", { ascending: false });

      if (error) return { error: error.message };

      const totais = (data || []).reduce(
        (acc: any, d: any) => ({
          leads_total: acc.leads_total + (d.leads_total || 0),
          leads_pagos: acc.leads_pagos + (d.leads_pagos || 0),
          vendas: acc.vendas + (d.vendas || 0),
          valor_vendas: acc.valor_vendas + (d.valor_vendas || 0),
          verba_investida: acc.verba_investida + (d.verba_investida || 0),
          levantadas: acc.levantadas + (d.levantadas || 0),
          mqls: acc.mqls + (d.mqls || 0),
          reunioes: acc.reunioes + (d.reunioes || 0),
        }),
        { leads_total: 0, leads_pagos: 0, vendas: 0, valor_vendas: 0, verba_investida: 0, levantadas: 0, mqls: 0, reunioes: 0 }
      );

      totais.cpl = totais.leads_pagos > 0 ? totais.verba_investida / totais.leads_pagos : 0;
      totais.cac = totais.vendas > 0 ? totais.verba_investida / totais.vendas : 0;
      totais.ticket_medio = totais.vendas > 0 ? totais.valor_vendas / totais.vendas : 0;
      totais.periodo_dias = dias;
      totais.registros_diarios = data?.length || 0;

      return totais;
    }

    case "buscar_campanhas": {
      const dias = args.dias || 30;
      const limite = args.limite || 20;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data: contas } = await supabaseAdmin
        .from("conta_anuncio")
        .select("id_conta")
        .eq("id_empresa", id_empresa);

      if (!contas?.length) return { campanhas: [], mensagem: "Nenhuma conta de anúncio encontrada" };

      const contaIds = contas.map((c: any) => c.id_conta);

      let query = supabaseAdmin
        .from("campanha")
        .select("id_campanha, nome, ativa, tipo_funil, objetivo, id_campanha_externo")
        .in("id_conta", contaIds);

      if (args.ativas_apenas) query = query.eq("ativa", true);

      const { data: campanhas } = await query.limit(limite);

      if (!campanhas?.length) return { campanhas: [], mensagem: "Nenhuma campanha encontrada" };

      const campanhaIds = campanhas.map((c: any) => c.id_campanha);
      const { data: metricas } = await supabaseAdmin
        .from("campanha_metricas_dia")
        .select("id_campanha, leads, cliques, impressoes, verba_investida")
        .in("id_campanha", campanhaIds)
        .gte("data", dataInicio.toISOString().split("T")[0]);

      const metricasPorCampanha: Record<string, any> = {};
      (metricas || []).forEach((m: any) => {
        if (!metricasPorCampanha[m.id_campanha]) {
          metricasPorCampanha[m.id_campanha] = { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        }
        const mp = metricasPorCampanha[m.id_campanha];
        mp.leads += m.leads || 0;
        mp.cliques += m.cliques || 0;
        mp.impressoes += m.impressoes || 0;
        mp.verba += m.verba_investida || 0;
      });

      return campanhas.map((c: any) => {
        const m = metricasPorCampanha[c.id_campanha] || { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        return {
          nome: c.nome,
          ativa: c.ativa,
          tipo_funil: c.tipo_funil,
          objetivo: c.objetivo,
          leads: m.leads,
          cliques: m.cliques,
          impressoes: m.impressoes,
          verba_investida: m.verba,
          cpl: m.leads > 0 ? (m.verba / m.leads).toFixed(2) : null,
          ctr: m.impressoes > 0 ? ((m.cliques / m.impressoes) * 100).toFixed(2) + "%" : null,
        };
      });
    }

    case "buscar_leads": {
      const dias = args.dias || 30;
      const limite = args.limite || 50;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      let query = supabaseAdmin
        .from("lead")
        .select("nome_lead, email, telefone, utm_source, utm_medium, utm_campaign, canal, venda, valor_venda, data_criacao, etapa_funil")
        .eq("id_empresa", id_empresa)
        .gte("data_criacao", dataInicio.toISOString().split("T")[0])
        .order("data_criacao", { ascending: false })
        .limit(limite);

      if (args.com_venda === true) query = query.eq("venda", true);
      if (args.com_venda === false) query = query.eq("venda", false);

      const { data, error } = await query;
      if (error) return { error: error.message };

      return { total: data?.length || 0, leads: data || [] };
    }

    case "buscar_criativos": {
      const dias = args.dias || 30;
      const limite = args.limite || 15;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data: contas } = await supabaseAdmin
        .from("conta_anuncio")
        .select("id_conta")
        .eq("id_empresa", id_empresa);

      if (!contas?.length) return { criativos: [] };

      const contaIds = contas.map((c: any) => c.id_conta);

      const { data: campanhas } = await supabaseAdmin
        .from("campanha")
        .select("id_campanha")
        .in("id_conta", contaIds);

      if (!campanhas?.length) return { criativos: [] };

      const campanhaIds = campanhas.map((c: any) => c.id_campanha);

      const { data: criativos } = await supabaseAdmin
        .from("criativo")
        .select("id_criativo, descricao, tipo, ativo, url_preview")
        .in("id_campanha", campanhaIds)
        .eq("ativo", true)
        .limit(limite);

      if (!criativos?.length) return { criativos: [] };

      const criativoIds = criativos.map((c: any) => c.id_criativo);
      const { data: metricas } = await supabaseAdmin
        .from("criativo_metricas_dia")
        .select("id_criativo, leads, cliques, impressoes, verba_investida")
        .in("id_criativo", criativoIds)
        .gte("data", dataInicio.toISOString().split("T")[0]);

      const metricasPorCriativo: Record<string, any> = {};
      (metricas || []).forEach((m: any) => {
        if (!metricasPorCriativo[m.id_criativo]) {
          metricasPorCriativo[m.id_criativo] = { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        }
        const mp = metricasPorCriativo[m.id_criativo];
        mp.leads += m.leads || 0;
        mp.cliques += m.cliques || 0;
        mp.impressoes += m.impressoes || 0;
        mp.verba += m.verba_investida || 0;
      });

      return criativos.map((c: any) => {
        const m = metricasPorCriativo[c.id_criativo] || { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        return {
          descricao: c.descricao,
          tipo: c.tipo,
          leads: m.leads,
          cliques: m.cliques,
          impressoes: m.impressoes,
          verba: m.verba,
          cpl: m.leads > 0 ? (m.verba / m.leads).toFixed(2) : null,
        };
      });
    }

    case "buscar_demandas": {
      let query = supabaseAdmin
        .from("demanda_campanha")
        .select("titulo, descricao, plataforma, status, prioridade, verba_total, verba_diaria, created_at")
        .eq("id_empresa", id_empresa)
        .order("created_at", { ascending: false })
        .limit(20);

      if (args.status) query = query.eq("status", args.status);

      const { data, error } = await query;
      if (error) return { error: error.message };
      return data || [];
    }

    case "resumo_geral": {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const { data: metricas } = await supabaseAdmin
        .from("empresa_metricas_dia")
        .select("leads_total, leads_pagos, vendas, valor_vendas, verba_investida")
        .eq("id_empresa", id_empresa)
        .gte("data", inicioMes);

      const totais = (metricas || []).reduce(
        (acc: any, d: any) => ({
          leads: acc.leads + (d.leads_total || 0),
          vendas: acc.vendas + (d.vendas || 0),
          valor_vendas: acc.valor_vendas + (d.valor_vendas || 0),
          verba: acc.verba + (d.verba_investida || 0),
        }),
        { leads: 0, vendas: 0, valor_vendas: 0, verba: 0 }
      );

      const { data: empresa } = await supabaseAdmin
        .from("empresa")
        .select("nome, cpl_maximo, cac_maximo, meta_verba_mensal")
        .eq("id_empresa", id_empresa)
        .single();

      const { data: contas } = await supabaseAdmin
        .from("conta_anuncio")
        .select("id_conta")
        .eq("id_empresa", id_empresa);

      let campanhasAtivas = 0;
      if (contas?.length) {
        const { count } = await supabaseAdmin
          .from("campanha")
          .select("id_campanha", { count: "exact", head: true })
          .in("id_conta", contas.map((c: any) => c.id_conta))
          .eq("ativa", true);
        campanhasAtivas = count || 0;
      }

      return {
        empresa: empresa?.nome,
        mes_atual: inicioMes,
        leads_total: totais.leads,
        vendas: totais.vendas,
        valor_vendas: totais.valor_vendas,
        verba_investida: totais.verba,
        cpl_medio: totais.leads > 0 ? (totais.verba / totais.leads).toFixed(2) : null,
        cac_medio: totais.vendas > 0 ? (totais.verba / totais.vendas).toFixed(2) : null,
        campanhas_ativas: campanhasAtivas,
        meta_verba_mensal: empresa?.meta_verba_mensal,
        cpl_maximo: empresa?.cpl_maximo,
        cac_maximo: empresa?.cac_maximo,
      };
    }

    // === NEW READING TOOLS ===
    case "comparar_periodos": {
      const dias = args.dias_periodo || 30;
      const now = new Date();
      const inicioAtual = new Date(now);
      inicioAtual.setDate(inicioAtual.getDate() - dias);
      const inicioAnterior = new Date(inicioAtual);
      inicioAnterior.setDate(inicioAnterior.getDate() - dias);

      const aggregate = (rows: any[]) =>
        rows.reduce(
          (acc: any, d: any) => ({
            leads: acc.leads + (d.leads_total || 0),
            leads_pagos: acc.leads_pagos + (d.leads_pagos || 0),
            vendas: acc.vendas + (d.vendas || 0),
            valor_vendas: acc.valor_vendas + (d.valor_vendas || 0),
            verba: acc.verba + (d.verba_investida || 0),
          }),
          { leads: 0, leads_pagos: 0, vendas: 0, valor_vendas: 0, verba: 0 }
        );

      const { data: atual } = await supabaseAdmin
        .from("empresa_metricas_dia")
        .select("leads_total, leads_pagos, vendas, valor_vendas, verba_investida")
        .eq("id_empresa", id_empresa)
        .gte("data", inicioAtual.toISOString().split("T")[0]);

      const { data: anterior } = await supabaseAdmin
        .from("empresa_metricas_dia")
        .select("leads_total, leads_pagos, vendas, valor_vendas, verba_investida")
        .eq("id_empresa", id_empresa)
        .gte("data", inicioAnterior.toISOString().split("T")[0])
        .lt("data", inicioAtual.toISOString().split("T")[0]);

      const a = aggregate(atual || []);
      const b = aggregate(anterior || []);

      const variacao = (atual: number, anterior: number) =>
        anterior > 0 ? (((atual - anterior) / anterior) * 100).toFixed(1) + "%" : "N/A";

      const cplAtual = a.leads_pagos > 0 ? a.verba / a.leads_pagos : 0;
      const cplAnterior = b.leads_pagos > 0 ? b.verba / b.leads_pagos : 0;
      const cacAtual = a.vendas > 0 ? a.verba / a.vendas : 0;
      const cacAnterior = b.vendas > 0 ? b.verba / b.vendas : 0;

      return {
        periodo_atual: { ...a, cpl: cplAtual.toFixed(2), cac: cacAtual.toFixed(2) },
        periodo_anterior: { ...b, cpl: cplAnterior.toFixed(2), cac: cacAnterior.toFixed(2) },
        variacao: {
          leads: variacao(a.leads, b.leads),
          vendas: variacao(a.vendas, b.vendas),
          verba: variacao(a.verba, b.verba),
          cpl: variacao(cplAtual, cplAnterior),
          cac: variacao(cacAtual, cacAnterior),
        },
        dias_comparados: dias,
      };
    }

    case "buscar_alertas": {
      const limite = args.limite || 20;
      let query = supabaseAdmin
        .from("alerta_automatico")
        .select("id_alerta, tipo, severidade, titulo, descricao, metadados, resolvido, created_at")
        .eq("id_empresa", id_empresa)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (args.severidade) query = query.eq("severidade", args.severidade);
      if (args.apenas_pendentes !== false) query = query.eq("resolvido", false);

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { total: data?.length || 0, alertas: data || [] };
    }

    case "buscar_concorrentes": {
      const limite = args.limite || 20;
      let query = supabaseAdmin
        .from("concorrente_anuncio")
        .select("concorrente_nome, plataforma, titulo, texto_corpo, url_destino, status, data_detectado, impressoes_estimadas")
        .eq("id_empresa", id_empresa)
        .order("data_detectado", { ascending: false })
        .limit(limite);

      if (args.concorrente_nome) query = query.ilike("concorrente_nome", `%${args.concorrente_nome}%`);
      if (args.plataforma) query = query.eq("plataforma", args.plataforma);

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { total: data?.length || 0, anuncios: data || [] };
    }

    case "buscar_hipoteses": {
      const limite = args.limite || 20;
      let query = supabaseAdmin
        .from("hipotese_teste")
        .select("id_hipotese, tipo, descricao, criterio_sucesso, resultado_semana_seguinte, comentario_resultado, created_at")
        .eq("id_empresa", id_empresa)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (args.resultado === "pendente") {
        query = query.is("resultado_semana_seguinte", null);
      } else if (args.resultado) {
        query = query.eq("resultado_semana_seguinte", args.resultado);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { total: data?.length || 0, hipoteses: data || [] };
    }

    case "buscar_aprendizados": {
      const limite = args.limite || 20;
      let query = supabaseAdmin
        .from("aprendizado_semana")
        .select("id_aprendizado, tipo, descricao, metricas_suporte, created_at")
        .eq("id_empresa", id_empresa)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (args.tipo) query = query.eq("tipo", args.tipo);

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { total: data?.length || 0, aprendizados: data || [] };
    }

    case "buscar_metricas_instagram": {
      const dias = args.dias || 30;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabaseAdmin
        .from("instagram_metricas_dia")
        .select("data, seguidores_total, novos_seguidores, alcance, impressoes, cliques_website, visitas_perfil")
        .eq("id_empresa", id_empresa)
        .gte("data", dataInicio.toISOString().split("T")[0])
        .order("data", { ascending: false });

      if (error) return { error: error.message };
      if (!data?.length) return { mensagem: "Nenhuma métrica de Instagram encontrada para este período" };

      const ultimo = data[0];
      const totais = data.reduce(
        (acc: any, d: any) => ({
          novos_seguidores: acc.novos_seguidores + (d.novos_seguidores || 0),
          alcance: acc.alcance + (d.alcance || 0),
          impressoes: acc.impressoes + (d.impressoes || 0),
          cliques_website: acc.cliques_website + (d.cliques_website || 0),
          visitas_perfil: acc.visitas_perfil + (d.visitas_perfil || 0),
        }),
        { novos_seguidores: 0, alcance: 0, impressoes: 0, cliques_website: 0, visitas_perfil: 0 }
      );

      return {
        seguidores_atual: ultimo.seguidores_total,
        periodo_dias: dias,
        ...totais,
        media_diaria_alcance: data.length > 0 ? Math.round(totais.alcance / data.length) : 0,
      };
    }

    case "funil_conversao": {
      const dias = args.dias || 30;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabaseAdmin
        .from("empresa_metricas_dia")
        .select("leads_total, leads_pagos, levantadas, mqls, reunioes, vendas")
        .eq("id_empresa", id_empresa)
        .gte("data", dataInicio.toISOString().split("T")[0]);

      if (error) return { error: error.message };

      const t = (data || []).reduce(
        (acc: any, d: any) => ({
          leads_total: acc.leads_total + (d.leads_total || 0),
          leads_pagos: acc.leads_pagos + (d.leads_pagos || 0),
          levantadas: acc.levantadas + (d.levantadas || 0),
          mqls: acc.mqls + (d.mqls || 0),
          reunioes: acc.reunioes + (d.reunioes || 0),
          vendas: acc.vendas + (d.vendas || 0),
        }),
        { leads_total: 0, leads_pagos: 0, levantadas: 0, mqls: 0, reunioes: 0, vendas: 0 }
      );

      const taxa = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "N/A");

      return {
        funil: t,
        taxas: {
          lead_para_levantada: taxa(t.levantadas, t.leads_total),
          levantada_para_mql: taxa(t.mqls, t.levantadas),
          mql_para_reuniao: taxa(t.reunioes, t.mqls),
          reuniao_para_venda: taxa(t.vendas, t.reunioes),
          eficiencia_geral: taxa(t.vendas, t.leads_total),
        },
        periodo_dias: dias,
      };
    }

    case "listar_empresas": {
      const { data, error } = await supabaseAdmin
        .from("empresa")
        .select("id_empresa, nome, cpl_maximo, cac_maximo, meta_verba_mensal, ticket_medio_alvo")
        .order("nome");

      if (error) return { error: error.message };
      return { total: data?.length || 0, empresas: data || [] };
    }

    case "buscar_landing_pages": {
      const limite = args.limite || 10;

      // Try to get landing page configs
      const { data: configs } = await supabaseAdmin
        .from("landingpage_config")
        .select("id, url, nome, id_empresa")
        .eq("id_empresa", id_empresa)
        .limit(limite);

      if (!configs?.length) return { mensagem: "Nenhuma landing page configurada para esta empresa" };

      // Get latest analyses
      const lpIds = configs.map((c: any) => c.id);
      const { data: analises } = await supabaseAdmin
        .from("landingpage_analise")
        .select("id_landingpage, nota_geral, resumo_executivo, pontos_fortes, pontos_fracos, created_at")
        .in("id_landingpage", lpIds)
        .order("created_at", { ascending: false });

      const analisesPorLP: Record<string, any> = {};
      (analises || []).forEach((a: any) => {
        if (!analisesPorLP[a.id_landingpage]) analisesPorLP[a.id_landingpage] = a;
      });

      return configs.map((c: any) => ({
        nome: c.nome,
        url: c.url,
        analise: analisesPorLP[c.id] || null,
      }));
    }

    // === NEW WRITING TOOLS ===
    case "criar_demanda_campanha": {
      if (!userId) return { error: "Usuário não autenticado para criar demanda" };

      const { data, error } = await supabaseAdmin
        .from("demanda_campanha")
        .insert({
          id_empresa,
          id_criador: userId,
          titulo: args.titulo,
          descricao: args.descricao || null,
          plataforma: args.plataforma,
          prioridade: args.prioridade || "MEDIA",
          verba_diaria: args.verba_diaria || null,
          verba_total: args.verba_total || null,
          data_inicio: args.data_inicio || null,
          data_fim: args.data_fim || null,
          utm_source: args.utm_source || null,
          utm_medium: args.utm_medium || null,
          utm_campaign: args.utm_campaign || null,
          status: "PENDENTE",
          sugerida_por_ia: true,
        })
        .select("id_demanda, titulo, status")
        .single();

      if (error) return { error: error.message };
      return { sucesso: true, mensagem: `Demanda "${args.titulo}" criada com sucesso!`, demanda: data };
    }

    case "criar_alerta": {
      const { data, error } = await supabaseAdmin
        .from("alerta_automatico")
        .insert({
          id_empresa,
          tipo: args.tipo,
          severidade: args.severidade,
          titulo: args.titulo,
          descricao: args.descricao || null,
          metadados: args.metadados || null,
          acionavel: true,
        })
        .select("id_alerta, titulo, severidade")
        .single();

      if (error) return { error: error.message };
      return { sucesso: true, mensagem: `Alerta "${args.titulo}" criado com sucesso!`, alerta: data };
    }

    case "criar_hipotese": {
      let id_semana = args.id_semana;

      // Get current week if not provided
      if (!id_semana) {
        const { data: semana } = await supabaseAdmin
          .from("semana")
          .select("id_semana")
          .lte("data_inicio", new Date().toISOString().split("T")[0])
          .gte("data_fim", new Date().toISOString().split("T")[0])
          .single();

        if (semana) {
          id_semana = semana.id_semana;
        } else {
          // Fallback: get most recent week
          const { data: ultimaSemana } = await supabaseAdmin
            .from("semana")
            .select("id_semana")
            .order("data_fim", { ascending: false })
            .limit(1)
            .single();
          id_semana = ultimaSemana?.id_semana;
        }
      }

      if (!id_semana) return { error: "Não foi possível determinar a semana atual" };

      const { data, error } = await supabaseAdmin
        .from("hipotese_teste")
        .insert({
          id_empresa,
          id_semana,
          tipo: args.tipo,
          descricao: args.descricao,
          criterio_sucesso: args.criterio_sucesso,
        })
        .select("id_hipotese, tipo, descricao")
        .single();

      if (error) return { error: error.message };
      return { sucesso: true, mensagem: `Hipótese registrada com sucesso!`, hipotese: data };
    }

    case "criar_aprendizado": {
      let id_semana = args.id_semana;

      if (!id_semana) {
        const { data: semana } = await supabaseAdmin
          .from("semana")
          .select("id_semana")
          .lte("data_inicio", new Date().toISOString().split("T")[0])
          .gte("data_fim", new Date().toISOString().split("T")[0])
          .single();

        if (semana) {
          id_semana = semana.id_semana;
        } else {
          const { data: ultimaSemana } = await supabaseAdmin
            .from("semana")
            .select("id_semana")
            .order("data_fim", { ascending: false })
            .limit(1)
            .single();
          id_semana = ultimaSemana?.id_semana;
        }
      }

      if (!id_semana) return { error: "Não foi possível determinar a semana atual" };

      const { data, error } = await supabaseAdmin
        .from("aprendizado_semana")
        .insert({
          id_empresa,
          id_semana,
          tipo: args.tipo,
          descricao: args.descricao,
          metricas_suporte: args.metricas_suporte || null,
        })
        .select("id_aprendizado, tipo, descricao")
        .single();

      if (error) return { error: error.message };
      return { sucesso: true, mensagem: `Aprendizado registrado com sucesso!`, aprendizado: data };
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

const SYSTEM_PROMPT = `Você é o Assistente IA do SGT (Sistema de Gestão de Tráfego). Você tem acesso completo aos dados do sistema e pode consultar métricas, campanhas, leads, criativos, demandas, alertas, concorrentes, hipóteses, aprendizados, funil de conversão, landing pages e métricas de Instagram.

CAPACIDADES DE LEITURA:
- Métricas consolidadas de empresas (leads, vendas, CPL, CAC, verba)
- Campanhas com performance agregada
- Leads com filtros avançados
- Criativos com métricas de performance
- Demandas de campanha pendentes e em andamento
- Resumo geral do mês atual
- Comparativo entre períodos (variação percentual)
- Alertas automáticos do sistema
- Anúncios de concorrentes detectados
- Hipóteses de teste e seus resultados
- Aprendizados semanais
- Métricas de Instagram orgânico
- Funil de conversão completo com taxas
- Lista de todas as empresas
- Performance de landing pages

CAPACIDADES DE ESCRITA:
- Criar demandas de campanha (briefings para o time de tráfego)
- Criar alertas manuais para a equipe
- Registrar hipóteses de teste
- Registrar aprendizados/insights semanais

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja proativo: ao identificar oportunidades ou problemas, sugira ações concretas
- Use dados reais para fundamentar todas as respostas
- Formate com Markdown: use tabelas, listas, negrito e emojis para facilitar a leitura
- Quando mostrar valores monetários, use formato BRL (R$ X.XXX,XX)
- Calcule e apresente métricas derivadas (CPL, CAC, ROAS, taxa de conversão) quando relevante
- Se os dados retornados estiverem vazios, informe de forma clara e sugira possíveis motivos

REGRAS DE ESCRITA (CRÍTICO):
- **NUNCA** execute ferramentas de escrita sem pedir confirmação explícita do usuário primeiro
- Antes de criar qualquer registro, apresente um resumo do que será criado e pergunte: "Posso registrar isso no sistema?"
- Ao sugerir demandas de campanha, inclua UTMs, verba e segmentação baseados nos dados históricos
- Marque demandas criadas pela IA com a flag sugerida_por_ia=true

Seja conciso mas completo nas análises.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, id_empresa, id_conversa } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get empresa name for context
    let empresaContext = "";
    if (id_empresa && id_empresa !== "todas") {
      const { data: emp } = await supabaseAdmin
        .from("empresa")
        .select("nome")
        .eq("id_empresa", id_empresa)
        .single();
      if (emp) empresaContext = `\n\nA empresa atualmente selecionada é: "${emp.nome}" (ID: ${id_empresa}). Use este ID nas consultas.`;
    }

    // Build Gemini request
    const geminiMessages = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + empresaContext }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido! Sou o assistente IA do SGT com acesso completo ao sistema. Posso consultar métricas, campanhas, leads, alertas, concorrentes, funil de conversão e muito mais. Também posso criar demandas, alertas, hipóteses e aprendizados mediante sua confirmação. Como posso ajudar?" }],
      },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const model = "gemini-3-pro-preview";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let geminiBody: any = {
      contents: geminiMessages,
      tools: [{ functionDeclarations: toolDeclarations }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    let finalResponse = "";
    let iterations = 0;
    const MAX_ITERATIONS = 8;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const geminiResp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (!geminiResp.ok) {
        const errText = await geminiResp.text();
        console.error("Gemini error:", geminiResp.status, errText);
        return new Response(JSON.stringify({ error: "Erro ao chamar IA", details: errText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const geminiData = await geminiResp.json();
      const candidate = geminiData.candidates?.[0];

      if (!candidate?.content?.parts) {
        finalResponse = "Desculpe, não consegui gerar uma resposta. Tente reformular sua pergunta.";
        break;
      }

      const parts = candidate.content.parts;
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCalls.length === 0) {
        finalResponse = textParts.map((p: any) => p.text).join("");
        break;
      }

      // Execute function calls (pass userId for write operations)
      const functionResponses: any[] = [];
      for (const fc of functionCalls) {
        const result = await executeTool(fc.functionCall.name, fc.functionCall.args || {}, user.id);
        functionResponses.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: { result: JSON.stringify(result) },
          },
        });
      }

      geminiBody.contents = [
        ...geminiBody.contents,
        { role: "model", parts },
        { role: "user", parts: functionResponses },
      ];
    }

    // Save assistant message
    if (id_conversa && finalResponse) {
      await supabaseAdmin.from("chat_mensagem").insert({
        id_conversa,
        role: "assistant",
        content: finalResponse,
      });
    }

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-ia-assistente error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
