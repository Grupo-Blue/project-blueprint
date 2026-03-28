import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar método
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar secret
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("SGT_WEBHOOK_SECRET");
    if (!secret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, evento, dados } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!evento || !dados) {
      return new Response(JSON.stringify({ error: "evento and dados are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Montar update com campos Amélia
    const updateData: Record<string, any> = {
      amelia_updated_at: new Date().toISOString(),
    };

    if (dados.icp !== undefined) updateData.amelia_icp = dados.icp;
    if (dados.persona !== undefined) updateData.amelia_persona = dados.persona;
    if (dados.temperatura !== undefined) updateData.amelia_temperatura = dados.temperatura;
    if (dados.prioridade !== undefined) updateData.amelia_prioridade = dados.prioridade;
    if (dados.score_interno !== undefined) updateData.amelia_score = dados.score_interno;
    if (dados.perfil_disc !== undefined) updateData.amelia_disc = dados.perfil_disc;
    if (dados.health_score !== undefined) updateData.amelia_health_score = dados.health_score;
    if (dados.estado_funil !== undefined) updateData.amelia_estado_funil = dados.estado_funil;
    if (dados.framework_ativo !== undefined) updateData.amelia_framework = dados.framework_ativo;

    // Atualizar também campos nativos do SGT se enviados
    if (dados.mql === true && !updateData.is_mql) {
      updateData.is_mql = true;
      if (dados.data_mql) updateData.data_mql = dados.data_mql;
    }

    const { error } = await supabase
      .from("lead")
      .update(updateData)
      .eq("id_lead", lead_id);

    if (error) {
      console.error("Erro ao atualizar lead:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[amelia-webhook] Lead ${lead_id} enriquecido | evento=${evento} | campos=${Object.keys(updateData).join(",")}`);

    return new Response(JSON.stringify({ success: true, lead_id, campos_atualizados: Object.keys(updateData) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro no amelia-webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
