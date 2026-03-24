import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

function parseResults(tipo: string, items: any[]): any[] {
  switch (tipo) {
    case "INSTAGRAM_FOLLOWERS":
      return items.map((i) => ({
        nome: i.fullName || i.full_name || "",
        username: i.username || "",
        user_id: i.userId || i.id || "",
        verificado: i.isVerified || false,
        foto_perfil: i.profilePicUrl || i.profile_pic_url || "",
        email: i.email || i.contactEmail || "",
        plataforma: "Instagram",
      }));
    case "LINKEDIN_PROFILE_SEARCH":
      return items.map((i) => ({
        nome: i.fullName || i.name || `${i.firstName || ""} ${i.lastName || ""}`.trim(),
        cargo: i.headline || i.title || "",
        empresa: i.company || i.companyName || i.currentCompany || "",
        localizacao: i.location || i.geo || "",
        linkedin_url: i.profileUrl || i.linkedinUrl || i.url || "",
        email: i.email || i.emails?.[0] || "",
        plataforma: "LinkedIn",
      }));
    case "LINKEDIN_ENRICH":
      return items.map((i) => ({
        nome: i.fullName || i.name || `${i.firstName || ""} ${i.lastName || ""}`.trim(),
        cargo: i.headline || i.title || "",
        empresa: i.company || i.companyName || i.currentCompany || "",
        localizacao: i.location || i.geo || "",
        linkedin_url: i.profileUrl || i.linkedinUrl || i.url || "",
        email: i.email || i.emails?.[0] || "",
        telefone: i.mobileNumber || i.phoneNumber || i.phone || "",
        plataforma: "LinkedIn",
      }));
    case "FACEBOOK_PAGE":
      return items.map((i) => ({
        nome: i.name || "",
        email: i.email || "",
        url: i.url || "",
        plataforma: "Facebook",
      }));
    default:
      return items;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { id } = await req.json();
    if (!id) throw new Error("id da extração é obrigatório");

    const { data: extracao, error: fetchError } = await supabase
      .from("extracao_lead_frio")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !extracao) throw new Error("Extração não encontrada");
    if (extracao.status === "CONCLUIDO") {
      return new Response(
        JSON.stringify({ success: true, status: "CONCLUIDO", total: extracao.total_resultados, resultados: extracao.resultados }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runId = extracao.apify_run_id;
    if (!runId) throw new Error("Sem apify_run_id");

    const statusRes = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    if (!statusRes.ok) throw new Error(`Apify status check failed: ${statusRes.status}`);
    const statusData = await statusRes.json();
    const runStatus = statusData.data?.status;

    if (runStatus === "SUCCEEDED") {
      const datasetId = statusData.data?.defaultDatasetId;
      const itemsRes = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
      const items = await itemsRes.json();

      const parsed = parseResults(extracao.tipo_extracao, items);

      await supabase
        .from("extracao_lead_frio")
        .update({
          status: "CONCLUIDO",
          total_resultados: parsed.length,
          resultados: parsed,
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, status: "CONCLUIDO", total: parsed.length, resultados: parsed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
      await supabase
        .from("extracao_lead_frio")
        .update({ status: "ERRO" })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: false, status: "ERRO", error: `Apify run ${runStatus}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: "EXECUTANDO", apify_status: runStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
