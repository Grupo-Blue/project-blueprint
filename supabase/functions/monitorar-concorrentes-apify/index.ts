import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

interface RunInfo {
  run_id: string;
  concorrente: string;
  plataforma: string;
  id_empresa: string;
}

async function startApifyActor(actorId: string, input: object, token: string): Promise<string> {
  const res = await fetch(`${APIFY_BASE_URL}/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apify start failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const runId = data.data?.id;
  if (!runId) throw new Error("No run ID returned from Apify");
  return runId;
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

    const { id_empresa, plataforma } = await req.json().catch(() => ({}));

    // Fetch active competitor configs
    let configQuery = supabase
      .from("concorrente_config")
      .select("*")
      .eq("ativo", true);

    if (id_empresa) {
      configQuery = configQuery.eq("id_empresa", id_empresa);
    }

    const { data: configs, error: configError } = await configQuery;
    if (configError) throw new Error(`Config fetch error: ${configError.message}`);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No competitor configs found", runs: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runs: RunInfo[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      // Meta Ads Library
      if ((!plataforma || plataforma === "META") && config.facebook_page_name) {
        try {
          console.log(`Starting Meta ads collection for: ${config.nome_concorrente}`);
          // Use the Facebook page URL directly - the actor supports both Ad Library URLs and Page URLs
          const pageUrl = `https://www.facebook.com/${config.facebook_page_name}`;

          const runId = await startApifyActor(
            "curious_coder~facebook-ads-library-scraper",
            { 
              urls: [pageUrl],
              action: "Scrape Ads of Given Facebook Pages",
              maxAdsPerPage: 50,
            },
            APIFY_API_TOKEN
          );

          runs.push({
            run_id: runId,
            concorrente: config.nome_concorrente,
            plataforma: "META",
            id_empresa: config.id_empresa,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Meta error for ${config.nome_concorrente}: ${msg}`);
          console.error(msg);
        }
      }

      // LinkedIn Ads Library
      if ((!plataforma || plataforma === "LINKEDIN") && config.linkedin_page_url) {
        try {
          console.log(`Starting LinkedIn ads collection for: ${config.nome_concorrente}`);

          const runId = await startApifyActor(
            "silva95gustavo~linkedin-ad-library-scraper",
            { startUrls: [{ url: config.linkedin_page_url }], maxItems: 30 },
            APIFY_API_TOKEN
          );

          runs.push({
            run_id: runId,
            concorrente: config.nome_concorrente,
            plataforma: "LINKEDIN",
            id_empresa: config.id_empresa,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`LinkedIn error for ${config.nome_concorrente}: ${msg}`);
          console.error(msg);
        }
      }
    }

    // Log execution start
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "monitorar-concorrentes-apify",
      status: "em_andamento",
      detalhes_execucao: {
        configs_processados: configs.length,
        runs_iniciados: runs.length,
        runs,
        errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        runs,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
