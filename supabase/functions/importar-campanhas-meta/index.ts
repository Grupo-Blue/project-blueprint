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
    console.log("Iniciando importação de campanhas Meta Ads...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verificar se foi passado um ID de integração específico
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    // Buscar integrações ativas do Meta Ads
    let query = supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: integracoesError } = await query;

    if (integracoesError) throw integracoesError;

    console.log(`Encontradas ${integracoes?.length || 0} integrações Meta Ads ativas`);

    const resultados = [];

    for (const integracao of integracoes || []) {
      try {
        const config = integracao.config_json as any;
        const accessToken = config.access_token;
        const adAccountId = config.ad_account_id;
        const idEmpresa = config.id_empresa;

        console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

        // Buscar conta de anúncio da empresa com plataforma META
        const { data: contaAnuncio, error: contaError } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", idEmpresa)
          .eq("plataforma", "META")
          .eq("ativa", true)
          .single();

        if (contaError || !contaAnuncio) {
          const errorMsg = `Nenhuma conta de anúncio Meta encontrada para empresa ${idEmpresa}`;
          console.error(errorMsg);
          resultados.push({
            integracao: integracao.id_integracao,
            status: "error",
            error: errorMsg,
          });
          continue;
        }

        // Buscar campanhas da API do Meta (sem filtro na URL pois não é suportado)
        const campaignsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective&access_token=${accessToken}`;

        const campaignsResponse = await fetch(campaignsUrl);

        if (!campaignsResponse.ok) {
          const errorText = await campaignsResponse.text();
          console.error(`Erro na API Meta: ${campaignsResponse.status} - ${errorText}`);
          
          let errorMessage = "Erro ao buscar campanhas do Meta Ads";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              if (errorData.error.code === 190) {
                errorMessage = "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager.";
              } else {
                errorMessage = errorData.error.message;
              }
            }
          } catch {
            errorMessage = `Erro ${campaignsResponse.status}`;
          }

          resultados.push({
            integracao: integracao.id_integracao,
            status: "error",
            error: errorMessage,
          });
          continue;
        }

        const campaignsData = await campaignsResponse.json();
        // Filtrar apenas campanhas ativas e pausadas no código
        const campanhas = (campaignsData.data || []).filter(
          (camp: any) => camp.status === "ACTIVE" || camp.status === "PAUSED"
        );
        
        console.log(`Encontradas ${campanhas.length} campanhas para importar`);

        let importadas = 0;
        let atualizadas = 0;

        // Importar cada campanha
        for (const campaign of campanhas) {
          const campanhaData = {
            id_campanha_externo: campaign.id,
            id_conta: contaAnuncio.id_conta,
            nome: campaign.name,
            ativa: campaign.status === "ACTIVE",
            objetivo: campaign.objective || null,
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

    console.log("Importação de campanhas Meta Ads concluída");

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