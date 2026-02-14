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

async function waitAndCollectResults(
  runs: RunInfo[],
  supabase: any,
  token: string
): Promise<{ collected: number; errors: string[] }> {
  const maxWait = 8 * 60 * 1000; // 8 minutes
  const pollInterval = 15000; // 15 seconds
  const startTime = Date.now();
  const pending = new Set(runs.map((_, i) => i));
  let totalCollected = 0;
  const errors: string[] = [];

  while (pending.size > 0 && Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    for (const idx of [...pending]) {
      const run = runs[idx];
      try {
        const statusRes = await fetch(
          `${APIFY_BASE_URL}/actor-runs/${run.run_id}?token=${token}`
        );
        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();
        const runStatus = statusData.data?.status;

        if (runStatus === "SUCCEEDED") {
          pending.delete(idx);
          const datasetId = statusData.data?.defaultDatasetId;
          const itemsRes = await fetch(
            `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`
          );
          const items = await itemsRes.json();
          let collected = 0;

          if (run.plataforma === "META") {
            for (const ad of items) {
              const adIdExterno = ad.adArchiveID || ad.adid || `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const { error: insertError } = await supabase
                .from("concorrente_anuncio")
                .upsert(
                  {
                    id_empresa: run.id_empresa,
                    concorrente_nome: run.concorrente,
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
              if (!insertError) collected++;
            }
          } else if (run.plataforma === "LINKEDIN") {
            for (const ad of items) {
              const adIdExterno = ad.adId || `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const { error: insertError } = await supabase
                .from("concorrente_anuncio")
                .upsert(
                  {
                    id_empresa: run.id_empresa,
                    concorrente_nome: run.concorrente,
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
              if (!insertError) collected++;
            }
          }

          totalCollected += collected;
          console.log(`Run ${run.run_id} (${run.concorrente}/${run.plataforma}): collected ${collected} ads`);
        } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
          pending.delete(idx);
          errors.push(`Run ${run.run_id} (${run.concorrente}/${run.plataforma}): ${runStatus}`);
        }
        // else still RUNNING, keep polling
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Poll error for ${run.concorrente}: ${msg}`);
      }
    }
  }

  // Mark remaining as timed out
  for (const idx of pending) {
    const run = runs[idx];
    errors.push(`Run ${run.run_id} (${run.concorrente}/${run.plataforma}): timed out after 8 min`);
  }

  return { collected: totalCollected, errors };
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

    const { id_empresa, plataforma, skip_verify } = await req.json().catch(() => ({}));

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
    const startErrors: string[] = [];

    for (const config of configs) {
      // Meta Ads Library
      if ((!plataforma || plataforma === "META") && config.facebook_page_name) {
        try {
          console.log(`Starting Meta ads collection for: ${config.nome_concorrente}`);
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
          startErrors.push(`Meta error for ${config.nome_concorrente}: ${msg}`);
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
          startErrors.push(`LinkedIn error for ${config.nome_concorrente}: ${msg}`);
          console.error(msg);
        }
      }
    }

    // Auto-verify: wait for results and collect them (default behavior for cron)
    let verifyResult = { collected: 0, errors: [] as string[] };
    if (!skip_verify && runs.length > 0) {
      console.log(`Auto-verify: waiting for ${runs.length} runs to complete...`);
      verifyResult = await waitAndCollectResults(runs, supabase, APIFY_API_TOKEN);
    }

    const allErrors = [...startErrors, ...verifyResult.errors];

    // Log execution
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "monitorar-concorrentes-apify",
      status: allErrors.length === 0 ? "sucesso" : (verifyResult.collected > 0 ? "parcial" : "erro"),
      detalhes_execucao: {
        configs_processados: configs.length,
        runs_iniciados: runs.length,
        ads_coletados: verifyResult.collected,
        auto_verify: !skip_verify,
        errors: allErrors.length > 0 ? allErrors : undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        runs_started: runs.length,
        ads_collected: verifyResult.collected,
        errors: allErrors.length > 0 ? allErrors : undefined,
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
