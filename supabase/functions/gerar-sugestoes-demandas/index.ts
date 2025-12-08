import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_empresa, texto_produto, plataforma_alvo } = await req.json();

    if (!id_empresa) {
      return new Response(
        JSON.stringify({ error: "id_empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da empresa
    const { data: empresa, error: empresaError } = await supabase
      .from("empresa")
      .select("*")
      .eq("id_empresa", id_empresa)
      .single();

    if (empresaError) throw empresaError;

    // Buscar métricas dos últimos 30 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    const { data: metricasDiarias } = await supabase
      .from("empresa_metricas_dia")
      .select("*")
      .eq("id_empresa", id_empresa)
      .gte("data", dataInicioStr)
      .order("data", { ascending: false });

    // Buscar campanhas ativas com métricas
    const { data: contasAnuncio } = await supabase
      .from("conta_anuncio")
      .select("id_conta, nome, plataforma")
      .eq("id_empresa", id_empresa)
      .eq("ativa", true);

    const contaIds = contasAnuncio?.map(c => c.id_conta) || [];

    let campanhasAtivas: any[] = [];
    if (contaIds.length > 0) {
      const { data: campanhas } = await supabase
        .from("campanha")
        .select("id_campanha, nome, objetivo, id_conta")
        .in("id_conta", contaIds)
        .eq("ativa", true);
      campanhasAtivas = campanhas || [];
    }

    // Buscar criativos com melhor performance
    const { data: criativos } = await supabase
      .from("criativo")
      .select(`
        id_criativo,
        descricao,
        tipo,
        url_midia,
        url_preview,
        campanha:id_campanha (nome, objetivo)
      `)
      .eq("ativo", true)
      .limit(20);

    // Buscar métricas de criativos
    const criativoIds = criativos?.map(c => c.id_criativo) || [];
    let metricasCriativos: any[] = [];
    if (criativoIds.length > 0) {
      const { data: metricasC } = await supabase
        .from("criativo_metricas_dia")
        .select("*")
        .in("id_criativo", criativoIds)
        .gte("data", dataInicioStr);
      metricasCriativos = metricasC || [];
    }

    // Calcular performance por criativo
    const performanceCriativos = criativos?.map(criativo => {
      const metricas = metricasCriativos.filter(m => m.id_criativo === criativo.id_criativo);
      const totalLeads = metricas.reduce((acc, m) => acc + (m.leads || 0), 0);
      const totalVerba = metricas.reduce((acc, m) => acc + Number(m.verba_investida || 0), 0);
      const cpl = totalLeads > 0 ? totalVerba / totalLeads : null;
      const campanhaData = criativo.campanha as any;
      
      return {
        ...criativo,
        leads: totalLeads,
        verba: totalVerba,
        cpl,
        campanhaNome: campanhaData?.nome || null
      };
    }).filter(c => c.leads > 0).sort((a, b) => (a.cpl || 999) - (b.cpl || 999)) || [];

    // Calcular totais do período
    const totais = metricasDiarias?.reduce((acc, m) => ({
      verba: acc.verba + Number(m.verba_investida || 0),
      leads: acc.leads + (m.leads_pagos || 0),
      vendas: acc.vendas + (m.vendas || 0),
    }), { verba: 0, leads: 0, vendas: 0 }) || { verba: 0, leads: 0, vendas: 0 };

    const cplMedio = totais.leads > 0 ? totais.verba / totais.leads : empresa.cpl_maximo;

    // Construir contexto para a IA
    const contexto = {
      empresa: {
        nome: empresa.nome,
        cpl_maximo: empresa.cpl_maximo,
        cac_maximo: empresa.cac_maximo,
        ticket_medio_alvo: empresa.ticket_medio_alvo,
        meta_verba_mensal: empresa.meta_verba_mensal,
      },
      metricas_30_dias: {
        verba_investida: totais.verba,
        leads: totais.leads,
        vendas: totais.vendas,
        cpl_medio: cplMedio,
      },
      campanhas_ativas: campanhasAtivas.slice(0, 10).map(c => ({
        nome: c.nome,
        objetivo: c.objetivo,
        plataforma: contasAnuncio?.find(ca => ca.id_conta === c.id_conta)?.plataforma
      })),
      top_criativos: performanceCriativos.slice(0, 5).map(c => ({
        tipo: c.tipo,
        descricao: c.descricao,
        url_midia: c.url_midia || c.url_preview,
        leads: c.leads,
        cpl: c.cpl,
        campanha: c.campanhaNome
      })),
      plataformas_disponiveis: [...new Set(contasAnuncio?.map(c => c.plataforma) || [])],
    };

    console.log("[gerar-sugestoes-demandas] Contexto:", JSON.stringify(contexto, null, 2));
    console.log("[gerar-sugestoes-demandas] Texto produto:", texto_produto ? `${texto_produto.length} chars` : "não fornecido");
    console.log("[gerar-sugestoes-demandas] Plataforma alvo:", plataforma_alvo || "não especificada");

    // Prompt base do sistema
    let systemPrompt = `Você é um especialista em mídia paga com vasta experiência em Meta Ads e Google Ads.
Sua tarefa é analisar os dados de performance de uma empresa e sugerir 3-5 novas campanhas otimizadas.

REGRAS IMPORTANTES:
1. Cada sugestão deve ter TODOS os campos preenchidos - não deixe campos vazios
2. Use os criativos que já performaram bem quando disponíveis
3. Sugira verbas realistas baseadas no histórico da empresa
4. Gere UTMs padronizados (utm_source, utm_medium, utm_campaign, utm_content)
5. Priorize campanhas que podem melhorar o CPL atual
6. Inclua pelo menos uma sugestão de teste/experimento novo
7. Seja específico nos públicos-alvo e segmentações
8. Os resultados esperados devem ser realistas baseados nos dados

ESTRUTURA DA RESPOSTA:
Use a função sugerir_campanhas_completas para retornar as sugestões no formato estruturado.`;

    let userPrompt: string;

    // Se texto_produto for fornecido, usar prompt especializado
    if (texto_produto && texto_produto.trim().length > 0) {
      systemPrompt = `Você é um especialista em mídia paga com vasta experiência em Meta Ads e Google Ads.
Sua tarefa é analisar o TEXTO DO PRODUTO fornecido pelo usuário junto com os dados históricos da empresa e criar campanhas otimizadas.

REGRAS IMPORTANTES:
1. ANALISE O TEXTO DO PRODUTO em detalhes: identifique o produto/serviço, benefícios, público-alvo, tom de voz, diferenciais
2. Cada sugestão deve ter TODOS os campos preenchidos - não deixe campos vazios
3. Combine insights do texto com dados históricos de performance
4. Gere UTMs padronizados baseados no nome do produto/campanha
5. Os resultados esperados devem ser realistas baseados nos dados históricos
6. Inclua um resumo do que você entendeu do texto no campo "texto_produto_analisado"

${plataforma_alvo === "GOOGLE" ? `
REGRAS ESPECÍFICAS PARA GOOGLE ADS SEARCH:
1. Gere 20-30 palavras-chave organizadas por intenção de busca
2. Para cada palavra-chave, defina o match_type correto:
   - "exact" [exato]: para termos muito específicos e transacionais
   - "phrase" "frase": para termos com variações aceitáveis
   - "broad" ampla: para descoberta de novos termos
3. Sugira 10-15 palavras-chave negativas para evitar tráfego irrelevante
4. Organize em 3-5 grupos de anúncio temáticos
5. Para cada grupo, gere headlines (até 15, max 30 chars cada) e descriptions (até 4, max 90 chars cada) para RSA
6. Foque em intenções transacionais e informacionais de fundo de funil
` : `
REGRAS ESPECÍFICAS PARA META ADS:
1. Defina públicos-alvo detalhados com interesses e comportamentos
2. Sugira posicionamentos otimizados (Feed, Stories, Reels, etc.)
3. Inclua faixas etárias e gênero quando relevante
4. Sugira tipos de criativos (imagem, vídeo, carrossel) baseados no produto
`}

ESTRUTURA DA RESPOSTA:
Use a função sugerir_campanhas_completas para retornar as sugestões no formato estruturado.`;

      userPrompt = `TEXTO DO PRODUTO A ANALISAR:
"""
${texto_produto}
"""

DADOS HISTÓRICOS DA EMPRESA (últimos 30 dias):
${JSON.stringify(contexto, null, 2)}

PLATAFORMA ALVO: ${plataforma_alvo || "META"}

Considere:
- CPL máximo permitido: R$ ${empresa.cpl_maximo}
- CAC máximo permitido: R$ ${empresa.cac_maximo}
- CPL médio atual: R$ ${cplMedio.toFixed(2)}
- Verba mensal disponível: R$ ${empresa.meta_verba_mensal || "não definida"}

Analise o texto do produto, combine com os dados históricos e gere ${plataforma_alvo === "GOOGLE" ? "campanhas de Google Search com palavras-chave estruturadas" : "campanhas de Meta Ads com segmentação detalhada"}.`;

    } else {
      // Prompt original para geração baseada apenas na base
      userPrompt = `Analise os dados desta empresa e sugira 3-5 campanhas otimizadas:

${JSON.stringify(contexto, null, 2)}

Considere:
- CPL máximo permitido: R$ ${empresa.cpl_maximo}
- CAC máximo permitido: R$ ${empresa.cac_maximo}
- CPL médio atual: R$ ${cplMedio.toFixed(2)}
- Plataformas disponíveis: ${contexto.plataformas_disponiveis.join(", ") || "META, GOOGLE"}

Gere sugestões de campanhas completas com todos os campos preenchidos.`;
    }

    // Tool definition com campos extras para Google Ads estruturado
    const tools = [
      {
        type: "function",
        function: {
          name: "sugerir_campanhas_completas",
          description: "Retorna 3-5 sugestões de campanhas completas e prontas para execução",
          parameters: {
            type: "object",
            properties: {
              sugestoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string", description: "Nome da campanha sugerida" },
                    descricao: { type: "string", description: "Descrição do objetivo e estratégia" },
                    plataforma: { type: "string", enum: ["META", "GOOGLE"] },
                    prioridade: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
                    texto_produto_analisado: { type: "string", description: "Resumo do texto do produto analisado (apenas quando texto_produto foi fornecido)" },
                    meta_tipo_campanha: { type: "string", enum: ["CONVERSAO", "TRAFEGO", "LEAD_GEN", "AWARENESS", "ENGAJAMENTO"] },
                    meta_objetivo: { type: "string" },
                    meta_publico_alvo: { type: "string" },
                    meta_idade_min: { type: "number" },
                    meta_idade_max: { type: "number" },
                    meta_interesses: { type: "array", items: { type: "string" } },
                    meta_posicionamentos: { type: "array", items: { type: "string" } },
                    google_tipo_campanha: { type: "string", enum: ["SEARCH", "DISPLAY", "PERFORMANCE_MAX", "VIDEO", "SHOPPING"] },
                    google_palavras_chave: { type: "array", items: { type: "string" } },
                    google_palavras_chave_estruturadas: {
                      type: "array",
                      description: "Palavras-chave com match type e intenção para Google Search",
                      items: {
                        type: "object",
                        properties: {
                          termo: { type: "string" },
                          match_type: { type: "string", enum: ["exact", "phrase", "broad"] },
                          intencao: { type: "string", enum: ["transacional", "informacional", "navegacional"] }
                        },
                        required: ["termo", "match_type", "intencao"]
                      }
                    },
                    google_palavras_negativas: {
                      type: "array",
                      description: "Palavras-chave negativas para evitar tráfego irrelevante",
                      items: { type: "string" }
                    },
                    google_grupos_anuncio: {
                      type: "array",
                      description: "Grupos de anúncio com keywords, headlines e descriptions para RSA",
                      items: {
                        type: "object",
                        properties: {
                          nome: { type: "string" },
                          palavras_chave: { type: "array", items: { type: "string" } },
                          headlines: { type: "array", items: { type: "string" }, description: "Até 15 headlines de max 30 caracteres" },
                          descriptions: { type: "array", items: { type: "string" }, description: "Até 4 descriptions de max 90 caracteres" }
                        },
                        required: ["nome", "palavras_chave"]
                      }
                    },
                    verba_diaria: { type: "number" },
                    verba_total: { type: "number" },
                    duracao_dias: { type: "number" },
                    criativos: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          url_midia: { type: "string" },
                          tipo: { type: "string", enum: ["imagem", "video", "carrossel"] },
                          descricao: { type: "string" },
                          cta: { type: "string" }
                        }
                      }
                    },
                    landing_pages: { type: "array", items: { type: "string" } },
                    teste_ab_paginas: { type: "boolean" },
                    utm_source: { type: "string" },
                    utm_medium: { type: "string" },
                    utm_campaign: { type: "string" },
                    utm_content: { type: "string" },
                    justificativa: { type: "string", description: "Explicação de por que esta campanha é recomendada" },
                    resultados_esperados: {
                      type: "object",
                      properties: {
                        leads_estimados: { type: "number" },
                        cpl_estimado: { type: "number" },
                        roi_estimado: { type: "number" }
                      },
                      required: ["leads_estimados", "cpl_estimado", "roi_estimado"]
                    }
                  },
                  required: ["titulo", "descricao", "plataforma", "prioridade", "verba_diaria", "verba_total", "duracao_dias", "utm_source", "utm_medium", "utm_campaign", "justificativa", "resultados_esperados"]
                }
              }
            },
            required: ["sugestoes"]
          }
        }
      }
    ];

    // Chamar Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "sugerir_campanhas_completas" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[gerar-sugestoes-demandas] Erro na API:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("[gerar-sugestoes-demandas] Resposta da IA:", JSON.stringify(aiData, null, 2));

    // Extrair sugestões da resposta
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "sugerir_campanhas_completas") {
      throw new Error("Resposta inesperada da IA");
    }

    const resultado = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ sugestoes: resultado.sugestoes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[gerar-sugestoes-demandas] Erro:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
