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
        // Buscar deals recentes (últimos 30 dias)
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - 30);
        
        // Construir URL com filtro de pipeline se especificado
        let dealsUrl = `https://${domain}.pipedrive.com/api/v1/deals?api_token=${apiToken}&start=0&limit=500&status=all_not_deleted`;
        if (pipelineId) {
          dealsUrl += `&pipeline_id=${pipelineId}`;
        }
        
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
            // Mapear status do deal para campos do lead
            const isMql = deal.stage_id !== null && deal.stage_id > 1;
            const levantouMao = deal.stage_id !== null && deal.stage_id > 2;
            const temReuniao = deal.stage_id !== null && deal.stage_id > 3;
            const reuniaoRealizada = deal.stage_id !== null && deal.stage_id > 4;
            const vendaRealizada = deal.status === "won";
            
            // Construir URL do Pipedrive
            const urlPipedrive = `https://${domain}.pipedrive.com/deal/${deal.id}`;
            
            const leadData = {
              id_empresa: idEmpresa,
              id_lead_externo: String(deal.id),
              nome_lead: deal.person_name || deal.title || "Lead sem nome",
              organizacao: deal.org_name || null,
              stage_atual: deal.stage_id ? `Stage ${deal.stage_id}` : null,
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
              valor_venda: vendaRealizada ? parseFloat(deal.value || "0") : null,
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
