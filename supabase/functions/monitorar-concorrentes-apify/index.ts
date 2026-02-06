import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

async function runApifyActorAndWait(actorId: string, input: object, token: string): Promise<any[]> {
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const errText = await runResponse.text();
    throw new Error(`Apify start failed: ${runResponse.status} ${errText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("No run ID");

  const maxWait = 10 * 60 * 1000;
  const pollInterval = 15000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const statusRes = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data?.defaultDatasetId;
      const itemsRes = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`);
      return await itemsRes.json();
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify run ${status}`);
    }
  }

  throw new Error("Apify run timed out");
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
        JSON.stringify({ success: true, message: "No competitor configs found", collected: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCollected = 0;
    const errors: string[] = [];

    for (const config of configs) {
      // Meta Ads Library
      if ((!plataforma || plataforma === "META") && config.facebook_page_name) {
        try {
          console.log(`Collecting Meta ads for: ${config.nome_concorrente}`);

          const results = await runApifyActorAndWait(
            "curious_coder~facebook-ads-library-scraper",
            {
              searchQuery: config.facebook_page_name,
              adType: "ALL",
              country: "BR",
              maxItems: 50,
            },
            APIFY_API_TOKEN
          );

          for (const ad of results) {
            const adIdExterno = ad.adArchiveID || ad.adid || `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Upsert to avoid duplicates
            const { error: insertError } = await supabase
              .from("concorrente_anuncio")
              .upsert(
                {
                  id_empresa: config.id_empresa,
                  concorrente_nome: config.nome_concorrente,
                  plataforma: "META",
                  ad_id_externo: adIdExterno,
                  titulo: ad.snapshot?.title || null,
                  texto_corpo: ad.snapshot?.body_text || ad.snapshot?.caption || null,
                  url_destino: ad.snapshot?.link_url || null,
                  url_midia: ad.snapshot?.images?.[0] || ad.snapshot?.videos?.[0]?.video_sd_url || null,
                  data_inicio_veiculo: ad.startDate || null,
                  status: ad.isActive ? "ATIVO" : "PAUSADO",
                  metadados: {
                    page_name: ad.pageName,
                    page_id: ad.pageID,
                    cta: ad.snapshot?.cta_text,
                  },
                },
                { onConflict: "ad_id_externo", ignoreDuplicates: false }
              );

            if (!insertError) {
              totalCollected++;
            } else if (!insertError.message.includes("duplicate")) {
              errors.push(`Insert error: ${insertError.message}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Meta error for ${config.nome_concorrente}: ${msg}`);
          console.error(msg);
        }
      }

      // LinkedIn Ads Library
      if ((!plataforma || plataforma === "LINKEDIN") && config.linkedin_page_url) {
        try {
          console.log(`Collecting LinkedIn ads for: ${config.nome_concorrente}`);

          const results = await runApifyActorAndWait(
            "silva95gustavo~linkedin-ad-library-scraper",
            {
              urls: [config.linkedin_page_url],
              maxItems: 30,
            },
            APIFY_API_TOKEN
          );

          for (const ad of results) {
            const adIdExterno = ad.adId || `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const { error: insertError } = await supabase
              .from("concorrente_anuncio")
              .upsert(
                {
                  id_empresa: config.id_empresa,
                  concorrente_nome: config.nome_concorrente,
                  plataforma: "LINKEDIN",
                  ad_id_externo: adIdExterno,
                  titulo: ad.title || null,
                  texto_corpo: ad.body || ad.introText || null,
                  url_destino: ad.landingPageUrl || null,
                  url_midia: ad.imageUrl || ad.videoUrl || null,
                  status: "ATIVO",
                  metadados: { raw: ad },
                },
                { onConflict: "ad_id_externo", ignoreDuplicates: false }
              );

            if (!insertError) totalCollected++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`LinkedIn error for ${config.nome_concorrente}: ${msg}`);
        }
      }

      // Delay between competitors
      await new Promise((r) => setTimeout(r, 3000));
    }

    // Log execution
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "monitorar-concorrentes-apify",
      status: errors.length === 0 ? "sucesso" : "parcial",
      detalhes_execucao: {
        configs_processados: configs.length,
        total_collected: totalCollected,
        errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        configs_processados: configs.length,
        collected: totalCollected,
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
