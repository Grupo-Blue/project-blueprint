import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { id_empresa } = await req.json();
    if (!id_empresa) throw new Error("id_empresa é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const endDate = now.toISOString().split("T")[0];
    const startDate7 = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
    const startDate14 = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];

    // Fetch last 7 days metrics
    const { data: current } = await supabase
      .from("empresa_metricas_dia")
      .select("*")
      .eq("id_empresa", id_empresa)
      .eq("tipo_negocio", "total")
      .gte("data", startDate7)
      .lte("data", endDate)
      .order("data");

    // Fetch previous 7 days
    const { data: previous } = await supabase
      .from("empresa_metricas_dia")
      .select("*")
      .eq("id_empresa", id_empresa)
      .eq("tipo_negocio", "total")
      .gte("data", startDate14)
      .lt("data", startDate7)
      .order("data");

    // Fetch lead stats
    const { count: leadsNovos } = await supabase
      .from("lead")
      .select("*", { count: "exact", head: true })
      .eq("id_empresa", id_empresa)
      .gte("data_criacao", startDate7);

    const { count: leadsSemDono } = await supabase
      .from("lead")
      .select("*", { count: "exact", head: true })
      .eq("id_empresa", id_empresa)
      .is("proprietario_nome", null)
      .gte("data_criacao", startDate7);

    const sum = (arr: any[], field: string) =>
      arr?.reduce((acc, r) => acc + (Number(r[field]) || 0), 0) || 0;

    const avg = (arr: any[], field: string) => {
      const vals = arr?.filter((r) => r[field] != null) || [];
      return vals.length ? sum(vals, field) / vals.length : 0;
    };

    const metricsContext = `
Métricas dos últimos 7 dias (${startDate7} a ${endDate}):
- Leads total: ${sum(current, "leads_total")}
- Vendas: ${sum(current, "vendas")}
- Receita: R$ ${sum(current, "valor_vendas").toFixed(2)}
- CPL médio: R$ ${avg(current, "cpl").toFixed(2)}
- CAC médio: R$ ${avg(current, "cac").toFixed(2)}
- Verba investida: R$ ${sum(current, "verba_investida").toFixed(2)}
- Leads novos (tabela lead): ${leadsNovos || 0}
- Leads sem proprietário: ${leadsSemDono || 0}

Métricas dos 7 dias anteriores (${startDate14} a ${startDate7}):
- Leads total: ${sum(previous, "leads_total")}
- Vendas: ${sum(previous, "vendas")}
- Receita: R$ ${sum(previous, "valor_vendas").toFixed(2)}
- CPL médio: R$ ${avg(previous, "cpl").toFixed(2)}
- CAC médio: R$ ${avg(previous, "cac").toFixed(2)}
- Verba investida: R$ ${sum(previous, "verba_investida").toFixed(2)}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista comercial sênior. Analise as métricas comparando os dois períodos e gere de 3 a 5 insights acionáveis em bullet points concisos em português. 
Foque em:
1. Variações significativas (positivas e negativas)
2. Eficiência de investimento (CPL, CAC)
3. Problemas operacionais (leads sem dono, SLA)
4. Sugestões práticas de melhoria

Retorne APENAS os bullet points, sem introdução ou conclusão. Use emojis para categorizar:
📈 para melhorias
📉 para quedas
⚠️ para alertas
💡 para sugestões`,
          },
          { role: "user", content: metricsContext },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erro ao gerar insights via IA");
    }

    const aiData = await aiResponse.json();
    const insights = aiData.choices?.[0]?.message?.content || "Sem insights disponíveis.";

    return new Response(JSON.stringify({ insights, periodo: { inicio: startDate7, fim: endDate } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
