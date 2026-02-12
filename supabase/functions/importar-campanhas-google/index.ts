import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para obter access token do Google usando refresh token
async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao obter access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  try {
    console.log("Iniciando importação de campanhas Google Ads...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verificar se foi passado um ID de integração específico
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    // Buscar integrações ativas do Google Ads
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "GOOGLE_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: integracoesError } = await query;

    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Google Ads ativas`);

    const resultados = [];

    for (const integracao of integracoes || []) {
      try {
        const config = integracao.config_json as any;
        const customerId = config.customer_id?.replace(/-/g, "");
        const loginCustomerId = config.login_customer_id?.replace(/-/g, "");
        const refreshToken = config.refresh_token;
        const clientId = config.client_id;
        const clientSecret = config.client_secret;
        const developerToken = config.developer_token;
        const idEmpresa = integracao.id_empresa; // PHASE 2: usar coluna direta

        console.log(`Processando integração para empresa ${idEmpresa}, customer ${customerId}`);

        // Obter access token
        const accessToken = await getAccessToken(refreshToken, clientId, clientSecret);

        // Buscar conta de anúncio da empresa com plataforma GOOGLE
        const { data: contaAnuncio, error: contaError } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "GOOGLE")
          .eq("ativa", true)
          .single();

        if (contaError || !contaAnuncio) {
          const errorMsg = `Nenhuma conta de anúncio Google encontrada para empresa ${idEmpresa}`;
          console.error(errorMsg);
          resultados.push({
            integracao: integracao.id_integracao,
            status: "error",
            error: errorMsg,
          });
          continue;
        }

        // Query GAQL para buscar campanhas
        const gaqlQuery = `
          SELECT 
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type
          FROM campaign
        `;

        const searchUrl = `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`;

        const headers: Record<string, string> = {
          "Authorization": `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        };

        if (loginCustomerId) {
          headers["login-customer-id"] = loginCustomerId;
        }

        const searchResponse = await fetch(searchUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: gaqlQuery }),
        });

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`Erro na API Google Ads: ${searchResponse.status} - ${errorText}`);
          
          let errorMessage = "Erro ao buscar campanhas do Google Ads";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch {
            errorMessage = `Erro ${searchResponse.status}`;
          }

          resultados.push({
            integracao: integracao.id_integracao,
            status: "error",
            error: errorMessage,
          });
          continue;
        }

        const searchData = await searchResponse.json();
        // Filtrar campanhas ativas e pausadas no código
        const campanhas = (searchData.results || []).filter(
          (result: any) => 
            result.campaign.status === "ENABLED" || 
            result.campaign.status === "PAUSED"
        );
        
        console.log(`Encontradas ${campanhas.length} campanhas ativas para importar`);

        let importadas = 0;
        let atualizadas = 0;

        // Importar cada campanha
        for (const result of campanhas) {
          const campaign = result.campaign;
          
          const campanhaData = {
            id_campanha_externo: String(campaign.id),
            id_conta: contaAnuncio.id_conta,
            nome: campaign.name,
            ativa: campaign.status === "ENABLED",
            objetivo: campaign.advertisingChannelType || null,
            data_criacao: new Date().toISOString(),
          };

          // Verificar se campanha já existe
          const { data: campanhaExistente } = await supabase
            .from("campanha")
            .select("id_campanha")
            .eq("id_campanha_externo", campanhaData.id_campanha_externo)
            .single();

          if (campanhaExistente) {
            // Atualizar campanha existente
            const { error: updateError } = await supabase
              .from("campanha")
              .update({
                nome: campanhaData.nome,
                ativa: campanhaData.ativa,
                objetivo: campanhaData.objetivo,
              })
              .eq("id_campanha", campanhaExistente.id_campanha);

            if (updateError) {
              console.error(`Erro ao atualizar campanha ${campaign.name}:`, updateError);
            } else {
              atualizadas++;
              console.log(`Campanha ${campaign.name} atualizada`);
            }
          } else {
            // Inserir nova campanha
            const { error: insertError } = await supabase
              .from("campanha")
              .insert(campanhaData);

            if (insertError) {
              console.error(`Erro ao inserir campanha ${campaign.name}:`, insertError);
            } else {
              importadas++;
              console.log(`Campanha ${campaign.name} importada`);
            }
          }
        }

        resultados.push({
          integracao: integracao.id_integracao,
          status: "success",
          campanhas_importadas: importadas,
          campanhas_atualizadas: atualizadas,
          total_processadas: campanhas.length,
        });

      } catch (integErr) {
        console.error("Erro ao processar integração:", integErr);
        resultados.push({
          integracao: integracao.id_integracao,
          status: "error",
          error: integErr instanceof Error ? integErr.message : String(integErr),
        });
      }
    }

    console.log("Importação de campanhas Google Ads concluída");

    const erros = resultados.filter((r: any) => r.status === "error");
    const sucessos = resultados.filter((r: any) => r.status === "success");

    // Registrar execução no cronjob_execucao
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'importar-campanhas-google',
      status: erros.length > 0 && sucessos.length === 0 ? 'erro' : erros.length > 0 ? 'parcial' : 'sucesso',
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: { sucessos: sucessos.length, erros: erros.length, resultados },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Importação de campanhas concluída",
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from('cronjob_execucao').insert({
        nome_cronjob: 'importar-campanhas-google',
        status: 'erro',
        mensagem_erro: error instanceof Error ? error.message : String(error),
        duracao_ms: Date.now() - startTime,
      });
    } catch (_) { /* ignore logging error */ }
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});