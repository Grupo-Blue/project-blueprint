import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para hash SHA-256 (Meta CAPI requer dados hasheados)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
    console.log("📥 Meta CAPI request:", JSON.stringify(payload, null, 2));

    const {
      event_name,
      event_time,
      event_source_url,
      action_source = "website",
      // User data
      email,
      phone,
      first_name,
      last_name,
      city,
      state,
      country = "br",
      external_id,
      client_ip_address,
      client_user_agent,
      fbp,
      fbc,
      // Custom data
      currency = "BRL",
      value,
      content_name,
      content_category,
      content_ids,
      content_type,
      // Para deduplicação
      event_id,
      // Empresa para buscar credenciais
      id_empresa,
    } = payload;

    if (!event_name) {
      return new Response(
        JSON.stringify({ error: "event_name é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais Meta da empresa (se id_empresa fornecido)
    let META_PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    let META_CAPI_TOKEN = Deno.env.get("META_CAPI_TOKEN");

    if (id_empresa) {
      const { data: config } = await supabase
        .from("empresa_stape_config")
        .select("meta_pixel_id, meta_capi_token")
        .eq("id_empresa", id_empresa)
        .eq("ativo", true)
        .maybeSingle();

      if (config?.meta_pixel_id && config?.meta_capi_token) {
        META_PIXEL_ID = config.meta_pixel_id;
        META_CAPI_TOKEN = config.meta_capi_token;
      }
    }

    if (!META_PIXEL_ID || !META_CAPI_TOKEN) {
      console.error("❌ META_PIXEL_ID ou META_CAPI_TOKEN não configurados");
      return new Response(
        JSON.stringify({ error: "Meta CAPI não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preparar user_data (com hash quando necessário)
    const userData: Record<string, any> = {};

    if (email) userData.em = [await sha256(email)];
    if (phone) userData.ph = [await sha256(phone.replace(/\D/g, ""))];
    if (first_name) userData.fn = [await sha256(first_name)];
    if (last_name) userData.ln = [await sha256(last_name)];
    if (city) userData.ct = [await sha256(city)];
    if (state) userData.st = [await sha256(state)];
    if (country) userData.country = [await sha256(country)];
    if (external_id) userData.external_id = [await sha256(external_id)];
    if (client_ip_address) userData.client_ip_address = client_ip_address;
    if (client_user_agent) userData.client_user_agent = client_user_agent;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    // Preparar custom_data
    const customData: Record<string, any> = {};

    if (currency) customData.currency = currency;
    if (value) customData.value = parseFloat(value);
    if (content_name) customData.content_name = content_name;
    if (content_category) customData.content_category = content_category;
    if (content_ids) customData.content_ids = Array.isArray(content_ids) ? content_ids : [content_ids];
    if (content_type) customData.content_type = content_type;

    // Montar evento para Meta
    const eventData = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      action_source,
      event_source_url,
      event_id: event_id || crypto.randomUUID(),
      user_data: userData,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined,
    };

    console.log("📤 Enviando para Meta CAPI:", JSON.stringify(eventData, null, 2));

    // Enviar para Meta Conversions API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [eventData] }),
      }
    );

    const metaResult = await metaResponse.json();
    console.log("📨 Resposta Meta CAPI:", JSON.stringify(metaResult, null, 2));

    const duracao = Date.now() - startTime;

    // Log de execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-meta-capi",
      status: metaResponse.ok ? "sucesso" : "erro",
      duracao_ms: duracao,
      detalhes_execucao: {
        event_name,
        event_id: eventData.event_id,
        meta_response: metaResult,
        has_email: !!email,
        has_fbp: !!fbp,
        has_fbc: !!fbc,
        id_empresa,
      },
      mensagem_erro: metaResponse.ok ? null : JSON.stringify(metaResult),
    });

    if (!metaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar para Meta", details: metaResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_received: metaResult.events_received,
        fbtrace_id: metaResult.fbtrace_id,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no stape-meta-capi:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
