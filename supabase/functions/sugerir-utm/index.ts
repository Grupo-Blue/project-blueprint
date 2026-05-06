import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { id_empresa, url, descricao } = body ?? {};

    if (!id_empresa || typeof id_empresa !== "string") {
      return json({ error: "id_empresa é obrigatório" }, 400);
    }
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 3) {
      return json({ error: "Descreva o link com mais detalhes" }, 400);
    }

    // Histórico de UTMs da empresa (RLS já isola)
    const { data: historico } = await supabase
      .from("utm_link")
      .select("nome_interno,url_base,utm_source,utm_medium,utm_campaign,utm_content,utm_term,canal")
      .eq("id_empresa", id_empresa)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(100);

    const distintos = (campo: string) =>
      Array.from(
        new Set(
          (historico ?? [])
            .map((h: any) => h[campo])
            .filter((v: any) => typeof v === "string" && v.trim() !== "")
        )
      );

    const contexto = {
      sources: distintos("utm_source"),
      mediums: distintos("utm_medium"),
      campaigns: distintos("utm_campaign"),
      contents: distintos("utm_content"),
      terms: distintos("utm_term"),
      canais: distintos("canal"),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const systemPrompt = `Você é um especialista em UTM tracking. A partir de uma URL e descrição livre do usuário, sugira valores em snake_case para os campos UTM.

REGRAS:
- Use SEMPRE snake_case (ex: lancamento_abril, banner_topo).
- REUTILIZE valores do histórico da empresa quando fizer sentido (mesma campanha, mesmo canal). Só invente novos quando claramente diferente.
- canal: meta, google, organico, email, whatsapp ou outro.
- utm_source: facebook, google, instagram, newsletter, whatsapp, etc.
- utm_medium: cpc (ads pagas), social (orgânico), email, whatsapp, etc.
- utm_campaign: nome da campanha em snake_case.
- utm_content: variação do criativo (opcional).
- utm_term: palavra-chave (opcional).
- nome_interno: nome legível (PT-BR) para identificar o link.

HISTÓRICO DA EMPRESA (reutilize quando aplicável):
${JSON.stringify(contexto, null, 2)}`;

    const userPrompt = `URL: ${url || "(não informada)"}\n\nDescrição do link:\n${descricao}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_utm",
              description: "Retorna sugestão de campos UTM",
              parameters: {
                type: "object",
                properties: {
                  url_base: { type: "string", description: "URL limpa (sem UTMs)" },
                  canal: { type: "string", enum: ["meta", "google", "organico", "email", "whatsapp", "outro"] },
                  utm_source: { type: "string" },
                  utm_medium: { type: "string" },
                  utm_campaign: { type: "string" },
                  utm_content: { type: "string" },
                  utm_term: { type: "string" },
                  nome_interno: { type: "string" },
                  observacoes: { type: "string" },
                  reaproveitados: {
                    type: "object",
                    description: "Quais campos foram tirados do histórico",
                    properties: {
                      utm_source: { type: "boolean" },
                      utm_medium: { type: "boolean" },
                      utm_campaign: { type: "boolean" },
                      utm_content: { type: "boolean" },
                      utm_term: { type: "boolean" },
                      canal: { type: "boolean" },
                    },
                  },
                },
                required: ["canal", "utm_source", "utm_medium", "utm_campaign", "nome_interno"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_utm" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Limite de IA atingido. Tente novamente em instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return json({ error: "Falha na IA" }, 500);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "IA não retornou sugestão" }, 500);

    const sugestao = JSON.parse(toolCall.function.arguments);
    return json({ sugestao });
  } catch (e) {
    console.error("sugerir-utm error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
