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

    // Buscar dados da empresa
    const { data: empresa, error: empresaError } = await supabase
      .from("empresa")
      .select("*")
      .eq("id_empresa", id_empresa)
      .single();

    if (empresaError) throw empresaError;

    // Buscar métricas das últimas 8 semanas
    const { data: semanas } = await supabase
      .from("semana")
      .select("id_semana")
      .order("ano", { ascending: false })
      .order("numero_semana", { ascending: false })
      .limit(8);

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
          verba_investida,
          id_semana
        )
      `)
      .in("id_conta", contaIds)
      .eq("ativa", true)
      .limit(15);

    // Buscar aprendizados anteriores desta empresa
    const { data: aprendizadosAnteriores } = await supabase
      .from("aprendizado_semana")
      .select("tipo, descricao, metricas_suporte")
      .eq("id_empresa", id_empresa)
      .order("created_at", { ascending: false })
      .limit(10);

    // Buscar criativos com melhor performance
    const { data: criativosTop } = await supabase
      .from("criativo")
      .select(`
        id_criativo,
        descricao,
        tipo,
        criativo_metricas_dia!inner(
          leads,
          verba_investida
        )
      `)
      .in("id_campanha", campanhas?.map(c => c.id_campanha) || [])
      .eq("ativo", true)
      .limit(10);

    // Montar contexto para a IA
    const contexto = {
      empresa: {
        nome: empresa.nome,
        cpl_maximo: empresa.cpl_maximo,
        cac_maximo: empresa.cac_maximo,
        ticket_medio_alvo: empresa.ticket_medio_alvo,
        meta_conversao_lead_venda: empresa.meta_conversao_lead_venda,
      },
      metricas_ultimas_semanas: metricasSemanais?.map((m: any) => ({
        leads: m.leads_total,
        mqls: m.mqls,
        cpl: m.cpl,
        cac: m.cac,
        vendas: m.vendas,
        verba_investida: m.verba_investida,
        ticket_medio: m.ticket_medio,
      })),
      campanhas_ativas: campanhas?.slice(0, 10).map((c: any) => ({
        nome: c.nome,
        metricas_recentes: c.campanha_semana_metricas?.slice(0, 3),
      })),
      aprendizados_anteriores: aprendizadosAnteriores?.slice(0, 5),
      criativos_destaque: criativosTop?.slice(0, 5),
    };

    const prompt = `Você é um especialista em marketing digital e análise de campanhas de tráfego pago. 

Com base nos dados históricos abaixo, sugira 3-5 aprendizados relevantes que esta empresa deveria documentar:

EMPRESA: ${contexto.empresa.nome}
- CPL Máximo Desejado: R$ ${contexto.empresa.cpl_maximo}
- CAC Máximo Desejado: R$ ${contexto.empresa.cac_maximo}
- Ticket Médio Alvo: R$ ${contexto.empresa.ticket_medio_alvo}
- Meta de Conversão Lead → Venda: ${contexto.empresa.meta_conversao_lead_venda}%

MÉTRICAS DAS ÚLTIMAS SEMANAS:
${JSON.stringify(contexto.metricas_ultimas_semanas, null, 2)}

CAMPANHAS ATIVAS (TOP 10):
${JSON.stringify(contexto.campanhas_ativas, null, 2)}

APRENDIZADOS ANTERIORES (PARA REFERÊNCIA):
${JSON.stringify(contexto.aprendizados_anteriores, null, 2)}

CRIATIVOS COM DESTAQUE:
${JSON.stringify(contexto.criativos_destaque, null, 2)}

Para cada aprendizado sugerido, forneça:
1. tipo: categoria do aprendizado ("CRIATIVO", "PUBLICO", "OFERTA", "FUNIL", ou "OUTRO")
2. descricao: descrição clara do aprendizado identificado nos dados
3. metricas_suporte: métricas específicas que suportam este aprendizado (ex: "CPL caiu de R$50 para R$35")

Foque em aprendizados que:
- Identifiquem padrões de sucesso ou fracasso nas métricas
- Destaquem mudanças significativas no desempenho
- Sejam acionáveis e relevantes para futuras decisões
- Sejam específicos e baseados em dados reais apresentados
- Evitem repetir aprendizados anteriores já documentados`;

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
            content: "Você é um especialista em marketing digital focado em análise de dados e extração de insights de campanhas.",
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
              name: "sugerir_aprendizados",
              description: "Retorna sugestões de aprendizados baseados em dados históricos",
              parameters: {
                type: "object",
                properties: {
                  aprendizados: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string", enum: ["CRIATIVO", "PUBLICO", "OFERTA", "FUNIL", "OUTRO"] },
                        descricao: { type: "string" },
                        metricas_suporte: { type: "string" },
                      },
                      required: ["tipo", "descricao", "metricas_suporte"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["aprendizados"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_aprendizados" } },
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

    const aprendizados = JSON.parse(toolCall.function.arguments).aprendizados;

    return new Response(
      JSON.stringify({ success: true, aprendizados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro em gerar-sugestoes-aprendizados:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao gerar sugestões" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
