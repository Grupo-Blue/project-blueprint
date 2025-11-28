import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      return new Response(
        JSON.stringify({ error: "id_empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da empresa e métricas recentes
    const { data: empresa, error: empresaError } = await supabase
      .from("empresa")
      .select("*")
      .eq("id_empresa", id_empresa)
      .single();

    if (empresaError) throw empresaError;

    // Buscar métricas das últimas 4 semanas
    const { data: semanas } = await supabase
      .from("semana")
      .select("id_semana")
      .order("ano", { ascending: false })
      .order("numero_semana", { ascending: false })
      .limit(4);

    const semanaIds = semanas?.map((s) => s.id_semana) || [];

    // Buscar métricas semanais da empresa
    const { data: metricasSemanais } = await supabase
      .from("empresa_semana_metricas")
      .select("*")
      .eq("id_empresa", id_empresa)
      .in("id_semana", semanaIds)
      .order("id_semana", { ascending: false });

    // Buscar campanhas ativas da empresa
    const { data: contas } = await supabase
      .from("conta_anuncio")
      .select("id_conta")
      .eq("id_empresa", id_empresa)
      .eq("ativa", true);

    const contaIds = contas?.map((c) => c.id_conta) || [];

    const { data: campanhas } = await supabase
      .from("campanha")
      .select(`
        id_campanha,
        nome,
        campanha_semana_metricas!inner(
          leads,
          cpl,
          mqls,
          vendas,
          verba_investida
        )
      `)
      .in("id_conta", contaIds)
      .eq("ativa", true)
      .limit(10);

    // Buscar alertas ativos (campanhas com menos de 2 criativos)
    const { data: alertasCriativos } = await supabase
      .from("campanha")
      .select(`
        nome,
        criativo!inner(id_criativo, ativo)
      `)
      .in("id_conta", contaIds)
      .eq("ativa", true);

    const campanhasComPoucosCriativos = alertasCriativos
      ?.map((camp: any) => ({
        nome: camp.nome,
        criativos_ativos: camp.criativo?.filter((c: any) => c.ativo).length || 0,
      }))
      .filter((c) => c.criativos_ativos < 2) || [];

    // Montar contexto para a IA
    const contexto = {
      empresa: {
        nome: empresa.nome,
        cpl_maximo: empresa.cpl_maximo,
        cac_maximo: empresa.cac_maximo,
        ticket_medio_alvo: empresa.ticket_medio_alvo,
      },
      metricas_ultimas_semanas: metricasSemanais?.map((m: any) => ({
        leads: m.leads_total,
        mqls: m.mqls,
        cpl: m.cpl,
        cac: m.cac,
        vendas: m.vendas,
        verba_investida: m.verba_investida,
      })),
      campanhas_ativas: campanhas?.slice(0, 5).map((c: any) => ({
        nome: c.nome,
        metricas: c.campanha_semana_metricas?.[0],
      })),
      alertas: {
        campanhas_com_poucos_criativos: campanhasComPoucosCriativos,
      },
    };

    const prompt = `Você é um especialista em marketing digital e análise de campanhas de tráfego pago. 

Com base nos dados abaixo, sugira 3-5 hipóteses de teste relevantes para melhorar o desempenho das campanhas:

EMPRESA: ${contexto.empresa.nome}
- CPL Máximo Desejado: R$ ${contexto.empresa.cpl_maximo}
- CAC Máximo Desejado: R$ ${contexto.empresa.cac_maximo}
- Ticket Médio Alvo: R$ ${contexto.empresa.ticket_medio_alvo}

MÉTRICAS RECENTES:
${JSON.stringify(contexto.metricas_ultimas_semanas, null, 2)}

CAMPANHAS ATIVAS (TOP 5):
${JSON.stringify(contexto.campanhas_ativas, null, 2)}

ALERTAS:
- ${contexto.alertas.campanhas_com_poucos_criativos.length} campanhas com menos de 2 criativos ativos

Para cada hipótese, forneça:
1. tipo: categoria do teste (ex: "Criativo", "Público", "Copy", "Segmentação", "Oferta")
2. descricao: descrição clara e acionável da hipótese
3. criterio_sucesso: como medir o sucesso (métrica específica e meta)
4. prioridade: "alta", "media" ou "baixa" baseado no impacto potencial

Foque em hipóteses que:
- Abordem problemas identificados nos alertas
- Otimizem métricas que estão fora da meta
- Testem variações que podem melhorar conversão
- Sejam específicas, mensuráveis e acionáveis`;

    // Chamar Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em marketing digital focado em otimização de campanhas de tráfego pago.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_hipoteses",
              description: "Retorna sugestões de hipóteses de teste para campanhas",
              parameters: {
                type: "object",
                properties: {
                  hipoteses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string" },
                        descricao: { type: "string" },
                        criterio_sucesso: { type: "string" },
                        prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
                      },
                      required: ["tipo", "descricao", "criterio_sucesso", "prioridade"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["hipoteses"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_hipoteses" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erro da API:", response.status, errorText);
      throw new Error(`Erro ao chamar API de IA: ${response.status}`);
    }

    const data = await response.json();
    console.log("Resposta da IA:", JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("IA não retornou sugestões estruturadas");
    }

    const hipoteses = JSON.parse(toolCall.function.arguments).hipoteses;

    return new Response(
      JSON.stringify({ success: true, hipoteses }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro em gerar-sugestoes-hipoteses:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao gerar sugestões" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
