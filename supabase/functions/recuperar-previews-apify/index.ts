import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

interface ApifyAdResult {
  adArchiveID?: string;
  adid?: string;
  pageID?: string;
  pageName?: string;
  snapshot?: {
    body_text?: string;
    caption?: string;
    cta_text?: string;
    images?: string[];
    videos?: { video_sd_url?: string; video_hd_url?: string }[];
    link_url?: string;
    title?: string;
  };
  startDate?: string;
  isActive?: boolean;
}

async function runApifyActorAndWait(actorId: string, input: object, token: string): Promise<any[]> {
  // Start the actor run
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
    throw new Error(`Failed to start Apify actor: ${runResponse.status} ${errText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;

  if (!runId) {
    throw new Error("No run ID returned from Apify");
  }

  // Poll for completion (max 5 minutes)
  const maxWait = 5 * 60 * 1000;
  const pollInterval = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`
    );
    const statusData = await statusResponse.json();
    const status = statusData.data?.status;

    if (status === "SUCCEEDED") {
      // Fetch results from the default dataset
      const datasetId = statusData.data?.defaultDatasetId;
      const itemsResponse = await fetch(
        `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`
      );
      return await itemsResponse.json();
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify actor run ${status}`);
    }
  }

  throw new Error("Apify actor run timed out after 5 minutes");
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(" "));
  const wordsB = new Set(normalizeText(b).split(" "));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { id_empresa, limit = 50 } = await req.json().catch(() => ({}));

    // 1. Find criativos without preview
    let query = supabase
      .from("criativo")
      .select(`
        id_criativo,
        id_criativo_externo,
        descricao,
        id_campanha,
        campanha:campanha!inner(
          id_campanha,
          nome,
          id_conta,
          conta_anuncio:conta_anuncio!inner(
            id_empresa,
            plataforma,
            empresa:empresa!inner(nome)
          )
        )
      `)
      .is("url_preview", null)
      .eq("ativo", true)
      .limit(limit);

    if (id_empresa) {
      query = query.eq("campanha.conta_anuncio.id_empresa", id_empresa);
    }

    // Filter only META platform
    query = query.eq("campanha.conta_anuncio.plataforma", "META");

    const { data: criativos, error: criativosError } = await query;

    if (criativosError) {
      throw new Error(`Error fetching criativos: ${criativosError.message}`);
    }

    if (!criativos || criativos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No criativos without preview found", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Group by empresa to batch Apify calls
    const empresaGroups: Record<string, { empresaNome: string; criativos: any[] }> = {};
    for (const criativo of criativos) {
      const conta = (criativo as any).campanha?.conta_anuncio;
      if (!conta) continue;
      const empresaId = conta.id_empresa;
      if (!empresaGroups[empresaId]) {
        empresaGroups[empresaId] = {
          empresaNome: conta.empresa?.nome || "",
          criativos: [],
        };
      }
      empresaGroups[empresaId].criativos.push(criativo);
    }

    let totalUpdated = 0;
    const errors: string[] = [];

    // 3. For each empresa, call Apify
    for (const [empresaId, group] of Object.entries(empresaGroups)) {
      try {
        console.log(`Processing ${group.criativos.length} criativos for ${group.empresaNome}`);

        const results: ApifyAdResult[] = await runApifyActorAndWait(
          "curious_coder~facebook-ads-library-scraper",
          {
            searchQuery: group.empresaNome,
            adType: "ALL",
            country: "BR",
            maxItems: 100,
          },
          APIFY_API_TOKEN
        );

        console.log(`Apify returned ${results.length} ads for ${group.empresaNome}`);

        // 4. Match and update
        for (const criativo of group.criativos) {
          const descricao = criativo.descricao || "";

          let bestMatch: ApifyAdResult | null = null;
          let bestScore = 0;

          for (const ad of results) {
            const adText = [
              ad.snapshot?.body_text,
              ad.snapshot?.caption,
              ad.snapshot?.title,
            ]
              .filter(Boolean)
              .join(" ");

            if (!adText && !descricao) continue;

            const score = calculateSimilarity(descricao, adText);
            if (score > bestScore && score > 0.3) {
              bestScore = score;
              bestMatch = ad;
            }
          }

          if (bestMatch) {
            const urlPreview = bestMatch.snapshot?.images?.[0] || null;
            const urlMidia =
              bestMatch.snapshot?.videos?.[0]?.video_hd_url ||
              bestMatch.snapshot?.videos?.[0]?.video_sd_url ||
              bestMatch.snapshot?.images?.[0] ||
              null;

            const { error: updateError } = await supabase
              .from("criativo")
              .update({
                url_preview: urlPreview,
                url_midia: urlMidia || urlPreview,
              })
              .eq("id_criativo", criativo.id_criativo);

            if (!updateError) {
              totalUpdated++;
            } else {
              errors.push(`Update error for ${criativo.id_criativo}: ${updateError.message}`);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing ${group.empresaNome}: ${msg}`);
        console.error(msg);
      }
    }

    // Log execution
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "recuperar-previews-apify",
      status: errors.length === 0 ? "sucesso" : "parcial",
      detalhes_execucao: {
        total_criativos: criativos.length,
        total_updated: totalUpdated,
        errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_criativos: criativos.length,
        updated: totalUpdated,
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
