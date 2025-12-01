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
  const nomeCronjob = "coletar-metricas-meta";
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando coleta de métricas Meta Ads...");

    // Verificar se foi passado um ID de integração específico
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    // Buscar todas as integrações Meta Ads ativas
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    // Se foi passado um ID específico, filtrar por ele
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

    const hoje = new Date().toISOString().split("T")[0];
    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const accessToken = config.access_token;
      const adAccountId = config.ad_account_id;
      const idEmpresa = config.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

      try {
        // Buscar campanhas da conta de anúncio
        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta")
          .eq("ativa", true)
          .in("id_conta", 
            await supabase
              .from("conta_anuncio")
              .select("id_conta")
              .eq("id_empresa", idEmpresa)
              .eq("plataforma", "META")
              .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) continue;

        // Buscar informações atualizadas das campanhas da API
        const campanhIdsStr = campanhas.map(c => c.id_campanha_externo).join(",");
        const campaignsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective&ids=${campanhIdsStr}&access_token=${accessToken}`;
        
        try {
          const campaignsResponse = await fetch(campaignsUrl);
          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            
            // Atualizar dados das campanhas
            for (const campData of campaignsData.data || []) {
              const campanhaLocal = campanhas.find(c => c.id_campanha_externo === campData.id);
              if (campanhaLocal) {
                await supabase
                  .from("campanha")
                  .update({
                    nome: campData.name,
                    ativa: campData.status === "ACTIVE",
                    objetivo: campData.objective || null,
                  })
                  .eq("id_campanha", campanhaLocal.id_campanha);
              }
            }
          }
        } catch (err) {
          console.error("Erro ao atualizar campanhas:", err);
        }

        // Buscar métricas da API do Meta
        const fields = "campaign_id,impressions,clicks,spend,actions";
        const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?fields=${fields}&level=campaign&date_preset=today&access_token=${accessToken}&filtering=[{"field":"campaign.id","operator":"IN","value":["${campanhIdsStr.replace(/,/g, '","')}"]}]`;

        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erro na API Meta: ${response.status} - ${errorText}`);
          
          // Parse error message from Meta API
          let errorMessage = "Erro ao conectar com Meta Ads";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              if (errorData.error.code === 190) {
                errorMessage = "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager.";
              } else if (errorData.error.code === 200 && errorData.error.message.includes("API access blocked")) {
                errorMessage = "API Access Blocked: Verifique se o System User Token tem as permissões corretas (ads_read, ads_management) e se o App Meta está em modo Produção. Verifique também se o token tem acesso à conta de anúncios no Business Manager.";
              } else {
                errorMessage = errorData.error.message;
              }
            }
          } catch {
            errorMessage = `Erro ${response.status}: Verifique suas credenciais do Meta Ads`;
          }
          
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: errorMessage
          });
          continue;
        }

        const apiData = await response.json();

        // Processar cada campanha
        for (const metrica of apiData.data || []) {
          const campanha = campanhas.find(c => c.id_campanha_externo === metrica.campaign_id);
          if (!campanha) continue;

          const leads = metrica.actions?.find((a: any) => a.action_type === "lead")?.value || 0;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: hoje,
            impressoes: parseInt(metrica.impressions || "0"),
            cliques: parseInt(metrica.clicks || "0"),
            verba_investida: parseFloat(metrica.spend || "0"),
            leads: parseInt(leads),
          };

          // Inserir ou atualizar métricas do dia
          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`Erro ao salvar métricas da campanha ${campanha.id_campanha}:`, upsertError);
          } else {
            resultados.push({ campanha: campanha.id_campanha, status: "success" });
          }
        }
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log("Coleta de métricas Meta Ads concluída");
    
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");
    
    if (erros.length > 0 && sucessos.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: erros[0].error || "Erro ao coletar métricas do Meta Ads",
          resultados 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Registrar execução bem-sucedida
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { 
        sucessos: sucessos.length, 
        erros: erros.length,
        resultados 
      }
    });
    
    return new Response(
      JSON.stringify({ 
        message: `Coleta concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`, 
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    
    // Registrar execução com erro
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