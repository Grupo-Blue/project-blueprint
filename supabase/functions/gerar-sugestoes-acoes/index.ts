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
    console.log("Iniciando geração de sugestões de ações via IA...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    // Buscar dados dos últimos 30 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    const dataLimiteStr = dataLimite.toISOString().split("T")[0];

    // Buscar empresas
    const { data: empresas, error: empresasError } = await supabase
      .from("empresa")
      .select("*");

    if (empresasError) throw empresasError;

    // Buscar alertas ativos (CPL e CAC acima da meta)
    const { data: semanaAtual } = await supabase
      .from("semana")
      .select("*")
      .order("ano", { ascending: false })
      .order("numero_semana", { ascending: false })
      .limit(1)
      .maybeSingle();

    let alertasAtivos: any[] = [];
    if (semanaAtual) {
      const { data: metricasSemanais } = await supabase
        .from("empresa_semana_metricas")
        .select(`
          *,
          empresa:id_empresa (nome, cpl_maximo, cac_maximo)
        `)
        .eq("id_semana", semanaAtual.id_semana);

      alertasAtivos = (metricasSemanais || [])
        .filter((m: any) => {
          const cplAcima = m.cpl && m.empresa?.cpl_maximo && m.cpl > m.empresa.cpl_maximo;
          const cacAcima = m.cac && m.empresa?.cac_maximo && m.cac > m.empresa.cac_maximo;
          return cplAcima || cacAcima;
        })
        .map((m: any) => ({
          empresa: m.empresa?.nome,
          cpl: m.cpl,
          cpl_maximo: m.empresa?.cpl_maximo,
          cac: m.cac,
          cac_maximo: m.empresa?.cac_maximo,
          leads: m.leads_total,
          verba: m.verba_investida,
          vendas: m.vendas,
        }));
    }

    // Buscar métricas de campanhas recentes (últimos 30 dias)
    const { data: metricasCampanhas } = await supabase
      .from("campanha_metricas_dia")
      .select(`
        *,
        campanha:id_campanha (
          nome,
          conta_anuncio:id_conta (
            nome,
            empresa:id_empresa (nome)
          )
        )
      `)
      .gte("data", dataLimiteStr)
      .order("data", { ascending: false })
      .limit(100);

    // Agrupar métricas por campanha
    const metricasAgrupadas: Record<string, any> = {};
    (metricasCampanhas || []).forEach((m: any) => {
      const campanhaId = m.campanha?.nome || "desconhecida";
      if (!metricasAgrupadas[campanhaId]) {
        metricasAgrupadas[campanhaId] = {
          nome: m.campanha?.nome,
          empresa: m.campanha?.conta_anuncio?.empresa?.nome,
          impressoes: 0,
          cliques: 0,
          verba: 0,
          leads: 0,
        };
      }
      metricasAgrupadas[campanhaId].impressoes += m.impressoes || 0;
      metricasAgrupadas[campanhaId].cliques += m.cliques || 0;
      metricasAgrupadas[campanhaId].verba += parseFloat(m.verba_investida || 0);
      metricasAgrupadas[campanhaId].leads += m.leads || 0;
    });

    const campanhasFormatadas = Object.values(metricasAgrupadas)
      .map((c: any) => ({
        ...c,
        ctr: c.impressoes > 0 ? ((c.cliques / c.impressoes) * 100).toFixed(2) : 0,
        cpl: c.leads > 0 ? (c.verba / c.leads).toFixed(2) : 0,
      }))
      .slice(0, 15); // Top 15 campanhas

    // Buscar criativos com melhor desempenho (últimos 30 dias)
    const { data: metricasCriativos } = await supabase
      .from("criativo_metricas_dia")
      .select(`
        *,
        criativo:id_criativo (
          descricao,
          tipo,
          campanha:id_campanha (
            nome,
            conta_anuncio:id_conta (
              empresa:id_empresa (nome)
            )
          )
        )
      `)
      .gte("data", dataLimiteStr);

    // Agrupar criativos
    const criativosAgrupados: Record<string, any> = {};
    (metricasCriativos || []).forEach((m: any) => {
      const criativoId = m.criativo?.descricao || m.id_criativo;
      if (!criativosAgrupados[criativoId]) {
        criativosAgrupados[criativoId] = {
          descricao: m.criativo?.descricao,
          tipo: m.criativo?.tipo,
          empresa: m.criativo?.campanha?.conta_anuncio?.empresa?.nome,
          campanha: m.criativo?.campanha?.nome,
          impressoes: 0,
          cliques: 0,
          verba: 0,
          leads: 0,
        };
      }
      criativosAgrupados[criativoId].impressoes += m.impressoes || 0;
      criativosAgrupados[criativoId].cliques += m.cliques || 0;
      criativosAgrupados[criativoId].verba += parseFloat(m.verba_investida || 0);
      criativosAgrupados[criativoId].leads += m.leads || 0;
    });

    const criativosFormatados = Object.values(criativosAgrupados)
      .map((c: any) => ({
        ...c,
        ctr: c.impressoes > 0 ? ((c.cliques / c.impressoes) * 100).toFixed(2) : 0,
        cpl: c.leads > 0 ? (c.verba / c.leads).toFixed(2) : 0,
      }))
      .sort((a: any, b: any) => b.leads - a.leads)
      .slice(0, 10); // Top 10 criativos

    // Construir contexto para IA
    const contexto = {
      data_analise: new Date().toISOString().split("T")[0],
      periodo: "Últimos 30 dias",
      empresas: empresas?.map(e => ({
        nome: e.nome,
        cpl_maximo: e.cpl_maximo,
        cac_maximo: e.cac_maximo,
        ticket_medio_alvo: e.ticket_medio_alvo,
      })),
      alertas_ativos: alertasAtivos,
      campanhas_recentes: campanhasFormatadas,
      criativos_destaque: criativosFormatados,
    };

    console.log("Contexto preparado:", JSON.stringify(contexto, null, 2));

    // Chamar Lovable AI para análise
    const prompt = `Você é um especialista em marketing digital e gestão de tráfego pago. Analise os dados fornecidos e sugira ações concretas usando a metodologia A/B/C:

**CATEGORIA A** (Execução livre - baixo impacto):
- Ajustes de orçamento até 20%
- Testes de novos criativos
- Pausar/reativar anúncios
- Ajustar lances

**CATEGORIA B** (Comunicar - médio impacto):
- Ajustes de orçamento até 30%
- Criar novas campanhas de teste
- Testar novos funis
- Alterar copy de anúncios
- Testar novos públicos

**CATEGORIA C** (Aprovação obrigatória - alto impacto):
- Escalar campanha (>30%)
- Pausar campanhas principais
- Trocar objetivo da campanha
- Mudança estratégica completa
- Investimento acima do orçamento

**DADOS PARA ANÁLISE:**
${JSON.stringify(contexto, null, 2)}

**INSTRUÇÕES:**
1. Analise alertas ativos (CPL/CAC acima da meta)
2. Identifique tendências nas campanhas e criativos
3. Sugira 3-5 ações específicas e práticas
4. Para cada ação, especifique:
   - Categoria (A, B ou C)
   - Tipo de ação (escolha um dos tipos predefinidos acima)
   - Empresa afetada
   - Descrição clara e objetiva (máx 150 palavras)
   - Impacto esperado (quantificado quando possível)
   - Prioridade (Alta, Média, Baixa)

**IMPORTANTE:**
- Seja específico com números e métricas
- Mencione campanhas/criativos específicos quando relevante
- Justifique cada sugestão com dados
- Priorize ações que resolvam alertas ativos

Retorne as sugestões em formato JSON:
{
  "sugestoes": [
    {
      "categoria": "A|B|C",
      "tipo_acao": "string",
      "empresa": "string",
      "descricao": "string",
      "impacto_esperado": "string",
      "prioridade": "Alta|Média|Baixa"
    }
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em marketing digital. Responda SEMPRE em JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na API Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API Lovable AI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("IA não retornou conteúdo");
    }

    // Extrair JSON da resposta (pode vir com markdown)
    let sugestoesJSON;
    try {
      // Tentar extrair JSON de markdown code block
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        sugestoesJSON = JSON.parse(jsonMatch[1]);
      } else {
        sugestoesJSON = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error("Erro ao parsear resposta da IA:", aiContent);
      throw new Error("IA retornou resposta em formato inválido");
    }

    console.log("Sugestões geradas:", sugestoesJSON);

    return new Response(
      JSON.stringify({
        success: true,
        sugestoes: sugestoesJSON.sugestoes || [],
        contexto_analise: {
          total_alertas: alertasAtivos.length,
          total_campanhas_analisadas: campanhasFormatadas.length,
          total_criativos_analisados: criativosFormatados.length,
          periodo: contexto.periodo,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar sugestões:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
