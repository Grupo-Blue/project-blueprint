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
    
    // Buscar nome do stage atual
    let stageAtual = null;
    if (dealPerdido) {
      stageAtual = "Perdido";
    } else if (dealData.stage_id && stagesMap[dealData.stage_id]) {
      stageAtual = stagesMap[dealData.stage_id];
    }
    
    // Calcular flags de funil baseado no NOME do stage (não no ID numérico)
    const levantouMao = dealAberto && stageAtual && [
      "Contato Iniciado",
      "Negociação", 
      "Aguardando pagamento"
    ].includes(stageAtual);
    
    const temReuniao = dealAberto && stageAtual && [
      "Negociação",
      "Aguardando pagamento"
    ].includes(stageAtual);
    
    const reuniaoRealizada = dealAberto && stageAtual && [
      "Aguardando pagamento"
    ].includes(stageAtual);
    
    // MQL: qualquer stage além de "Lead" inicial, ou se levantou a mão
    const isMql = (dealAberto && stageAtual && stageAtual !== "Lead") || levantouMao;
    
    const urlPipedrive = `https://${domain}.pipedrive.com/deal/${dealData.id}`;
    const valorDeal = dealData.value ? parseFloat(dealData.value) : null;

    // IDs dos campos customizados do Pipedrive para UTMs
    const PIPEDRIVE_FIELD_IDS = {
      utm_source: "921388ca610b1d32c1d88692c831a1e247eb5831",
      utm_medium: "e68861332446a8d4de1a8a1332bafd033e1e7ec8",
      utm_campaign: "e0b37f3266054dd44a5889ce7e53f44c20e5067a",
      utm_content: "789859d10eb211851c1a6d1c35a82f45f155667b",
      utm_term: "01678645f979eaae54857aab0418ab42fcfd91a4",
    };

    console.log("IDs dos campos UTM mapeados:", PIPEDRIVE_FIELD_IDS);

    // Capturar UTM parameters dos campos customizados do Pipedrive
    const customFields = dealData.custom_fields || {};
    
    // Função auxiliar para extrair valor de campo customizado
    const extractCustomFieldValue = (fieldKey: string | null) => {
      if (!fieldKey) return null;
      
      const fieldValue = customFields[fieldKey];
      if (!fieldValue) return null;
      
      // Pipedrive pode retornar diferentes estruturas
      if (typeof fieldValue === 'string') return fieldValue;
      if (typeof fieldValue === 'object' && fieldValue.value !== undefined) {
        return fieldValue.value;
      }
      return null;
    };
    
    // Extrair UTM parameters
    const utmSource = extractCustomFieldValue(PIPEDRIVE_FIELD_IDS.utm_source);
    const utmMedium = extractCustomFieldValue(PIPEDRIVE_FIELD_IDS.utm_medium);
    const utmCampaign = extractCustomFieldValue(PIPEDRIVE_FIELD_IDS.utm_campaign);
    const utmContent = extractCustomFieldValue(PIPEDRIVE_FIELD_IDS.utm_content);
    const utmTerm = extractCustomFieldValue(PIPEDRIVE_FIELD_IDS.utm_term);

    console.log("UTM Parameters capturados:", { utmSource, utmMedium, utmCampaign, utmContent, utmTerm });

    // Capturar email do contato (person)
    let personEmail = null;
    if (dealData.person_id) {
      try {
        console.log(`[Email] Buscando email para person_id: ${dealData.person_id}`);
        // Buscar dados da pessoa via API do Pipedrive
        const personUrl = `https://${domain}.pipedrive.com/api/v1/persons/${dealData.person_id}?api_token=${apiToken}`;
        console.log(`[Email] URL da busca: ${personUrl.replace(apiToken, 'HIDDEN')}`);
        
        const personResponse = await fetch(personUrl);
        console.log(`[Email] Status da resposta: ${personResponse.status}`);
        
        if (personResponse.ok) {
          const personData = await personResponse.json();
          console.log(`[Email] Dados da pessoa recebidos:`, JSON.stringify(personData, null, 2));
          
          if (personData.success && personData.data) {
            const emails = personData.data.email;
            console.log(`[Email] Campo email bruto:`, emails);
            
            if (emails) {
              if (Array.isArray(emails) && emails.length > 0) {
                personEmail = emails[0].value;
                console.log(`✓ Email capturado do array: ${personEmail}`);
              } else if (typeof emails === 'string') {
                personEmail = emails;
                console.log(`✓ Email capturado como string: ${personEmail}`);
              } else {
                console.log(`⚠ Email em formato não reconhecido:`, typeof emails, emails);
              }
            } else {
              console.log(`⚠ Pessoa ${dealData.person_id} não tem email cadastrado no Pipedrive`);
            }
          } else {
            console.log(`⚠ Resposta da API não contém dados válidos`);
          }
        } else {
          const errorText = await personResponse.text();
          console.error(`✗ Erro na API do Pipedrive: ${personResponse.status} - ${errorText}`);
        }
      } catch (emailError) {
        console.error("✗ Erro ao buscar email da pessoa:", emailError);
        console.error("Stack trace:", emailError instanceof Error ? emailError.stack : emailError);
      }
    } else {
      console.log(`⚠ Deal não tem person_id associado`);
    }

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
      // Email capturado
      email: personEmail,
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
      const { data: upsertedLead, error: upsertError } = await supabase
        .from("lead")
        .upsert(leadData, { 
          onConflict: "id_lead_externo,id_empresa"
        })
        .select('id_lead')
        .single();

      if (upsertError) {
        console.error("Erro ao salvar lead:", upsertError);
        throw upsertError;
      }

      console.log(`Lead ${dealData.id} processado com sucesso (${event})`);

      // Enriquecer lead com dados do Mautic (se email disponível)
      if (personEmail && upsertedLead) {
        console.log(`[Mautic] Iniciando enriquecimento para ${personEmail}`);
        
        try {
          const { data: enrichmentData, error: enrichmentError } = await supabase.functions.invoke(
            'enriquecer-lead-mautic',
            {
              body: { email: personEmail, id_empresa: idEmpresa }
            }
          );

          if (enrichmentError) {
            console.error('[Mautic] Erro ao chamar função de enriquecimento:', enrichmentError);
          } else if (enrichmentData?.success && enrichmentData?.data) {
            console.log('[Mautic] Dados de enriquecimento recebidos:', enrichmentData.data);
            
            const mauticData = enrichmentData.data;
            
            // Lógica de qualificação MQL: Score >= 50 OU PageHits >= 10 OU levantou_mao
            const score = mauticData.mautic_score || 0;
            const pageHits = mauticData.mautic_page_hits || 0;
            const isMqlMautic = score >= 50 || pageHits >= 10 || leadData.levantou_mao;
            
            console.log(`[Webhook] Qualificação MQL - Score: ${score}, PageHits: ${pageHits}, levantou_mao: ${leadData.levantou_mao}, is_mql: ${isMqlMautic}`);
            
            // Implementar fallback de UTMs: usar Mautic se Pipedrive não forneceu
            const updateData: any = {
              id_mautic_contact: mauticData.id_mautic_contact,
              mautic_score: mauticData.mautic_score,
              mautic_page_hits: mauticData.mautic_page_hits,
              mautic_last_active: mauticData.mautic_last_active,
              mautic_first_visit: mauticData.mautic_first_visit,
              mautic_tags: mauticData.mautic_tags,
              mautic_segments: mauticData.mautic_segments,
              cidade_mautic: mauticData.cidade_mautic,
              estado_mautic: mauticData.estado_mautic,
              is_mql: isMqlMautic,
            };

            // Fallback de UTMs: se Pipedrive não tem, usar do Mautic
            if (!utmSource && mauticData.utm_source_mautic) {
              updateData.utm_source = mauticData.utm_source_mautic;
              console.log('[Mautic] Fallback utm_source:', mauticData.utm_source_mautic);
            }
            if (!utmMedium && mauticData.utm_medium_mautic) {
              updateData.utm_medium = mauticData.utm_medium_mautic;
              console.log('[Mautic] Fallback utm_medium:', mauticData.utm_medium_mautic);
            }
            if (!utmCampaign && mauticData.utm_campaign_mautic) {
              updateData.utm_campaign = mauticData.utm_campaign_mautic;
              console.log('[Mautic] Fallback utm_campaign:', mauticData.utm_campaign_mautic);
            }
            if (!utmContent && mauticData.utm_content_mautic) {
              updateData.utm_content = mauticData.utm_content_mautic;
              console.log('[Mautic] Fallback utm_content:', mauticData.utm_content_mautic);
            }
            if (!utmTerm && mauticData.utm_term_mautic) {
              updateData.utm_term = mauticData.utm_term_mautic;
              console.log('[Mautic] Fallback utm_term:', mauticData.utm_term_mautic);
            }

            // Atualizar lead com dados enriquecidos
            const { error: updateError } = await supabase
              .from('lead')
              .update(updateData)
              .eq('id_lead', upsertedLead.id_lead);

            if (updateError) {
              console.error('[Mautic] Erro ao atualizar lead com dados enriquecidos:', updateError);
            } else {
              console.log(`[Mautic] Lead ${dealData.id} enriquecido com sucesso`);
            }
          } else {
            console.log('[Mautic] Enriquecimento não retornou dados:', enrichmentData);
          }
        } catch (mauticError) {
          console.error('[Mautic] Erro no processo de enriquecimento:', mauticError);
          // Não falhar o webhook se o enriquecimento falhar
        }
      } else if (!personEmail) {
        console.log('[Mautic] Email não disponível, enriquecimento pulado');
      }
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
