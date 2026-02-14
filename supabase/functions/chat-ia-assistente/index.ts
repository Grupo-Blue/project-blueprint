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
  {
    name: "buscar_metricas_empresa",
    description:
      "Busca métricas consolidadas de uma empresa: leads, vendas, CPL, CAC, verba investida, ticket médio. Use para responder sobre performance geral.",
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
    description:
      "Busca campanhas com métricas agregadas (leads, verba, cliques, impressões). Pode filtrar por ativas, plataforma e ordenação.",
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
    description:
      "Busca leads com filtros. Pode filtrar por período, se converteu em venda, canal de origem, etc.",
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
    description:
      "Busca criativos (anúncios) com métricas de performance: leads, cliques, impressões, verba, CPL.",
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
    description:
      "Busca demandas/tarefas de campanhas de tráfego. Permite ver o que está pendente, em andamento ou concluído.",
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
    description:
      "Gera um resumo rápido e consolidado da empresa: total de leads, vendas, verba, CPL médio e campanhas ativas no mês atual.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string", description: "UUID da empresa" },
      },
      required: ["id_empresa"],
    },
  },
];

// Tool execution functions
async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const id_empresa = args.id_empresa;

  switch (name) {
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

      // Aggregate
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

      // Get contas for this empresa
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

      // Get metrics for each campaign
      const campanhaIds = campanhas.map((c: any) => c.id_campanha);
      const { data: metricas } = await supabaseAdmin
        .from("campanha_metricas_dia")
        .select("id_campanha, leads, cliques, impressoes, verba_investida")
        .in("id_campanha", campanhaIds)
        .gte("data", dataInicio.toISOString().split("T")[0]);

      // Aggregate per campaign
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
        .select("nome, email, telefone, utm_source, utm_medium, utm_campaign, canal, venda, valor_venda, data_criacao, etapa_funil")
        .eq("id_empresa", id_empresa)
        .gte("data_criacao", dataInicio.toISOString().split("T")[0])
        .order("data_criacao", { ascending: false })
        .limit(limite);

      if (args.com_venda === true) query = query.eq("venda", true);
      if (args.com_venda === false) query = query.eq("venda", false);

      const { data, error } = await query;
      if (error) return { error: error.message };

      return {
        total: data?.length || 0,
        leads: data || [],
      };
    }

    case "buscar_criativos": {
      const dias = args.dias || 30;
      const limite = args.limite || 15;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      // Get contas for empresa
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

      // Get empresa info
      const { data: empresa } = await supabaseAdmin
        .from("empresa")
        .select("nome, cpl_maximo, cac_maximo, meta_verba_mensal")
        .eq("id_empresa", id_empresa)
        .single();

      // Count active campaigns
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

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

const SYSTEM_PROMPT = `Você é o Assistente IA do SGT (Sistema de Gestão de Tráfego). Você tem acesso completo aos dados do sistema e pode consultar métricas, campanhas, leads, criativos e demandas de campanha.

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja proativo: ao identificar oportunidades ou problemas, sugira ações concretas
- Use dados reais para fundamentar todas as respostas
- Formate com Markdown: use tabelas, listas, negrito e emojis para facilitar a leitura
- Quando sugerir uma campanha ou ação, ofereça: "Se aprovar, posso registrar essa demanda no sistema"
- Seja conciso mas completo nas análises
- Quando mostrar valores monetários, use formato BRL (R$ X.XXX,XX)
- Calcule e apresente métricas derivadas (CPL, CAC, ROAS, taxa de conversão) quando relevante
- Se os dados retornados estiverem vazios, informe de forma clara e sugira possíveis motivos`;

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
        parts: [{ text: "Entendido! Sou o assistente IA do SGT. Estou pronto para ajudar com análises, sugestões e consultas aos dados do sistema. Como posso ajudar?" }],
      },
      ...messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    // Use gemini-2.5-pro (stable) — gemini-3-pro-preview when available
    const model = "gemini-2.5-pro";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // First call - may need tool calling
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
    const MAX_ITERATIONS = 5;

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

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCalls.length === 0) {
        // No function calls, we have the final text
        finalResponse = textParts.map((p: any) => p.text).join("");
        break;
      }

      // Execute function calls
      const functionResponses: any[] = [];
      for (const fc of functionCalls) {
        const result = await executeTool(fc.functionCall.name, fc.functionCall.args || {});
        functionResponses.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: { result: JSON.stringify(result) },
          },
        });
      }

      // Add model's response and function results back to conversation
      geminiBody.contents = [
        ...geminiBody.contents,
        { role: "model", parts },
        { role: "user", parts: functionResponses },
      ];
    }

    // Save assistant message if we have a conversation ID
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
