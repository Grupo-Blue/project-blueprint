import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento hardcoded de domínios conhecidos -> id_empresa
const DOMAIN_EMPRESA_MAP: Record<string, string> = {
  "blueconsult.com.br": "61b5ffeb-fbbc-47c1-8ced-152bb647ed20",
  "tokeniza.com.br": "c4520f22-1be4-4483-bfe4-1787b4410f8b",
};

async function inferirEmpresa(
  supabase: any,
  pageLocation: string | null,
  idEmpresaPayload: string | null
): Promise<string | null> {
  // Se veio no payload, usar direto
  if (idEmpresaPayload) return idEmpresaPayload;
  if (!pageLocation) return null;

  try {
    const url = new URL(pageLocation);
    const hostname = url.hostname.replace("www.", "");

    // 1. Buscar na empresa_stape_config pelo domínio da container_url
    const { data: configs } = await supabase
      .from("empresa_stape_config")
      .select("id_empresa, stape_container_url")
      .eq("ativo", true);

    if (configs) {
      for (const config of configs) {
        if (config.stape_container_url) {
          try {
            const containerHost = new URL(config.stape_container_url).hostname.replace("www.", "");
            if (hostname === containerHost || hostname.endsWith(`.${containerHost}`)) {
              console.log(`🏢 Empresa inferida por container_url: ${config.id_empresa}`);
              return config.id_empresa;
            }
          } catch {}
        }
      }
    }

    // 2. Buscar nas landing pages cadastradas na conta_anuncio -> empresa
    // Fallback: mapeamento hardcoded
    for (const [domain, empresaId] of Object.entries(DOMAIN_EMPRESA_MAP)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        console.log(`🏢 Empresa inferida por domínio hardcoded (${domain}): ${empresaId}`);
        return empresaId;
      }
    }
  } catch (e) {
    console.warn("⚠️ Erro ao inferir empresa do page_location:", e);
  }

  return null;
}

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

    // Verificar se é um evento de teste
    if (payload.test === true) {
      console.log("✅ Evento de teste recebido com sucesso");
      return new Response(
        JSON.stringify({ success: true, message: "Webhook de teste recebido com sucesso", test: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      client_id,
      session_id,
      event_name = "page_view",
      page_location,
      page_title,
      user_data,
      custom_data,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbp, fbc, gclid,
      ip_address, user_agent, referrer,
      email, phone,
      id_empresa,
    } = payload;

    if (!client_id) {
      console.warn("⚠️ Evento sem client_id, ignorando");
      return new Response(
        JSON.stringify({ error: "client_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inferir id_empresa se não veio no payload
    const empresaInferida = await inferirEmpresa(supabase, page_location, id_empresa);
    if (!id_empresa && empresaInferida) {
      console.log(`🏢 Empresa inferida automaticamente: ${empresaInferida}`);
    }

    // 1. Inserir evento na tabela stape_evento
    const { data: eventoInserido, error: eventoError } = await supabase
      .from("stape_evento")
      .insert({
        client_id, session_id, event_name,
        page_url: page_location, page_title,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        fbp, fbc, gclid, ip_address, user_agent,
        custom_data: custom_data || user_data,
        id_empresa: empresaInferida,
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
    
    // Estratégia 1: Buscar por email ou telefone
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

      if (empresaInferida) {
        leadQuery = leadQuery.eq("id_empresa", empresaInferida);
      }

      const { data: leads } = await leadQuery.limit(1);

      if (leads && leads.length > 0) {
        leadVinculado = leads[0];
        console.log("🔗 Lead encontrado por email/telefone:", leadVinculado.id_lead);
      }
    }

    // Estratégia 2: Buscar por client_id existente
    if (!leadVinculado) {
      const { data: leadsComClientId } = await supabase
        .from("lead")
        .select("id_lead, stape_client_id, stape_first_visit")
        .eq("stape_client_id", client_id)
        .limit(1);

      if (leadsComClientId && leadsComClientId.length > 0) {
        leadVinculado = leadsComClientId[0];
        console.log("🔗 Lead encontrado por client_id:", leadVinculado.id_lead);
      }
    }

    // Estratégia 3 (NOVA): Buscar por FBP
    if (!leadVinculado && fbp) {
      let fbpQuery = supabase
        .from("lead")
        .select("id_lead, stape_client_id, stape_first_visit")
        .eq("fbp", fbp);

      if (empresaInferida) {
        fbpQuery = fbpQuery.eq("id_empresa", empresaInferida);
      }

      const { data: leadsPorFbp } = await fbpQuery.limit(1);

      if (leadsPorFbp && leadsPorFbp.length > 0) {
        leadVinculado = leadsPorFbp[0];
        console.log("🔗 Lead encontrado por FBP:", leadVinculado.id_lead);
      }
    }

    // Atualizar lead vinculado com dados Stape
    if (leadVinculado && eventoInserido) {
      await supabase
        .from("stape_evento")
        .update({ id_lead: leadVinculado.id_lead })
        .eq("id", eventoInserido.id);

      const updateData: Record<string, any> = {
        stape_session_id: session_id,
        stape_last_activity: new Date().toISOString(),
      };

      if (!leadVinculado.stape_client_id) updateData.stape_client_id = client_id;
      if (!leadVinculado.stape_first_visit) updateData.stape_first_visit = new Date().toISOString();
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

    const duracao = Date.now() - startTime;

    // Log de execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-webhook",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        event_name, client_id,
        lead_vinculado: leadVinculado?.id_lead || null,
        has_email: !!emailLimpo, has_phone: !!telefoneLimpo,
        has_fbp: !!fbp,
        empresa_inferida: empresaInferida,
        empresa_payload: !!id_empresa,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        evento_id: eventoInserido?.id,
        lead_vinculado: leadVinculado?.id_lead,
        empresa_inferida: empresaInferida,
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
