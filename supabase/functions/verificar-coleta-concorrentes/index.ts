import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

interface RunCheck {
  run_id: string;
  concorrente: string;
  plataforma: string;
  id_empresa: string;
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

    const { runs } = await req.json() as { runs: RunCheck[] };
    if (!runs || runs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], all_done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      run_id: string;
      concorrente: string;
      plataforma: string;
      status: string;
      collected?: number;
      error?: string;
    }> = [];

    let totalCollected = 0;

    for (const run of runs) {
      try {
        // Check run status
        const statusRes = await fetch(
          `${APIFY_BASE_URL}/actor-runs/${run.run_id}?token=${APIFY_API_TOKEN}`
        );
        if (!statusRes.ok) {
          results.push({
            run_id: run.run_id,
            concorrente: run.concorrente,
            plataforma: run.plataforma,
            status: "ERROR",
            error: `Status check failed: ${statusRes.status}`,
          });
          continue;
        }

        const statusData = await statusRes.json();
        const runStatus = statusData.data?.status;

        if (runStatus === "SUCCEEDED") {
          // Fetch results from dataset
          const datasetId = statusData.data?.defaultDatasetId;
          const itemsRes = await fetch(
            `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
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
          results.push({
            run_id: run.run_id,
            concorrente: run.concorrente,
            plataforma: run.plataforma,
            status: "SUCCEEDED",
            collected,
          });
        } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
          results.push({
            run_id: run.run_id,
            concorrente: run.concorrente,
            plataforma: run.plataforma,
            status: runStatus,
            error: `Apify run ${runStatus}`,
          });
        } else {
          // Still running
          results.push({
            run_id: run.run_id,
            concorrente: run.concorrente,
            plataforma: run.plataforma,
            status: "RUNNING",
          });
        }
      } catch (err) {
        results.push({
          run_id: run.run_id,
          concorrente: run.concorrente,
          plataforma: run.plataforma,
          status: "ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const allDone = results.every((r) =>
      ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT", "ERROR"].includes(r.status)
    );

    return new Response(
      JSON.stringify({
        success: true,
        results,
        all_done: allDone,
        total_collected: totalCollected,
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
