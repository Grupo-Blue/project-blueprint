import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

const ACTOR_MAP: Record<string, string> = {
  INSTAGRAM_FOLLOWERS: "instaprism~instagram-followers-scraper",
  LINKEDIN_SEARCH: "anchor~linkedin-people-search",
  LINKEDIN_COMPANY: "anchor~linkedin-company-scraper",
  FACEBOOK_PAGE: "apify~facebook-pages-scraper",
};

function buildActorInput(tipo: string, parametros: Record<string, any>): object {
  switch (tipo) {
    case "INSTAGRAM_FOLLOWERS":
      return {
        usernames: [parametros.username?.replace("@", "")],
        resultsLimit: parametros.limit || 200,
      };
    case "LINKEDIN_SEARCH":
      return {
        keyword: parametros.cargo || "",
        location: parametros.localizacao || "",
        industry: parametros.setor || "",
        maxItems: parametros.limit || 100,
      };
    case "LINKEDIN_COMPANY":
      return {
        startUrls: [{ url: parametros.company_url }],
        maxItems: parametros.limit || 100,
      };
    case "FACEBOOK_PAGE":
      return {
        startUrls: [{ url: parametros.page_url }],
        maxPosts: 0,
        maxReviews: 0,
        maxItems: parametros.limit || 200,
      };
    default:
      throw new Error(`Tipo de extração desconhecido: ${tipo}`);
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

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { tipo_extracao, parametros, id_empresa } = await req.json();

    if (!tipo_extracao || !ACTOR_MAP[tipo_extracao]) {
      throw new Error(`Tipo inválido. Use: ${Object.keys(ACTOR_MAP).join(", ")}`);
    }
    if (!id_empresa) throw new Error("id_empresa é obrigatório");

    const actorId = ACTOR_MAP[tipo_extracao];
    const actorInput = buildActorInput(tipo_extracao, parametros || {});

    // Start Apify actor
    const res = await fetch(`${APIFY_BASE_URL}/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Apify start failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const runId = data.data?.id;
    if (!runId) throw new Error("No run ID returned from Apify");

    // Save to DB
    const { data: extracao, error: insertError } = await supabase
      .from("extracao_lead_frio")
      .insert({
        id_empresa,
        criado_por: user.id,
        tipo_extracao,
        parametros: parametros || {},
        status: "EXECUTANDO",
        apify_run_id: runId,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`DB insert error: ${insertError.message}`);

    return new Response(
      JSON.stringify({ success: true, id: extracao.id, apify_run_id: runId }),
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
