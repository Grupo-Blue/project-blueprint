import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function processarEmpresa(supabase: any, lovableApiKey: string, id_empresa: string) {
  console.log(`Processando empresa: ${id_empresa}`);

  // Calcular data de ontem e 30 dias atrás
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);

  const inicio30Dias = new Date(ontem);
  inicio30Dias.setDate(ontem.getDate() - 29);
  inicio30Dias.setHours(0, 0, 0, 0);

  const dataAnalise = new Date().toISOString().split("T")[0];

  // Verificar se já existe análise para hoje
  const { data: analiseExistente } = await supabase
    .from("analise_inteligencia")
    .select("*")
    .eq("id_empresa", id_empresa)
    .eq("data_analise", dataAnalise)
    .maybeSingle();

  if (analiseExistente) {
    console.log(`Análise já existe para empresa ${id_empresa} na data ${dataAnalise}`);
    return { id_empresa, status: "already_exists", data: analiseExistente };
  }

  // Buscar leads dos últimos 30 dias da empresa
  const { data: leads, error: leadsError } = await supabase
    .from("lead")
    .select("*, criativo(*)")
    .eq("id_empresa", id_empresa)
    .gte("data_criacao", inicio30Dias.toISOString())
    .lte("data_criacao", ontem.toISOString());

  if (leadsError) throw leadsError;

  // Buscar contas de anúncio da empresa
  const { data: contas, error: contasError } = await supabase
    .from("conta_anuncio")
    .select("id_conta")
    .eq("id_empresa", id_empresa);
  
  if (contasError) throw contasError;
  
  const contasIds = contas?.map((c: any) => c.id_conta) || [];
  
  // Buscar campanhas das contas da empresa
  const { data: campanhas, error: campanhasError } = await supabase
    .from("campanha")
    .select("id_campanha")
    .in("id_conta", contasIds);
  
  if (campanhasError) throw campanhasError;
  
  const campanhasIds = campanhas?.map((c: any) => c.id_campanha) || [];

  // Buscar métricas de campanhas dos últimos 30 dias
  const { data: metricasDia, error: metricasError } = await supabase
    .from("campanha_metricas_dia")
    .select("*, campanha(*)")
    .in("id_campanha", campanhasIds)
    .gte("data", inicio30Dias.toISOString().split("T")[0])
    .lte("data", ontem.toISOString().split("T")[0]);

  if (metricasError) throw metricasError;

  // Buscar métricas semanais recentes da empresa
  const { data: metricasSemanais, error: semanaisError } = await supabase
    .from("empresa_semana_metricas")
    .select("*, semana(*)")
    .eq("id_empresa", id_empresa)
    .order("created_at", { ascending: false })
    .limit(4);

  if (semanaisError) throw semanaisError;

  // Calcular estatísticas agregadas
  const totalLeads = leads?.length || 0;
  const leadsComVenda = leads?.filter((l: any) => l.venda_realizada) || [];
  const totalVendas = leadsComVenda.length;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;
  const ticketMedio = leadsComVenda.reduce((acc: number, l: any) => acc + (l.valor_venda || 0), 0) / (totalVendas || 1);

  const investimentoTotal = metricasDia?.reduce((acc: number, m: any) => acc + parseFloat(m.verba_investida), 0) || 0;
  const impressoesTotal = metricasDia?.reduce((acc: number, m: any) => acc + m.impressoes, 0) || 0;
  const cliquesTotal = metricasDia?.reduce((acc: number, m: any) => acc + m.cliques, 0) || 0;
  const ctr = impressoesTotal > 0 ? (cliquesTotal / impressoesTotal) * 100 : 0;
  const cpl = totalLeads > 0 ? investimentoTotal / totalLeads : 0;
  const cac = totalVendas > 0 ? investimentoTotal / totalVendas : 0;
  const roi = investimentoTotal > 0 ? ((ticketMedio * totalVendas - investimentoTotal) / investimentoTotal) * 100 : 0;

  // Agrupar por campanha
  const campanhasMap = new Map();
  metricasDia?.forEach((m: any) => {
    const key = m.campanha.id_campanha;
    if (!campanhasMap.has(key)) {
      campanhasMap.set(key, {
        nome: m.campanha.nome,
        verba: 0,
        impressoes: 0,
        cliques: 0,
        leads: 0,
      });
    }
    const camp = campanhasMap.get(key);
    camp.verba += parseFloat(m.verba_investida);
    camp.impressoes += m.impressoes;
    camp.cliques += m.cliques;
    camp.leads += m.leads;
  });

  const campanhasArray = Array.from(campanhasMap.values()).map((c: any) => ({
    ...c,
    cpl: c.leads > 0 ? c.verba / c.leads : 0,
    ctr: c.impressoes > 0 ? (c.cliques / c.impressoes) * 100 : 0,
  }));

  // Top 3 campanhas por leads
  const top3CampanhasLeads = campanhasArray
    .sort((a: any, b: any) => b.leads - a.leads)
    .slice(0, 3)
    .map((c: any) => `${c.nome} (${c.leads} leads, CPL R$ ${c.cpl.toFixed(2)})`);

  // Top 3 campanhas por CPL (melhor = menor)
  const top3CampanhasCPL = campanhasArray
    .filter((c: any) => c.leads > 0)
    .sort((a: any, b: any) => a.cpl - b.cpl)
    .slice(0, 3)
    .map((c: any) => `${c.nome} (CPL R$ ${c.cpl.toFixed(2)}, ${c.leads} leads)`);

  // Campanhas com pior performance (CPL alto)
  const piorCampanhasCPL = campanhasArray
    .filter((c: any) => c.leads > 0)
    .sort((a: any, b: any) => b.cpl - a.cpl)
    .slice(0, 3)
    .map((c: any) => `${c.nome} (CPL R$ ${c.cpl.toFixed(2)}, ${c.leads} leads)`);

  // Criar prompt para IA
  const prompt = `Você é um especialista em análise de tráfego pago e marketing digital. Analise os dados dos últimos 30 dias (até ontem) e forneça insights claros e acionáveis.

**Dados dos últimos 30 dias:**

**Métricas Gerais:**
- Total de Leads: ${totalLeads}
- Total de Vendas: ${totalVendas}
- Taxa de Conversão: ${taxaConversao.toFixed(1)}%
- Investimento Total: R$ ${investimentoTotal.toFixed(2)}
- CPL (Custo por Lead): R$ ${cpl.toFixed(2)}
- CAC (Custo de Aquisição): R$ ${cac.toFixed(2)}
- Ticket Médio: R$ ${ticketMedio.toFixed(2)}
- ROI: ${roi.toFixed(1)}%
- CTR médio: ${ctr.toFixed(2)}%
- Impressões Totais: ${impressoesTotal.toLocaleString('pt-BR')}
- Cliques Totais: ${cliquesTotal.toLocaleString('pt-BR')}

**Top 3 Campanhas por Volume de Leads:**
${top3CampanhasLeads.join('\n')}

**Top 3 Campanhas com Melhor CPL:**
${top3CampanhasCPL.join('\n')}

**Campanhas com CPL mais Alto (atenção):**
${piorCampanhasCPL.join('\n')}

**Métricas Semanais (últimas 4 semanas):**
${metricasSemanais?.map((m: any) => `Semana ${m.semana?.numero_semana}: ${m.leads_total} leads, ${m.vendas} vendas, CPL R$ ${(m.cpl || 0).toFixed(2)}`).join('\n')}

**Sua análise deve incluir:**

1. **O QUE ESTÁ DANDO CERTO** (2-3 pontos principais com dados concretos)
2. **O QUE ESTÁ DANDO ERRADO** (2-3 problemas principais com dados concretos)
3. **AÇÕES RECOMENDADAS** (3-4 ações práticas e específicas para implementar HOJE)

Seja direto, use números concretos, e foque em insights que gerem ação imediata. Sua resposta deve ser em português brasileiro, clara e objetiva.`;

  console.log(`Chamando Lovable AI para análise da empresa ${id_empresa}...`);

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de tráfego pago e marketing digital. Forneça análises claras, diretas e acionáveis baseadas em dados.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("Erro na resposta da IA:", aiResponse.status, errorText);
    throw new Error(`Erro ao chamar Lovable AI: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const analise = aiData.choices?.[0]?.message?.content;

  if (!analise) {
    throw new Error("Resposta da IA vazia");
  }

  // Salvar análise no banco de dados
  const { data: novaAnalise, error: insertError } = await supabase
    .from("analise_inteligencia")
    .insert({
      id_empresa,
      data_analise: dataAnalise,
      data_inicio_periodo: inicio30Dias.toISOString().split("T")[0],
      data_fim_periodo: ontem.toISOString().split("T")[0],
      analise_texto: analise,
      metricas_resumo: {
        totalLeads,
        totalVendas,
        taxaConversao,
        investimentoTotal,
        cpl,
        cac,
        roi,
        ticketMedio,
        ctr,
      },
    })
    .select()
    .single();

  if (insertError) {
    console.error("Erro ao salvar análise:", insertError);
    throw insertError;
  }

  console.log(`Análise salva para empresa ${id_empresa}`);
  return { id_empresa, status: "created", data: novaAnalise };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "analise-inteligencia";

  try {
    // Aceitar corpo vazio (cronjob) ou com id_empresa específico
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Corpo vazio, processará todas as empresas
    }
    
    const empresaEspecifica = body.id_empresa;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar empresas para processar
    let empresasParaProcessar = [];
    if (empresaEspecifica) {
      const { data, error } = await supabase
        .from("empresa")
        .select("id_empresa")
        .eq("id_empresa", empresaEspecifica)
        .single();
      
      if (error) throw error;
      empresasParaProcessar = [data];
    } else {
      // Processar todas as empresas (cronjob)
      const { data, error } = await supabase
        .from("empresa")
        .select("id_empresa");
      
      if (error) throw error;
      empresasParaProcessar = data || [];
    }

    console.log(`Processando análise para ${empresasParaProcessar.length} empresa(s)`);

    const resultados = [];
    
    for (const empresa of empresasParaProcessar) {
      try {
        const resultado = await processarEmpresa(supabase, lovableApiKey, empresa.id_empresa);
        resultados.push(resultado);
      } catch (error) {
        console.error(`Erro ao processar empresa ${empresa.id_empresa}:`, error);
        resultados.push({
          id_empresa: empresa.id_empresa,
          status: "error",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processadas: resultados.length,
        resultados,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
    // Registrar execução bem-sucedida
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { 
        processadas: resultados.length,
        resultados 
      }
    });
    
  } catch (error) {
    console.error("Erro na função analise-inteligencia:", error);
    
    // Registrar execução com erro
    const duracao = Date.now() - startTime;
    const supabaseLog = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseLog.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
