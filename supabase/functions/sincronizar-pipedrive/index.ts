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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando sincronização Pipedrive...");

    // Buscar todas as integrações Pipedrive ativas
    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "PIPEDRIVE")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Pipedrive ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const apiToken = config.api_token;
      let domain = config.domain;
      // Remove .pipedrive.com se o usuário incluiu no domínio
      domain = domain.replace('.pipedrive.com', '');
      const idEmpresa = config.id_empresa;
      const pipelineId = config.pipeline_id; // ID da pipeline específica

      console.log(`Processando integração para empresa ${idEmpresa}`);
      if (pipelineId) {
        console.log(`Filtrando deals da pipeline ID: ${pipelineId}`);
      }

      try {
        // Buscar stages da pipeline para mapear IDs para nomes
        const stagesMap: Record<number, string> = {};
        if (pipelineId) {
          const stagesUrl = `https://${domain}.pipedrive.com/api/v1/stages?api_token=${apiToken}&pipeline_id=${pipelineId}`;
          console.log(`Buscando stages da pipeline ${pipelineId}...`);
          console.log(`URL stages: ${stagesUrl}`);
          
          try {
            const stagesResponse = await fetch(stagesUrl);
            console.log(`Status response stages: ${stagesResponse.status}`);
            
            if (stagesResponse.ok) {
              const stagesData = await stagesResponse.json();
              console.log(`Stages data success: ${stagesData.success}, data exists: ${!!stagesData.data}`);
              
              if (stagesData.success && stagesData.data) {
                for (const stage of stagesData.data) {
                  stagesMap[stage.id] = stage.name;
                  console.log(`Stage mapeado: ${stage.id} -> ${stage.name}`);
                }
                console.log(`${Object.keys(stagesMap).length} stages carregados`);
              }
            } else {
              console.error(`Erro ao buscar stages: ${stagesResponse.status}`);
            }
          } catch (stageError) {
            console.error(`Erro ao processar stages: ${stageError}`);
          }
        } else {
          console.log("Pipeline ID não especificado, stages não serão carregados");
        }

        // Buscar apenas deals abertos
        let dealsUrl = `https://${domain}.pipedrive.com/api/v1/deals?api_token=${apiToken}&start=0&limit=500&status=open`;
        
        console.log(`Buscando deals da URL: ${dealsUrl}`);
        
        const dealsResponse = await fetch(dealsUrl);
        if (!dealsResponse.ok) {
          const errorText = await dealsResponse.text();
          console.error(`Erro na API Pipedrive: ${dealsResponse.status} - ${errorText}`);
          resultados.push({ 
            integracao: integracao.id_integracao, 
            status: "error", 
            error: `Erro na API Pipedrive (${dealsResponse.status}): ${errorText}. Verifique seu API Token e domínio.` 
          });
          continue;
        }

        const dealsData = await dealsResponse.json();
        
        if (!dealsData.success || !dealsData.data) {
          console.log("Nenhum deal encontrado");
          continue;
        }

        // Processar cada deal como um lead
        for (const deal of dealsData.data) {
          try {
            // Filtrar por pipeline_id se especificado
            if (pipelineId && String(deal.pipeline_id) !== String(pipelineId)) {
              console.log(`Deal ${deal.id} ignorado - pipeline ${deal.pipeline_id} diferente de ${pipelineId}`);
              continue;
            }
            
            // Mapear status do deal para campos do lead
            const dealPerdido = deal.status === "lost";
            const dealAberto = deal.status === "open";
            const vendaRealizada = deal.status === "won";
            
            // Só processar deals abertos ou perdidos se pipeline_id for especificado
            // Para manter consistência com o comportamento anterior de status=open
            const isMql = dealAberto && deal.stage_id !== null && deal.stage_id > 1;
            const levantouMao = dealAberto && deal.stage_id !== null && deal.stage_id > 2;
            const temReuniao = dealAberto && deal.stage_id !== null && deal.stage_id > 3;
            const reuniaoRealizada = dealAberto && deal.stage_id !== null && deal.stage_id > 4;
            
            // Construir URL do Pipedrive
            const urlPipedrive = `https://${domain}.pipedrive.com/deal/${deal.id}`;
            
            // Valor: sempre sincronizar se existir, independente do status
            const valorDeal = deal.value ? parseFloat(deal.value) : null;
            
            // Determinar nome do stage
            let stageAtual = null;
            if (dealPerdido) {
              stageAtual = "Perdido";
            } else if (deal.stage_id && stagesMap[deal.stage_id]) {
              stageAtual = stagesMap[deal.stage_id];
            }
            
            const leadData = {
              id_empresa: idEmpresa,
              id_lead_externo: String(deal.id),
              nome_lead: deal.person_name || deal.title || "Lead sem nome",
              organizacao: deal.org_name || null,
              stage_atual: stageAtual,
              pipeline_id: deal.pipeline_id ? String(deal.pipeline_id) : null,
              url_pipedrive: urlPipedrive,
              data_criacao: deal.add_time || new Date().toISOString(),
              origem_canal: "OUTRO" as const,
              origem_campanha: deal.origin || null,
              is_mql: isMql,
              levantou_mao: levantouMao,
              tem_reuniao: temReuniao,
              reuniao_realizada: reuniaoRealizada,
              venda_realizada: vendaRealizada,
              data_venda: vendaRealizada ? (deal.won_time || deal.update_time) : null,
              valor_venda: valorDeal,
            };

            // Inserir ou atualizar lead usando as colunas do constraint único
            const { data: leadInserido, error: leadError } = await supabase
              .from("lead")
              .upsert(leadData, { 
                onConflict: "id_lead_externo,id_empresa"
              })
              .select()
              .single();

            if (leadError) {
              console.error(`Erro ao salvar lead ${deal.id}:`, leadError);
              continue;
            }

            // Registrar evento de mudança de stage se necessário
            if (deal.stage_change_time) {
              const eventoData = {
                id_lead: leadInserido.id_lead,
                etapa: `Stage ${deal.stage_id}`,
                data_evento: deal.stage_change_time,
                observacao: deal.stage_name || null,
              };

              const { error: eventoError } = await supabase
                .from("lead_evento")
                .insert(eventoData);

              if (eventoError) {
                console.error(`Erro ao registrar evento do lead ${deal.id}:`, eventoError);
              }
            }

            resultados.push({ deal: deal.id, status: "success" });
          } catch (error) {
            console.error(`Erro ao processar deal ${deal.id}:`, error);
            resultados.push({ deal: deal.id, status: "error", error: String(error) });
          }
        }
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log("Sincronização Pipedrive concluída");
    
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");
    
    if (erros.length > 0 && sucessos.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: erros[0].error || "Erro ao sincronizar com Pipedrive",
          resultados 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Sincronização concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`, 
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
