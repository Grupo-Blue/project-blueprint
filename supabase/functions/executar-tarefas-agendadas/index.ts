import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Reading tools available for the executor (same as chat-ia-assistente)
const readingToolDeclarations = [
  {
    name: "buscar_metricas_empresa",
    description: "Busca métricas consolidadas de uma empresa.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        dias: { type: "number" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_campanhas",
    description: "Busca campanhas com métricas agregadas.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        ativas_apenas: { type: "boolean" },
        dias: { type: "number" },
        limite: { type: "number" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_leads",
    description: "Busca leads com filtros.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        dias: { type: "number" },
        com_venda: { type: "boolean" },
        limite: { type: "number" },
        telefone: { type: "string" },
        email: { type: "string" },
        nome: { type: "string" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_demandas",
    description: "Busca demandas de campanhas.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        status: { type: "string" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "resumo_geral",
    description: "Resumo consolidado da empresa no mês atual.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "comparar_periodos",
    description: "Compara métricas entre dois períodos.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        dias_periodo: { type: "number" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "buscar_alertas",
    description: "Busca alertas automáticos.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        severidade: { type: "string" },
        apenas_pendentes: { type: "boolean" },
        limite: { type: "number" },
      },
      required: ["id_empresa"],
    },
  },
  {
    name: "funil_conversao",
    description: "Calcula funil de conversão completo.",
    parameters: {
      type: "object",
      properties: {
        id_empresa: { type: "string" },
        dias: { type: "number" },
      },
      required: ["id_empresa"],
    },
  },
];

