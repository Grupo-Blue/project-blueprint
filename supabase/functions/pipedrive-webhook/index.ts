import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    console.log("📥 Webhook Pipedrive recebido:", JSON.stringify(payload, null, 2));

    // Suportar tanto API v1 quanto v2 do Pipedrive
    // v1: meta.object="deal", meta.id, payload.current
    // v2: meta.entity="deal", meta.entity_id, payload.data
    const entityType = payload.meta?.entity || payload.meta?.object;
    const isDeal =
      entityType === "deal" ||
      (payload.current && typeof payload.current.pipeline_id === "number") ||
      (payload.data && typeof payload.data.pipeline_id === "number");

    if (!isDeal) {
      console.log(`⚠️ Evento ignorado - tipo: ${entityType}, não é deal`);
      return new Response(
        JSON.stringify({ message: "Not a deal event, ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair dados do deal (v2 usa "data", v1 usa "current")
    const dealData = payload.current || payload.data;
    const dealId = dealData?.id || payload.meta?.entity_id || payload.meta?.id;

    if (!dealData || !dealId) {
      console.log("⚠️ Nenhum dado do deal encontrado no payload");
      return new Response(
        JSON.stringify({ message: "No deal data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detectar ação (v1 e v2)
    const event =
      payload.meta?.action ||
      (payload.event ? payload.event.split(".")[0] : "unknown");

    console.log(`📊 Evento: ${event}, Deal ID: ${dealId}, Entity Type: ${entityType}`);

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
      console.log(`Deal ${dealId} não pertence a nenhuma pipeline configurada (pipeline_id: ${dealData.pipeline_id})`);
      return new Response(
        JSON.stringify({ message: "Deal not in configured pipeline" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = targetIntegracao.config_json as any;
    const idEmpresa = targetIntegracao.id_empresa; // PHASE 2: usar coluna direta
    const domain = config.domain.replace('.pipedrive.com', '');

    console.log(`Processando deal ${dealId} para empresa ${idEmpresa}`);

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
    // IMPORTANTE: Hierarquia do funil - vendas ≤ reuniões ≤ levantadas ≤ MQLs ≤ leads
    // Construir de baixo para cima para garantir hierarquia correta
    
    // Mapeamento por pipeline:
    // Blue (pipeline 5): Lead → Contato Iniciado → Negociação → Aguardando pagamento → Vendido
    // Tokeniza (pipeline 9): Lead → Contato Iniciado → Contato Estabelecido → Apresentação → Cadastrado na Plataforma → Forecasting → Carteira
    
    // Stages que indicam REUNIÃO REALIZADA (nível 4)
    const stagesReuniaoRealizada = [
      // Blue
      "Aguardando pagamento",
      // Tokeniza  
      "Cadastrado na Plataforma",
      "Forecasting",
      "Carteira"
    ];
    
    // Stages que indicam TEM REUNIÃO (nível 3)
    const stagesTemReuniao = [
      // Blue
      "Negociação",
      "Aguardando pagamento",
      // Tokeniza
      "Apresentação",
      "Cadastrado na Plataforma",
      "Forecasting",
      "Carteira"
    ];
    
    // Stages que indicam LEVANTOU MÃO (nível 2)
    const stagesLevantouMao = [
      // Blue
      "Contato Iniciado",
      "Negociação", 
      "Aguardando pagamento",
      // Tokeniza
      "Contato Iniciado",
      "Contato Estabelecido",
      "Apresentação",
      "Cadastrado na Plataforma",
      "Forecasting",
      "Carteira"
    ];
    
    // Nível 5: Vendas (já calculado acima como vendaRealizada)
    
    // Nível 4: Reunião realizada (inclui todas as vendas)
    const reuniaoRealizada = (dealAberto && stageAtual && stagesReuniaoRealizada.includes(stageAtual)) || vendaRealizada;
    
    // Nível 3: Tem reunião agendada/em progresso (inclui reunião realizada)
    const temReuniao = (dealAberto && stageAtual && stagesTemReuniao.includes(stageAtual)) || reuniaoRealizada;
    
    // Nível 2: Levantou a mão (inclui todos que têm reunião)
    const levantouMao = (dealAberto && stageAtual && stagesLevantouMao.includes(stageAtual)) || temReuniao;
    
    // Nível 1: MQL (inclui todos que levantaram a mão)
    const isMql = (dealAberto && stageAtual && stageAtual !== "Lead") || levantouMao;
    
    const urlPipedrive = `https://${domain}.pipedrive.com/deal/${dealId}`;
    // IMPORTANTE: valor_venda só é registrado para deals GANHOS na pipeline configurada
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

    // Capturar email e telefone do contato (person)
    let personEmail = null;
    let personPhone = null;
    if (dealData.person_id) {
      try {
        console.log(`[Person] Buscando dados para person_id: ${dealData.person_id}`);
        // Buscar dados da pessoa via API do Pipedrive
        const personUrl = `https://${domain}.pipedrive.com/api/v1/persons/${dealData.person_id}?api_token=${apiToken}`;
        console.log(`[Person] URL da busca: ${personUrl.replace(apiToken, 'HIDDEN')}`);
        
        const personResponse = await fetch(personUrl);
        console.log(`[Person] Status da resposta: ${personResponse.status}`);
        
        if (personResponse.ok) {
          const personData = await personResponse.json();
          console.log(`[Person] Dados recebidos para ${dealData.person_name || 'pessoa'}`);
          
          if (personData.success && personData.data) {
            // Extrair EMAIL
            const emails = personData.data.email;
            if (emails) {
              if (Array.isArray(emails) && emails.length > 0) {
                personEmail = emails[0].value;
                console.log(`✓ Email capturado: ${personEmail}`);
              } else if (typeof emails === 'string') {
                personEmail = emails;
                console.log(`✓ Email capturado: ${personEmail}`);
              }
            } else {
              console.log(`⚠ Pessoa ${dealData.person_id} não tem email cadastrado`);
            }
            
            // Extrair TELEFONE (NOVO)
            const phones = personData.data.phone;
            if (phones) {
              if (Array.isArray(phones) && phones.length > 0) {
                // Normalizar para formato E.164 brasileiro
                const rawPhone = phones[0].value;
                if (rawPhone) {
                  const digits = rawPhone.replace(/\D/g, '');
                  if (digits.length === 11) {
                    personPhone = `+55${digits}`;
                  } else if (digits.length === 13 && digits.startsWith('55')) {
                    personPhone = `+${digits}`;
                  } else if (digits.length === 12 && digits.startsWith('55')) {
                    personPhone = `+${digits}`;
                  } else {
                    personPhone = rawPhone;
                  }
                  console.log(`✓ Telefone capturado: ${personPhone}`);
                }
              } else if (typeof phones === 'string') {
                personPhone = phones;
                console.log(`✓ Telefone capturado: ${personPhone}`);
              }
            } else {
              console.log(`⚠ Pessoa ${dealData.person_id} não tem telefone cadastrado`);
            }
          } else {
            console.log(`⚠ Resposta da API não contém dados válidos`);
          }
        } else {
          const errorText = await personResponse.text();
          console.error(`✗ Erro na API do Pipedrive: ${personResponse.status} - ${errorText}`);
        }
      } catch (personError) {
        console.error("✗ Erro ao buscar dados da pessoa:", personError);
        console.error("Stack trace:", personError instanceof Error ? personError.stack : personError);
      }
    } else {
      console.log(`⚠ Deal não tem person_id associado`);
    }

    // Tentar vincular ao criativo usando utm_content
    // utm_content pode conter o Ad ID (id_anuncio_externo) ou Creative ID (id_criativo_externo)
    // Também suporta formato híbrido Google Ads: "ID_texto"
    let idCriativo = null;
    if (utmContent) {
      try {
        // Extrair ID numérico se utm_content tem formato "ID_texto" (Google Ads)
        let utmContentParaMatch = utmContent;
        if (utmContent.includes('_')) {
          const partes = utmContent.split('_');
          if (/^\d+$/.test(partes[0])) {
            utmContentParaMatch = partes[0];
            console.log(`[utm_content] Formato híbrido detectado: "${utmContent}" → ID extraído: "${utmContentParaMatch}"`);
          }
        }
        
        // Prioridade 1: Buscar por Ad ID (id_anuncio_externo) - SEM filtro ativo
        const { data: criativoPorAdId } = await supabase
          .from("criativo")
          .select("id_criativo")
          .eq("id_anuncio_externo", utmContentParaMatch)
          .maybeSingle();
        
        if (criativoPorAdId) {
          idCriativo = criativoPorAdId.id_criativo;
          console.log(`✓ Criativo vinculado por Ad ID: ${idCriativo} (utm_content: ${utmContent})`);
        } else {
          // Prioridade 2: Buscar por Creative ID (id_criativo_externo) - SEM filtro ativo
          const { data: criativoPorCreativeId } = await supabase
            .from("criativo")
            .select("id_criativo")
            .eq("id_criativo_externo", utmContentParaMatch)
            .maybeSingle();
          
          if (criativoPorCreativeId) {
            idCriativo = criativoPorCreativeId.id_criativo;
            console.log(`✓ Criativo vinculado por Creative ID: ${idCriativo} (utm_content: ${utmContent})`);
          } else {
            console.log(`⚠️ Nenhum criativo encontrado para utm_content: ${utmContent} (buscado em id_anuncio_externo e id_criativo_externo)`);
          }
        }
      } catch (criativoError) {
        console.error("Erro ao buscar criativo:", criativoError);
      }
    }

    // CLASSIFICAÇÃO DE ORIGEM DO LEAD
    // Determinar se é lead pago baseado em UTM e id_criativo
    const determinarOrigem = (utmSrc: string | null, idCriat: string | null): string => {
      if (idCriat) return 'PAGO';
      if (!utmSrc) return 'MANUAL';
      
      const source = utmSrc.toLowerCase();
      if (['facebook', 'meta', 'fb', 'google', 'ads', 'ig', 'instagram'].some(s => source.includes(s))) {
        return 'PAGO';
      }
      if (['email', 'mail'].some(s => source.includes(s))) {
        return 'ORGANICO';
      }
      return 'MANUAL';
    };

    const origemTipo = determinarOrigem(utmSource, idCriativo);
    const leadPago = origemTipo === 'PAGO';
    
    console.log(`[Origem] Tipo: ${origemTipo}, Lead Pago: ${leadPago} (utm_source: ${utmSource}, id_criativo: ${idCriativo})`);

    // Buscar lead existente - PRIORIDADE: 
    // 1. Por id_lead_externo (deal ID do Pipedrive) 
    // 2. Por email (mesmo contato, deal diferente)
    let existingLead = null;
    
    // Primeiro: buscar por deal ID exato
    const { data: leadByDealId } = await supabase
      .from("lead")
      .select("id_lead, id_lead_externo, is_mql, levantou_mao, tem_reuniao, reuniao_realizada, venda_realizada, data_mql, data_levantou_mao, data_reuniao")
      .eq("id_lead_externo", String(dealId))
      .eq("id_empresa", idEmpresa)
      .eq("merged", false)
      .maybeSingle();
    
    if (leadByDealId) {
      existingLead = leadByDealId;
      console.log(`[Lookup] Lead encontrado por deal ID: ${existingLead.id_lead}`);
    } else if (personEmail) {
      // Segundo: buscar por email (evita duplicatas para mesmo contato com deals diferentes)
      const { data: leadByEmail } = await supabase
        .from("lead")
        .select("id_lead, id_lead_externo, is_mql, levantou_mao, tem_reuniao, reuniao_realizada, venda_realizada, data_mql, data_levantou_mao, data_reuniao")
        .ilike("email", personEmail)
        .eq("id_empresa", idEmpresa)
        .eq("merged", false)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (leadByEmail) {
        existingLead = leadByEmail;
        console.log(`[Lookup] Lead encontrado por email ${personEmail}: ${existingLead.id_lead} (deal original: ${existingLead.id_lead_externo}, novo deal: ${dealId})`);
      }
    }

    const agora = new Date().toISOString();

    // Capturar datas de transição - só atualiza se mudou para TRUE e não tinha data antes
    let dataMql = existingLead?.data_mql || null;
    let dataLevantouMao = existingLead?.data_levantou_mao || null;
    let dataReuniao = existingLead?.data_reuniao || null;

    // Se acabou de virar MQL (não era MQL antes, agora é)
    if (isMql && !existingLead?.is_mql && !dataMql) {
      dataMql = agora;
      console.log(`[Transição] Lead ${dealId} virou MQL em ${agora}`);
    }

    // Se acabou de levantar a mão
    if (levantouMao && !existingLead?.levantou_mao && !dataLevantouMao) {
      dataLevantouMao = agora;
      console.log(`[Transição] Lead ${dealId} levantou a mão em ${agora}`);
    }

    // Se acabou de ter reunião (tem_reuniao ou reuniao_realizada)
    if ((temReuniao || reuniaoRealizada) && !existingLead?.tem_reuniao && !existingLead?.reuniao_realizada && !dataReuniao) {
      dataReuniao = agora;
      console.log(`[Transição] Lead ${dealId} tem reunião em ${agora}`);
    }

    // Capturar owner do deal
    let ownerName: string | null = null;
    let ownerId: string | null = null;
    if (dealData.user_id) {
      ownerId = String(dealData.user_id);
      try {
        const ownerUrl = `https://${domain}.pipedrive.com/api/v1/users/${dealData.user_id}?api_token=${apiToken}`;
        const ownerResponse = await fetch(ownerUrl);
        if (ownerResponse.ok) {
          const ownerData = await ownerResponse.json();
          if (ownerData.success && ownerData.data) {
            ownerName = ownerData.data.name;
            console.log(`[Owner] ${ownerName} (ID: ${ownerId})`);
          }
        }
      } catch (ownerError) {
        console.error("[Owner] Erro ao buscar owner:", ownerError);
      }
    }

    // Capturar motivo de perda
    const motivoPerda = dealPerdido ? (dealData.lost_reason || null) : null;
    if (motivoPerda) {
      console.log(`[Perda] Motivo: ${motivoPerda}`);
    }

    const leadData = {
      id_empresa: idEmpresa,
      id_lead_externo: String(dealId),
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
      // IMPORTANTE: valor_venda só é preenchido para deals GANHOS da pipeline configurada
      valor_venda: vendaRealizada ? valorDeal : null,
      // Email e telefone capturados
      email: personEmail,
      telefone: personPhone,
      // Novos campos para rastreamento
      id_criativo: idCriativo,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      // NOVO: Classificação de origem
      origem_tipo: origemTipo,
      lead_pago: leadPago,
      // FASE 3: Datas de transição para tempo de ciclo
      data_mql: dataMql,
      data_levantou_mao: dataLevantouMao,
      data_reuniao: dataReuniao,
      // V3: Owner e motivo de perda
      proprietario_nome: ownerName,
      proprietario_id: ownerId,
      motivo_perda: motivoPerda,
    };

    console.log("Dados do lead a serem salvos:", JSON.stringify(leadData, null, 2));

    // Processar evento
    if (event === "deleted" || dealData.is_archived) {
      // Deal foi deletado - remover do banco
      const { error: deleteError } = await supabase
        .from("lead")
        .delete()
        .eq("id_lead_externo", String(dealId))
        .eq("id_empresa", idEmpresa);

      if (deleteError) {
        console.error("Erro ao deletar lead:", deleteError);
        throw deleteError;
      }

      console.log(`Lead ${dealId} deletado com sucesso`);
    } else {
      // Deal foi adicionado ou atualizado
      let savedLeadId: string | null = null;
      
      if (existingLead) {
        // Lead já existe (por deal ID ou email) - UPDATE
        const { error: updateError } = await supabase
          .from("lead")
          .update({
            ...leadData,
            // Se encontrado por email com deal diferente, manter o id_lead_externo original
            // mas atualizar todos os outros campos com dados mais recentes
            id_lead_externo: existingLead.id_lead_externo, // Manter original
          })
          .eq("id_lead", existingLead.id_lead);

        if (updateError) {
          console.error("Erro ao atualizar lead:", updateError);
          throw updateError;
        }
        
        savedLeadId = existingLead.id_lead;
        console.log(`Lead ${existingLead.id_lead} ATUALIZADO com dados do deal ${dealId}`);
      } else {
        // Lead não existe - INSERT
        const { data: newLead, error: insertError } = await supabase
          .from("lead")
          .insert(leadData)
          .select('id_lead')
          .single();

        if (insertError) {
          // Verificar se é erro de duplicata (race condition)
          if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
            console.log('[Pipedrive] Erro de duplicata detectado, buscando lead existente...');
            
            // Buscar lead que foi criado por outro request
            const { data: duplicateLead } = await supabase
              .from("lead")
              .select("id_lead")
              .ilike("email", personEmail || '')
              .eq("id_empresa", idEmpresa)
              .eq("merged", false)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            
            if (duplicateLead) {
              savedLeadId = duplicateLead.id_lead;
              console.log(`[Pipedrive] Lead encontrado após erro de duplicata: ${savedLeadId}`);
            } else {
              throw insertError;
            }
          } else {
            console.error("Erro ao criar lead:", insertError);
            throw insertError;
          }
        } else {
          savedLeadId = newLead.id_lead;
          console.log(`Lead ${savedLeadId} CRIADO para deal ${dealId}`);
        }
      }

      console.log(`Lead ${dealId} processado com sucesso (${event})`);
      
      // Usar savedLeadId para o resto do processamento
      const upsertedLead = savedLeadId ? { id_lead: savedLeadId } : null;

      // FASE 3: Registrar eventos de transição em lead_evento para histórico
      const eventosParaInserir = [];
      
      // Verificar se houve mudança de stage
      const previousStage = payload.previous?.stage_id;
      const currentStage = dealData.stage_id;
      
      if (previousStage !== currentStage && stageAtual && upsertedLead) {
        eventosParaInserir.push({
          id_lead: upsertedLead.id_lead,
          etapa: stageAtual,
          data_evento: agora,
          observacao: previousStage 
            ? `Transição de stage ${previousStage} para ${stageAtual}`
            : `Criado em ${stageAtual}`
        });
      }

      // Registrar transições de funil
      if (isMql && !existingLead?.is_mql && upsertedLead) {
        eventosParaInserir.push({
          id_lead: upsertedLead.id_lead,
          etapa: "MQL",
          data_evento: dataMql || agora,
          observacao: "Lead qualificado como MQL"
        });
      }
      
      if (levantouMao && !existingLead?.levantou_mao && upsertedLead) {
        eventosParaInserir.push({
          id_lead: upsertedLead.id_lead,
          etapa: "Levantou Mão",
          data_evento: dataLevantouMao || agora,
          observacao: "Lead levantou a mão / demonstrou interesse"
        });
      }
      
      if ((temReuniao || reuniaoRealizada) && !existingLead?.tem_reuniao && !existingLead?.reuniao_realizada && upsertedLead) {
        eventosParaInserir.push({
          id_lead: upsertedLead.id_lead,
          etapa: reuniaoRealizada ? "Reunião Realizada" : "Reunião Agendada",
          data_evento: dataReuniao || agora,
          observacao: reuniaoRealizada ? "Reunião realizada" : "Reunião agendada"
        });
      }
      
      if (vendaRealizada && !existingLead?.venda_realizada && upsertedLead) {
        eventosParaInserir.push({
          id_lead: upsertedLead.id_lead,
          etapa: "Venda",
          data_evento: leadData.data_venda || agora,
          observacao: `Venda realizada - ${valorDeal ? `R$ ${valorDeal.toFixed(2)}` : 'valor não informado'}`
        });

        // NOVO: Disparar Meta CAPI Purchase (fire-and-forget)
        supabase.functions.invoke("disparar-meta-capi-venda", {
          body: { id_lead: upsertedLead.id_lead },
        }).then((res: any) => {
          console.log(`[CAPI] Purchase disparado para lead ${upsertedLead.id_lead}:`, res.data);
        }).catch((err: any) => {
          console.warn(`[CAPI] Erro ao disparar Purchase para lead ${upsertedLead.id_lead}:`, err);
        });
      }

      // Inserir eventos em lote
      if (eventosParaInserir.length > 0) {
        const { error: eventosError } = await supabase
          .from("lead_evento")
          .insert(eventosParaInserir);

        if (eventosError) {
          console.error("Erro ao inserir eventos de transição:", eventosError);
        } else {
          console.log(`[Transição] ${eventosParaInserir.length} eventos registrados para lead ${dealId}`);
        }
      }

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
              
              // Segunda tentativa de match com criativo usando utm_content do Mautic
              if (!idCriativo) {
                try {
                  const mauticUtmContent = mauticData.utm_content_mautic;
                  
                  // Buscar por Ad ID primeiro
                  const { data: criativoPorAdId } = await supabase
                    .from("criativo")
                    .select("id_criativo")
                    .eq("id_anuncio_externo", mauticUtmContent)
                    .eq("ativo", true)
                    .maybeSingle();
                  
                  if (criativoPorAdId) {
                    updateData.id_criativo = criativoPorAdId.id_criativo;
                    console.log(`[Mautic] Criativo vinculado por Ad ID (fallback): ${criativoPorAdId.id_criativo}`);
                  } else {
                    // Buscar por Creative ID
                    const { data: criativoPorCreativeId } = await supabase
                      .from("criativo")
                      .select("id_criativo")
                      .eq("id_criativo_externo", mauticUtmContent)
                      .eq("ativo", true)
                      .maybeSingle();
                    
                    if (criativoPorCreativeId) {
                      updateData.id_criativo = criativoPorCreativeId.id_criativo;
                      console.log(`[Mautic] Criativo vinculado por Creative ID (fallback): ${criativoPorCreativeId.id_criativo}`);
                    }
                  }
                } catch (matchError) {
                  console.error('[Mautic] Erro ao buscar criativo com fallback:', matchError);
                }
              }
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
              console.log(`[Mautic] Lead ${dealId} enriquecido com sucesso`);
            }
          } else {
            console.log('[Mautic] Enriquecimento não retornou dados:', enrichmentData);
          }
        } catch (mauticError) {
          console.error('[Mautic] Erro no processo de enriquecimento:', mauticError);
          // Não falhar o webhook se o enriquecimento falhar
        }

        // Enriquecer lead com dados do Tokeniza (cross-company)
        try {
          console.log(`[Tokeniza] Iniciando enriquecimento para ${personEmail}`);
          
          const { data: tokenizaData, error: tokenizaError } = await supabase.functions.invoke(
            'enriquecer-leads-tokeniza',
            {
              body: { email: personEmail }
            }
          );

          if (tokenizaError) {
            console.error('[Tokeniza] Erro ao chamar função de enriquecimento:', tokenizaError);
          } else if (tokenizaData?.success) {
            console.log(`[Tokeniza] Lead enriquecido: investidor=${tokenizaData.totalInvestidores > 0}, valor=R$ ${tokenizaData.totalEnriquecidos}`);
          } else {
            console.log('[Tokeniza] Enriquecimento não retornou sucesso:', tokenizaData);
          }
        } catch (tokenizaError) {
          console.error('[Tokeniza] Erro no processo de enriquecimento:', tokenizaError);
          // Não falhar o webhook se o enriquecimento falhar
        }

        // Disparar webhook de saída imediatamente após enriquecimento
        try {
          console.log(`[Webhook] Disparando webhook de saída para lead ${upsertedLead.id_lead}`);
          
          const { error: webhookError } = await supabase.functions.invoke(
            'disparar-webhook-leads',
            {
              body: { 
                lead_ids: [upsertedLead.id_lead],
                evento: event === 'added' ? 'lead_criado' : 'lead_atualizado'
              }
            }
          );

          if (webhookError) {
            console.error('[Webhook] Erro ao disparar webhook de saída:', webhookError);
          } else {
            console.log(`[Webhook] Webhook de saída disparado para lead ${upsertedLead.id_lead}`);
          }
        } catch (webhookDispatchError) {
          console.error('[Webhook] Erro ao disparar webhook:', webhookDispatchError);
          // Não falhar o webhook se o disparo falhar
        }
      } else if (!personEmail) {
        console.log('[Mautic/Tokeniza] Email não disponível, enriquecimento pulado');
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Webhook processed successfully",
        event,
        deal_id: dealId
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
