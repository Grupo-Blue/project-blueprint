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

  const startTime = Date.now();
  const nomeCronjob = "coletar-metricas-meta-historico";
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parâmetros: data_inicio, data_fim, integracao_id (opcional)
    const body = await req.json().catch(() => ({}));
    const dataInicio = body.data_inicio;
    const dataFim = body.data_fim;
    const integracaoIdFiltro = body.integracao_id;

    if (!dataInicio || !dataFim) {
      return new Response(
        JSON.stringify({ error: "Parâmetros data_inicio e data_fim são obrigatórios (formato: YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Iniciando coleta histórica Meta Ads de ${dataInicio} a ${dataFim}...`);

    // Buscar integrações Meta Ads ativas
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: intError } = await query;

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Meta Ads ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = [];
    let totalMetricas = 0;
    let gastoTotal = 0;

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const accessToken = config.access_token;
      const adAccountId = config.ad_account_id;
      const idEmpresa = integracao.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

      try {
        // Buscar a conta_anuncio específica desta integração pelo id_externo
        const { data: contaAnuncio } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_externo", adAccountId)
          .eq("plataforma", "META")
          .maybeSingle();

        if (!contaAnuncio) {
          console.log(`Conta de anúncio ${adAccountId} não encontrada no banco, pulando...`);
          continue;
        }

        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta")
          .eq("id_conta", contaAnuncio.id_conta);

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) {
          console.log(`Nenhuma campanha encontrada para empresa ${idEmpresa}`);
          continue;
        }

        console.log(`Encontradas ${campanhas.length} campanhas para processar`);

        // Buscar métricas históricas da API do Meta
        // time_range permite especificar datas personalizadas
        const fields = "campaign_id,impressions,clicks,spend,actions";
        const timeRange = JSON.stringify({ since: dataInicio, until: dataFim });
        const campanhIdsStr = campanhas.map(c => c.id_campanha_externo).join(",");
        
        // Usar time_increment=1 para obter dados diários
        const url = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=${fields}&level=campaign&time_range=${encodeURIComponent(timeRange)}&time_increment=1&access_token=${accessToken}&filtering=[{"field":"campaign.id","operator":"IN","value":["${campanhIdsStr.replace(/,/g, '","')}"]}]&limit=500`;

        console.log(`Chamando API Meta para período ${dataInicio} a ${dataFim}`);

        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erro na API Meta: ${response.status} - ${errorText}`);
          
          let errorMessage = "Erro ao conectar com Meta Ads";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              if (errorData.error.code === 190) {
                errorMessage = "Access Token inválido ou expirado";
              } else {
                errorMessage = errorData.error.message;
              }
            }
          } catch {
            errorMessage = `Erro ${response.status}`;
          }
          
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: errorMessage
          });
          continue;
        }

        const apiData = await response.json();
        let metricasProcessadas = 0;

        // Processar cada registro (cada linha é uma campanha/dia)
        for (const metrica of apiData.data || []) {
          const campanha = campanhas.find(c => c.id_campanha_externo === metrica.campaign_id);
          if (!campanha) continue;

          // date_start contém a data do registro
          const dataMetrica = metrica.date_start;
          const leads = metrica.actions?.find((a: any) => a.action_type === "lead")?.value || 0;
          const gasto = parseFloat(metrica.spend || "0");
          gastoTotal += gasto;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: dataMetrica,
            impressoes: parseInt(metrica.impressions || "0"),
            cliques: parseInt(metrica.clicks || "0"),
            verba_investida: gasto,
            leads: parseInt(leads),
          };

          // Inserir ou atualizar métricas do dia
          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`Erro ao salvar métricas:`, upsertError);
          } else {
            metricasProcessadas++;
          }
        }

        // Verificar se há mais páginas de resultados
        let nextPageUrl = apiData.paging?.next;
        while (nextPageUrl) {
          console.log("Buscando próxima página de resultados...");
          const nextResponse = await fetch(nextPageUrl);
          if (!nextResponse.ok) break;
          
          const nextData = await nextResponse.json();
          
          for (const metrica of nextData.data || []) {
            const campanha = campanhas.find(c => c.id_campanha_externo === metrica.campaign_id);
            if (!campanha) continue;

            const dataMetrica = metrica.date_start;
            const leads = metrica.actions?.find((a: any) => a.action_type === "lead")?.value || 0;
            const gasto = parseFloat(metrica.spend || "0");
            gastoTotal += gasto;

            const metricasDia = {
              id_campanha: campanha.id_campanha,
              data: dataMetrica,
              impressoes: parseInt(metrica.impressions || "0"),
              cliques: parseInt(metrica.clicks || "0"),
              verba_investida: gasto,
              leads: parseInt(leads),
            };

            const { error: upsertError } = await supabase
              .from("campanha_metricas_dia")
              .upsert(metricasDia, { onConflict: "id_campanha,data" });

            if (!upsertError) {
              metricasProcessadas++;
            }
          }
          
          nextPageUrl = nextData.paging?.next;
        }

        totalMetricas += metricasProcessadas;
        console.log(`Processadas ${metricasProcessadas} métricas para empresa ${idEmpresa}`);
        
        resultados.push({ 
          integracao: integracao.id_integracao, 
          empresa: idEmpresa,
          status: "success", 
          metricas: metricasProcessadas 
        });
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log(`Coleta histórica concluída: ${totalMetricas} métricas, R$ ${gastoTotal.toFixed(2)} total`);
    
    // Registrar execução
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { 
        periodo: { inicio: dataInicio, fim: dataFim },
        total_metricas: totalMetricas,
        gasto_total: gastoTotal,
        resultados 
      }
    });
    
    return new Response(
      JSON.stringify({ 
        message: `Coleta histórica concluída: ${totalMetricas} métricas processadas`,
        periodo: { inicio: dataInicio, fim: dataFim },
        gasto_total: gastoTotal,
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    
    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
