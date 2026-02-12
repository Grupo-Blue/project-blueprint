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
  const MAX_TIME_MS = 50000; // 50s limite

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando sincronização Pipedrive (v2.0 - otimizada)...");

    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "PIPEDRIVE")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Pipedrive ativa");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      // Check timeout
      if (Date.now() - startTime > MAX_TIME_MS) {
        console.log("⏱️ Timeout próximo, encerrando...");
        break;
      }

      const config = integracao.config_json as any;
      const apiToken = config.api_token;
      let domain = config.domain.replace('.pipedrive.com', '');
      const idEmpresa = integracao.id_empresa; // PHASE 2: usar coluna direta
      const pipelineId = config.pipeline_id;

      console.log(`\n📊 Processando empresa ${idEmpresa}, pipeline ${pipelineId}`);

      try {
        // Buscar users da organização para mapear owner
        const usersMap: Record<number, string> = {};
        try {
          const usersUrl = `https://${domain}.pipedrive.com/api/v1/users?api_token=${apiToken}`;
          const usersResponse = await fetch(usersUrl);
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData.success && usersData.data) {
              for (const user of usersData.data) {
                usersMap[user.id] = user.name;
              }
              console.log(`  ↳ ${Object.keys(usersMap).length} users carregados`);
            }
          }
        } catch (userError) {
          console.error("  ⚠️ Erro ao buscar users:", userError);
        }

        // Buscar stages da pipeline
        const stagesMap: Record<number, string> = {};
        const stageIds: number[] = [];
        
        if (pipelineId) {
          const stagesUrl = `https://${domain}.pipedrive.com/api/v1/stages?api_token=${apiToken}&pipeline_id=${pipelineId}`;
          const stagesResponse = await fetch(stagesUrl);
          
          if (stagesResponse.ok) {
            const stagesData = await stagesResponse.json();
            if (stagesData.success && stagesData.data) {
              for (const stage of stagesData.data) {
                stagesMap[stage.id] = stage.name;
                stageIds.push(stage.id);
              }
              console.log(`  ↳ ${Object.keys(stagesMap).length} stages carregados`);
            }
          }
        }

        // Buscar deals em batches menores (limit=100 em vez de 500)
        const allDeals: any[] = [];
        const limit = 100;
        let start = 0;
        let page = 0;
        const maxPages = 5; // Limite de páginas por execução

        while (page < maxPages) {
          if (Date.now() - startTime > MAX_TIME_MS) break;

          const dealsUrl = `https://${domain}.pipedrive.com/api/v1/deals?api_token=${apiToken}&status=all&start=${start}&limit=${limit}`;
          
          const dealsResponse = await fetch(dealsUrl);
          if (!dealsResponse.ok) {
            const errorText = await dealsResponse.text();
            console.error(`❌ Erro API Pipedrive: ${dealsResponse.status}`);
            resultados.push({ 
              integracao: integracao.id_integracao, 
              status: "error", 
              error: `Erro API: ${dealsResponse.status}` 
            });
            break;
          }

          const dealsData = await dealsResponse.json();

          if (!dealsData.success || !dealsData.data || dealsData.data.length === 0) {
            break;
          }

          allDeals.push(...dealsData.data);

          const pagination = dealsData.additional_data?.pagination;
          if (!pagination || !pagination.more_items_in_collection) {
            break;
          }

          start = pagination.next_start ?? (start + limit);
          page++;
        }

        console.log(`  ↳ ${allDeals.length} deals carregados`);

        // Filtrar por pipeline
        const dealsFiltered = stageIds.length > 0 
          ? allDeals.filter((deal: any) => stageIds.includes(deal.stage_id) || String(deal.pipeline_id) === String(pipelineId))
          : allDeals.filter((deal: any) => String(deal.pipeline_id) === String(pipelineId));

        console.log(`  ↳ ${dealsFiltered.length} deals na pipeline ${pipelineId}`);

        // Processar deals em batch (upsert múltiplos)
        const leadsToUpsert = [];
        
        for (const deal of dealsFiltered) {
          const dealPerdido = deal.status === "lost";
          const dealAberto = deal.status === "open";
          const vendaRealizada = deal.status === "won";
          
          const isMql = dealAberto && deal.stage_id > 1;
          const levantouMao = dealAberto && deal.stage_id > 2;
          const temReuniao = dealAberto && deal.stage_id > 3;
          const reuniaoRealizada = dealAberto && deal.stage_id > 4;
          
          const urlPipedrive = `https://${domain}.pipedrive.com/deal/${deal.id}`;
          const valorDeal = deal.value ? parseFloat(deal.value) : null;
          
          let stageAtual = null;
          if (dealPerdido) {
            stageAtual = "Perdido";
          } else if (deal.stage_id && stagesMap[deal.stage_id]) {
            stageAtual = stagesMap[deal.stage_id];
          }
          
          // Capturar owner do deal
          const ownerName = deal.user_id ? (usersMap[deal.user_id] || null) : null;
          const ownerId = deal.user_id ? String(deal.user_id) : null;

          // Capturar motivo de perda
          const motivoPerda = dealPerdido ? (deal.lost_reason || null) : null;

          leadsToUpsert.push({
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
            proprietario_nome: ownerName,
            proprietario_id: ownerId,
            motivo_perda: motivoPerda,
          });
        }

        // Upsert em batches de 50
        const batchSize = 50;
        let processados = 0;
        
        for (let i = 0; i < leadsToUpsert.length; i += batchSize) {
          const batch = leadsToUpsert.slice(i, i + batchSize);
          
          const { error: batchError } = await supabase
            .from("lead")
            .upsert(batch, { onConflict: "id_lead_externo,id_empresa" });

          if (batchError) {
            console.error(`  ⚠️ Erro batch ${i}:`, batchError.message);
          } else {
            processados += batch.length;
          }
        }

        console.log(`  ✅ ${processados} leads sincronizados`);
        resultados.push({ 
          integracao: integracao.id_integracao, 
          status: "success",
          deals_processados: processados 
        });

      } catch (error: any) {
        console.error(`❌ Erro integração:`, error.message);
        resultados.push({ 
          integracao: integracao.id_integracao, 
          status: "error", 
          error: error.message 
        });
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`\n✅ Sincronização concluída em ${(duracao/1000).toFixed(1)}s`);
    
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");
    
    return new Response(
      JSON.stringify({ 
        message: `Sincronização concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`, 
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