// Simplified tool executor (reading-only, reuses same logic as chat)
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
      return totais;
    }

    case "buscar_campanhas": {
      const dias = args.dias || 30;
      const limite = args.limite || 20;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);
      const { data: contas } = await supabaseAdmin.from("conta_anuncio").select("id_conta").eq("id_empresa", id_empresa);
      if (!contas?.length) return { campanhas: [] };
      const contaIds = contas.map((c: any) => c.id_conta);
      let query = supabaseAdmin.from("campanha").select("id_campanha, nome, ativa, tipo_funil, objetivo").in("id_conta", contaIds);
      if (args.ativas_apenas) query = query.eq("ativa", true);
      const { data: campanhas } = await query.limit(limite);
      if (!campanhas?.length) return { campanhas: [] };
      const campanhaIds = campanhas.map((c: any) => c.id_campanha);
      const { data: metricas } = await supabaseAdmin.from("campanha_metricas_dia").select("id_campanha, leads, cliques, impressoes, verba_investida").in("id_campanha", campanhaIds).gte("data", dataInicio.toISOString().split("T")[0]);
      const mp: Record<string, any> = {};
      (metricas || []).forEach((m: any) => {
        if (!mp[m.id_campanha]) mp[m.id_campanha] = { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        mp[m.id_campanha].leads += m.leads || 0;
        mp[m.id_campanha].cliques += m.cliques || 0;
        mp[m.id_campanha].impressoes += m.impressoes || 0;
        mp[m.id_campanha].verba += m.verba_investida || 0;
      });
      return campanhas.map((c: any) => {
        const m = mp[c.id_campanha] || { leads: 0, cliques: 0, impressoes: 0, verba: 0 };
        return { nome: c.nome, ativa: c.ativa, leads: m.leads, verba: m.verba, cpl: m.leads > 0 ? (m.verba / m.leads).toFixed(2) : null };
      });
    }

    case "buscar_leads": {
      const limite = args.limite || 50;
      let query = supabaseAdmin.from("lead").select("nome_lead, email, telefone, utm_source, utm_campaign, origem_canal, venda_realizada, valor_venda, data_criacao, stage_atual").eq("id_empresa", id_empresa).order("data_criacao", { ascending: false }).limit(limite);
      if (args.telefone) query = query.ilike("telefone", `%${args.telefone}%`);
      else if (args.email) query = query.ilike("email", `%${args.email}%`);
      else if (args.nome) query = query.ilike("nome_lead", `%${args.nome}%`);
      else {
        const dias = args.dias || 30;
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - dias);
        query = query.gte("data_criacao", dataInicio.toISOString().split("T")[0]);
      }
      if (args.com_venda === true) query = query.eq("venda_realizada", true);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { total: data?.length || 0, leads: data || [] };
    }

    case "buscar_demandas": {
      let query = supabaseAdmin.from("demanda_campanha").select("titulo, descricao, plataforma, status, prioridade, verba_total, created_at").eq("id_empresa", id_empresa).order("created_at", { ascending: false }).limit(20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return data || [];
    }

    case "resumo_geral": {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { data: metricas } = await supabaseAdmin.from("empresa_metricas_dia").select("leads_total, leads_pagos, vendas, valor_vendas, verba_investida").eq("id_empresa", id_empresa).gte("data", inicioMes);
      const t = (metricas || []).reduce((acc: any, d: any) => ({ leads: acc.leads + (d.leads_total || 0), vendas: acc.vendas + (d.vendas || 0), verba: acc.verba + (d.verba_investida || 0) }), { leads: 0, vendas: 0, verba: 0 });
      const { data: empresa } = await supabaseAdmin.from("empresa").select("nome, cpl_maximo, cac_maximo, meta_verba_mensal").eq("id_empresa", id_empresa).single();
      return { empresa: empresa?.nome, leads: t.leads, vendas: t.vendas, verba: t.verba, cpl: t.leads > 0 ? (t.verba / t.leads).toFixed(2) : null };
    }

    case "comparar_periodos": {
      const dias = args.dias_periodo || 30;
      const now = new Date();
      const inicioAtual = new Date(now); inicioAtual.setDate(inicioAtual.getDate() - dias);
      const inicioAnterior = new Date(inicioAtual); inicioAnterior.setDate(inicioAnterior.getDate() - dias);
      const agg = (rows: any[]) => rows.reduce((acc: any, d: any) => ({ leads: acc.leads + (d.leads_total || 0), vendas: acc.vendas + (d.vendas || 0), verba: acc.verba + (d.verba_investida || 0) }), { leads: 0, vendas: 0, verba: 0 });
      const { data: atual } = await supabaseAdmin.from("empresa_metricas_dia").select("leads_total, vendas, verba_investida").eq("id_empresa", id_empresa).gte("data", inicioAtual.toISOString().split("T")[0]);
      const { data: anterior } = await supabaseAdmin.from("empresa_metricas_dia").select("leads_total, vendas, verba_investida").eq("id_empresa", id_empresa).gte("data", inicioAnterior.toISOString().split("T")[0]).lt("data", inicioAtual.toISOString().split("T")[0]);
      return { atual: agg(atual || []), anterior: agg(anterior || []) };
    }

    case "buscar_alertas": {
      let query = supabaseAdmin.from("alerta_automatico").select("tipo, severidade, titulo, descricao, resolvido, created_at").eq("id_empresa", id_empresa).order("created_at", { ascending: false }).limit(args.limite || 20);
      if (args.severidade) query = query.eq("severidade", args.severidade);
      if (args.apenas_pendentes !== false) query = query.eq("resolvido", false);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { alertas: data || [] };
    }

    case "funil_conversao": {
      const dias = args.dias || 30;
      const dataInicio = new Date(); dataInicio.setDate(dataInicio.getDate() - dias);
      const { data, error } = await supabaseAdmin.from("empresa_metricas_dia").select("leads_total, leads_pagos, levantadas, mqls, reunioes, vendas").eq("id_empresa", id_empresa).gte("data", dataInicio.toISOString().split("T")[0]);
      if (error) return { error: error.message };
      const t = (data || []).reduce((acc: any, d: any) => ({ leads_total: acc.leads_total + (d.leads_total || 0), leads_pagos: acc.leads_pagos + (d.leads_pagos || 0), levantadas: acc.levantadas + (d.levantadas || 0), mqls: acc.mqls + (d.mqls || 0), reunioes: acc.reunioes + (d.reunioes || 0), vendas: acc.vendas + (d.vendas || 0) }), { leads_total: 0, leads_pagos: 0, levantadas: 0, mqls: 0, reunioes: 0, vendas: 0 });
      return t;
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

async function executarTarefa(tarefa: any): Promise<string> {
  // Get empresa context
  let empresaContext = "";
  if (tarefa.id_empresa) {
    const { data: emp } = await supabaseAdmin.from("empresa").select("nome").eq("id_empresa", tarefa.id_empresa).single();
    if (emp) empresaContext = `\nEmpresa: "${emp.nome}" (ID: ${tarefa.id_empresa}). Use este ID nas consultas.`;
  }

  const systemPrompt = `Você é o Assistente IA do SGT executando uma tarefa agendada. Analise os dados do sistema e forneça uma resposta completa e detalhada.${empresaContext}

A tarefa foi agendada pelo usuário e deve ser executada agora. Use as ferramentas disponíveis para buscar dados reais e fundamentar sua análise.

Responda em português brasileiro, com formatação Markdown clara, usando tabelas e métricas quando apropriado.`;

  const model = "gemini-3-pro-preview";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  let geminiBody: any = {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido, vou executar a tarefa agendada." }] },
      { role: "user", parts: [{ text: `Execute a seguinte análise agendada:\n\n${tarefa.instrucao}` }] },
    ],
    tools: [{ functionDeclarations: readingToolDeclarations }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
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
      throw new Error(`Gemini error: ${geminiResp.status} - ${errText}`);
    }

    const geminiData = await geminiResp.json();
    const candidate = geminiData.candidates?.[0];
    if (!candidate?.content?.parts) {
      finalResponse = "Não foi possível gerar a análise.";
      break;
    }

    const parts = candidate.content.parts;
    const functionCalls = parts.filter((p: any) => p.functionCall);
    const textParts = parts.filter((p: any) => p.text);

    if (functionCalls.length === 0) {
      finalResponse = textParts.map((p: any) => p.text).join("");
      break;
    }

    const functionResponses: any[] = [];
    for (const fc of functionCalls) {
      const result = await executeTool(fc.functionCall.name, fc.functionCall.args || {});
      functionResponses.push({
        functionResponse: { name: fc.functionCall.name, response: { result: JSON.stringify(result) } },
      });
    }

    geminiBody.contents = [
      ...geminiBody.contents,
      { role: "model", parts },
      { role: "user", parts: functionResponses },
    ];
  }

  return finalResponse;
}

async function enviarEmailResultado(tarefa: any, resultado: string) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.error("BREVO_API_KEY não configurada, pulando envio de email");
    return;
  }

  // Determine email destination
  let emailDestino = tarefa.email_destino;
  if (!emailDestino) {
    // Get user email from auth
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(tarefa.user_id);
    emailDestino = user?.email;
  }
  if (!emailDestino) {
    emailDestino = Deno.env.get("ALERT_EMAIL_TO");
  }
  if (!emailDestino) {
    console.error("Nenhum email de destino encontrado");
    return;
  }

  // Get empresa name
  let empresaNome = "";
  if (tarefa.id_empresa) {
    const { data: emp } = await supabaseAdmin.from("empresa").select("nome").eq("id_empresa", tarefa.id_empresa).single();
    empresaNome = emp?.nome || "";
  }

  // Convert markdown to simple HTML
  const resultadoHtml = resultado
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/#{3}\s(.*?)(?:<br>)/g, "<h3 style='color:#1f2937;margin:16px 0 8px'>$1</h3>")
    .replace(/#{2}\s(.*?)(?:<br>)/g, "<h2 style='color:#1f2937;margin:20px 0 10px'>$1</h2>")
    .replace(/#{1}\s(.*?)(?:<br>)/g, "<h1 style='color:#1f2937;margin:24px 0 12px'>$1</h1>");

  const dataExecucao = new Date(tarefa.data_execucao).toLocaleDateString("pt-BR");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);padding:24px;color:white;">
      <h1 style="margin:0;font-size:22px;">🤖 Resultado de Tarefa Agendada</h1>
      <p style="margin:8px 0 0;opacity:0.9;">SGT • ${dataExecucao}${empresaNome ? ` • ${empresaNome}` : ""}</p>
    </div>
    <div style="padding:24px;">
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-weight:600;color:#5b21b6;">📋 Instrução:</p>
        <p style="margin:8px 0 0;color:#374151;">${tarefa.instrucao}</p>
      </div>
      <div style="color:#374151;font-size:14px;line-height:1.7;">
        ${resultadoHtml}
      </div>
    </div>
    <div style="background-color:#f3f4f6;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
      <p style="margin:0;">Email automático do SGT (Sistema de Gestão de Tráfego)</p>
      <p style="margin:4px 0 0;">Blue Consult • ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>`;

  const toEmails = emailDestino.split(",").map((e: string) => ({ email: e.trim() }));

  const emailResponse = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SGT Alertas", email: "noreply@grupoblue.com.br" },
      to: toEmails,
      subject: `[SGT] Tarefa Agendada: ${tarefa.instrucao.slice(0, 60)}${tarefa.instrucao.length > 60 ? "..." : ""}`,
      htmlContent: html,
    }),
  });

  if (!emailResponse.ok) {
    const errorData = await emailResponse.text();
    console.error(`Erro ao enviar email via Brevo: ${emailResponse.status} - ${errorData}`);
  } else {
    console.log(`Email enviado com sucesso para ${emailDestino}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[executar-tarefas-agendadas] Iniciando...");

  try {
    // Fetch pending tasks where execution date has passed
    const { data: tarefas, error } = await supabaseAdmin
      .from("tarefa_agendada_ia")
      .select("*")
      .eq("status", "pendente")
      .lte("data_execucao", new Date().toISOString())
      .limit(10);

    if (error) throw error;

    if (!tarefas?.length) {
      console.log("[executar-tarefas-agendadas] Nenhuma tarefa pendente.");

      await supabaseAdmin.from("cronjob_execucao").insert({
        nome_cronjob: "executar-tarefas-agendadas",
        status: "sucesso",
        duracao_ms: Date.now() - startTime,
        detalhes_execucao: { tarefas_encontradas: 0 },
      });

      return new Response(JSON.stringify({ success: true, tarefas_executadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[executar-tarefas-agendadas] ${tarefas.length} tarefas para executar.`);

    let executadas = 0;
    let erros = 0;

    for (const tarefa of tarefas) {
      try {
        // Mark as executing
        await supabaseAdmin.from("tarefa_agendada_ia").update({ status: "executando" }).eq("id", tarefa.id);

        // Execute the analysis
        const resultado = await executarTarefa(tarefa);

        // Save result
        await supabaseAdmin.from("tarefa_agendada_ia").update({
          status: "concluida",
          resultado,
          executed_at: new Date().toISOString(),
        }).eq("id", tarefa.id);

        // Send email if requested
        if (tarefa.enviar_email) {
          await enviarEmailResultado(tarefa, resultado);
        }

        executadas++;
        console.log(`[executar-tarefas-agendadas] Tarefa ${tarefa.id} concluída.`);
      } catch (tarefaError: any) {
        console.error(`[executar-tarefas-agendadas] Erro na tarefa ${tarefa.id}:`, tarefaError);
        await supabaseAdmin.from("tarefa_agendada_ia").update({
          status: "erro",
          resultado: `Erro: ${tarefaError.message}`,
          executed_at: new Date().toISOString(),
        }).eq("id", tarefa.id);
        erros++;
      }
    }

    const duracao = Date.now() - startTime;
    await supabaseAdmin.from("cronjob_execucao").insert({
      nome_cronjob: "executar-tarefas-agendadas",
      status: erros > 0 ? (executadas > 0 ? "parcial" : "erro") : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { tarefas_encontradas: tarefas.length, executadas, erros },
    });

    return new Response(JSON.stringify({ success: true, tarefas_executadas: executadas, erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[executar-tarefas-agendadas] Erro geral:", error);

    await supabaseAdmin.from("cronjob_execucao").insert({
      nome_cronjob: "executar-tarefas-agendadas",
      status: "erro",
      mensagem_erro: error.message,
      duracao_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
