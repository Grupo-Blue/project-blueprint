import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("📥 Stape webhook recebido:", JSON.stringify(payload, null, 2));

    // Extrair dados do evento GTM Server
    const {
      client_id,
      session_id,
      event_name = "page_view",
      page_location,
      page_title,
      user_data,
      custom_data,
      // UTMs
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      // IDs de plataforma
      fbp, // Facebook Browser ID
      fbc, // Facebook Click ID  
      gclid, // Google Click ID
      // Dados de contexto
      ip_address,
      user_agent,
      referrer,
      // Email/telefone para match
      email,
      phone,
      // Empresa (se enviada)
      id_empresa,
    } = payload;

    if (!client_id) {
      console.warn("⚠️ Evento sem client_id, ignorando");
      return new Response(
        JSON.stringify({ error: "client_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Inserir evento na tabela stape_evento
    const { data: eventoInserido, error: eventoError } = await supabase
      .from("stape_evento")
      .insert({
        client_id,
        session_id,
        event_name,
        page_url: page_location,
        page_title,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        fbp,
        fbc,
        gclid,
        ip_address,
        user_agent,
        custom_data: custom_data || user_data,
        id_empresa,
      })
      .select()
      .single();

    if (eventoError) {
      console.error("❌ Erro ao inserir evento:", eventoError);
    } else {
      console.log("✅ Evento inserido:", eventoInserido.id);
    }

    // 2. Tentar vincular ao lead existente
    let leadVinculado = null;
    
    // Primeiro, buscar por email ou telefone
    const emailLimpo = email?.toLowerCase().trim();
    const telefoneLimpo = phone?.replace(/\D/g, "");

    if (emailLimpo || telefoneLimpo) {
      let leadQuery = supabase.from("lead").select("id_lead, email, telefone, stape_client_id, stape_first_visit");
      
      if (emailLimpo && telefoneLimpo) {
        leadQuery = leadQuery.or(`email.ilike.${emailLimpo},telefone.ilike.%${telefoneLimpo}%`);
      } else if (emailLimpo) {
        leadQuery = leadQuery.ilike("email", emailLimpo);
      } else if (telefoneLimpo) {
        leadQuery = leadQuery.ilike("telefone", `%${telefoneLimpo}%`);
      }

      if (id_empresa) {
        leadQuery = leadQuery.eq("id_empresa", id_empresa);
      }

      const { data: leads } = await leadQuery.limit(1);

      if (leads && leads.length > 0) {
        leadVinculado = leads[0];
        console.log("🔗 Lead encontrado para vincular:", leadVinculado.id_lead);

        // Atualizar o evento com o id_lead
        await supabase
          .from("stape_evento")
          .update({ id_lead: leadVinculado.id_lead })
          .eq("id", eventoInserido?.id);

        // Atualizar o lead com dados Stape (se ainda não tem)
        const updateData: Record<string, any> = {};
        
        if (!leadVinculado.stape_client_id) {
          updateData.stape_client_id = client_id;
        }
        
        updateData.stape_session_id = session_id;
        updateData.stape_last_activity = new Date().toISOString();
        
        if (!leadVinculado.stape_first_visit) {
          updateData.stape_first_visit = new Date().toISOString();
        }
        
        if (fbp) updateData.stape_fbp = fbp;
        if (fbc) updateData.stape_fbc = fbc;
        if (gclid) updateData.stape_gclid = gclid;
        if (ip_address) updateData.stape_ip_address = ip_address;
        if (user_agent) updateData.stape_user_agent = user_agent;
        if (referrer) updateData.stape_referrer = referrer;

        const { error: updateError } = await supabase
          .from("lead")
          .update(updateData)
          .eq("id_lead", leadVinculado.id_lead);

        if (updateError) {
          console.error("❌ Erro ao atualizar lead:", updateError);
        } else {
          console.log("✅ Lead atualizado com dados Stape");
        }
      }
    }

    // 3. Se não encontrou por email/telefone, tentar por client_id existente
    if (!leadVinculado) {
      const { data: leadsComClientId } = await supabase
        .from("lead")
        .select("id_lead")
        .eq("stape_client_id", client_id)
        .limit(1);

      if (leadsComClientId && leadsComClientId.length > 0) {
        leadVinculado = leadsComClientId[0];
        console.log("🔗 Lead encontrado por client_id:", leadVinculado.id_lead);

        // Atualizar evento com id_lead
        await supabase
          .from("stape_evento")
          .update({ id_lead: leadVinculado.id_lead })
          .eq("id", eventoInserido?.id);

        // Atualizar última atividade
        await supabase
          .from("lead")
          .update({
            stape_session_id: session_id,
            stape_last_activity: new Date().toISOString(),
          })
          .eq("id_lead", leadVinculado.id_lead);
      }
    }

    const duracao = Date.now() - startTime;

    // Log de execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-webhook",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        event_name,
        client_id,
        lead_vinculado: leadVinculado?.id_lead || null,
        has_email: !!emailLimpo,
        has_phone: !!telefoneLimpo,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        evento_id: eventoInserido?.id,
        lead_vinculado: leadVinculado?.id_lead,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no stape-webhook:", error);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-webhook",
      status: "erro",
      mensagem_erro: errorMessage,
      duracao_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
