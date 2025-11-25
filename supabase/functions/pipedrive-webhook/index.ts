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
    const webhookSecret = Deno.env.get("PIPEDRIVE_WEBHOOK_SECRET")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar secret na URL
    const url = new URL(req.url);
    const providedSecret = url.searchParams.get("secret");

    if (providedSecret !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    console.log("Webhook recebido:", JSON.stringify(payload, null, 2));

    // Estrutura do webhook Pipedrive v2.0:
    // { data: { id, title, ... }, previous: {...}, meta: { action: 'added'/'updated'/'deleted', ... } }
    const event = payload.meta?.action; // 'added', 'updated', 'deleted', 'change', etc
    const dealData = payload.data;

    if (!dealData) {
      console.log("Nenhum dado do deal encontrado no payload");
      return new Response(
        JSON.stringify({ message: "No deal data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Evento: ${event}, Deal ID: ${dealData.id}`);

    // Buscar integração Pipedrive para mapear pipeline_id -> empresa
    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "PIPEDRIVE")
      .eq("ativo", true);

    if (intError) {
      console.error("Erro ao buscar integrações:", intError);
      throw intError;
    }

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Pipedrive ativa encontrada");
      return new Response(
        JSON.stringify({ message: "No active Pipedrive integration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encontrar integração que corresponde ao pipeline_id do deal
    let targetIntegracao = null;
    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const pipelineId = config.pipeline_id;
      
      if (String(dealData.pipeline_id) === String(pipelineId)) {
        targetIntegracao = integracao;
        break;
      }
    }

    if (!targetIntegracao) {
      console.log(`Deal ${dealData.id} não pertence a nenhuma pipeline configurada (pipeline_id: ${dealData.pipeline_id})`);
      return new Response(
        JSON.stringify({ message: "Deal not in configured pipeline" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = targetIntegracao.config_json as any;
    const idEmpresa = config.id_empresa;
    const domain = config.domain.replace('.pipedrive.com', '');

    console.log(`Processando deal ${dealData.id} para empresa ${idEmpresa}`);

    // Buscar stages da pipeline para mapear stage_id -> nome
    const stagesMap: Record<number, string> = {};
    const apiToken = config.api_token;
    const pipelineId = config.pipeline_id;

    try {
      const stagesUrl = `https://${domain}.pipedrive.com/api/v1/stages?api_token=${apiToken}&pipeline_id=${pipelineId}`;
      const stagesResponse = await fetch(stagesUrl);
      
      if (stagesResponse.ok) {
        const stagesData = await stagesResponse.json();
        if (stagesData.success && stagesData.data) {
          for (const stage of stagesData.data) {
            stagesMap[stage.id] = stage.name;
          }
          console.log(`${Object.keys(stagesMap).length} stages mapeados`);
        }
      }
    } catch (stageError) {
      console.error("Erro ao buscar stages:", stageError);
    }

    // Mapear status e campos do deal
    const dealPerdido = dealData.status === "lost";
    const dealAberto = dealData.status === "open";
    const vendaRealizada = dealData.status === "won";
    
    const isMql = dealAberto && dealData.stage_id !== null && dealData.stage_id > 1;
    const levantouMao = dealAberto && dealData.stage_id !== null && dealData.stage_id > 2;
    const temReuniao = dealAberto && dealData.stage_id !== null && dealData.stage_id > 3;
    const reuniaoRealizada = dealAberto && dealData.stage_id !== null && dealData.stage_id > 4;
    
    const urlPipedrive = `https://${domain}.pipedrive.com/deal/${dealData.id}`;
    const valorDeal = dealData.value ? parseFloat(dealData.value) : null;
    
    let stageAtual = null;
    if (dealPerdido) {
      stageAtual = "Perdido";
    } else if (dealData.stage_id && stagesMap[dealData.stage_id]) {
      stageAtual = stagesMap[dealData.stage_id];
    }

    // Capturar UTM parameters dos campos customizados do Pipedrive
    // Pipedrive armazena campos customizados em um objeto aninhado
    const customFields = dealData.custom_fields || {};
    
    // Extrair UTM parameters (ajustar os IDs dos campos conforme sua configuração no Pipedrive)
    const utmSource = customFields.utm_source || null;
    const utmMedium = customFields.utm_medium || null;
    const utmCampaign = customFields.utm_campaign || null;
    const utmContent = customFields.utm_content || null;
    const utmTerm = customFields.utm_term || null;

    console.log("UTM Parameters capturados:", { utmSource, utmMedium, utmCampaign, utmContent, utmTerm });

    // Tentar vincular ao criativo usando utm_content (que deve conter o id_criativo_externo)
    let idCriativo = null;
    if (utmContent) {
      try {
        const { data: criativo } = await supabase
          .from("criativo")
          .select("id_criativo")
          .eq("id_criativo_externo", utmContent)
          .eq("ativo", true)
          .maybeSingle();
        
        if (criativo) {
          idCriativo = criativo.id_criativo;
          console.log(`Criativo vinculado: ${idCriativo} (utm_content: ${utmContent})`);
        } else {
          console.log(`Nenhum criativo encontrado para utm_content: ${utmContent}`);
        }
      } catch (criativoError) {
        console.error("Erro ao buscar criativo:", criativoError);
      }
    }

    const leadData = {
      id_empresa: idEmpresa,
      id_lead_externo: String(dealData.id),
      nome_lead: dealData.person_name || dealData.title || "Lead sem nome",
      organizacao: dealData.org_name || null,
      stage_atual: stageAtual,
      pipeline_id: dealData.pipeline_id ? String(dealData.pipeline_id) : null,
      url_pipedrive: urlPipedrive,
      data_criacao: dealData.add_time || new Date().toISOString(),
      origem_canal: "OUTRO" as const,
      origem_campanha: dealData.origin || null,
      is_mql: isMql,
      levantou_mao: levantouMao,
      tem_reuniao: temReuniao,
      reuniao_realizada: reuniaoRealizada,
      venda_realizada: vendaRealizada,
      data_venda: vendaRealizada ? (dealData.won_time || dealData.update_time) : null,
      valor_venda: valorDeal,
      // Novos campos para rastreamento
      id_criativo: idCriativo,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    };

    console.log("Dados do lead a serem salvos:", JSON.stringify(leadData, null, 2));

    // Processar evento
    if (event === "deleted" || dealData.is_archived) {
      // Deal foi deletado - remover do banco
      const { error: deleteError } = await supabase
        .from("lead")
        .delete()
        .eq("id_lead_externo", String(dealData.id))
        .eq("id_empresa", idEmpresa);

      if (deleteError) {
        console.error("Erro ao deletar lead:", deleteError);
        throw deleteError;
      }

      console.log(`Lead ${dealData.id} deletado com sucesso`);
    } else {
      // Deal foi adicionado ou atualizado - upsert
      const { error: upsertError } = await supabase
        .from("lead")
        .upsert(leadData, { 
          onConflict: "id_lead_externo,id_empresa"
        });

      if (upsertError) {
        console.error("Erro ao salvar lead:", upsertError);
        throw upsertError;
      }

      console.log(`Lead ${dealData.id} processado com sucesso (${event})`);
    }

    return new Response(
      JSON.stringify({ 
        message: "Webhook processed successfully",
        event,
        deal_id: dealData.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    
    // Retornar 200 mesmo com erro para não fazer o Pipedrive retentar
    return new Response(
      JSON.stringify({ 
        message: "Webhook received but processing failed",
        error: String(error) 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
