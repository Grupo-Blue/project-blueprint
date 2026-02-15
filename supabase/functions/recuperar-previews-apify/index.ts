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

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(" "));
  const wordsB = new Set(normalizeText(b).split(" "));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function buildAdsLibraryUrl(pageIdFacebook: string | null, empresaNome: string): string {
  const adsLibraryUrl = new URL("https://www.facebook.com/ads/library/");
  adsLibraryUrl.searchParams.set("active_status", "all");
  adsLibraryUrl.searchParams.set("ad_type", "all");
  adsLibraryUrl.searchParams.set("country", "BR");

  if (pageIdFacebook) {
    adsLibraryUrl.searchParams.set("view_all_page_id", pageIdFacebook);
    adsLibraryUrl.searchParams.set("search_type", "page");
  } else {
    adsLibraryUrl.searchParams.set("q", empresaNome.trim());
    adsLibraryUrl.searchParams.set("search_type", "keyword_unordered");
  }

  return adsLibraryUrl.toString();
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

    // 1. Find criativos without preview - include id_anuncio_externo and url_final
    let query = supabase
      .from("criativo")
      .select(`
        id_criativo,
        id_criativo_externo,
        id_anuncio_externo,
        descricao,
        url_final,
        id_campanha,
        campanha:campanha!inner(
          id_campanha,
          nome,
          id_conta,
          conta_anuncio:conta_anuncio!inner(
            id_empresa,
            plataforma,
            page_id_facebook,
            empresa:empresa!inner(nome)
          )
        )
      `)
      .is("url_preview", null)
      .eq("ativo", true)
      .eq("campanha.conta_anuncio.plataforma", "META")
      .limit(limit);

    if (id_empresa) {
      query = query.eq("campanha.conta_anuncio.id_empresa", id_empresa);
    }

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

    // 2. Group by empresa
    const empresaGroups: Record<string, { empresaNome: string; pageIdFacebook: string | null; criativos: any[] }> = {};
    for (const criativo of criativos) {
      const conta = (criativo as any).campanha?.conta_anuncio;
      if (!conta) continue;
      const empresaId = conta.id_empresa;
      if (!empresaGroups[empresaId]) {
        empresaGroups[empresaId] = {
          empresaNome: conta.empresa?.nome || "",
          pageIdFacebook: conta.page_id_facebook || null,
          criativos: [],
        };
      }
      empresaGroups[empresaId].criativos.push(criativo);
    }

    let totalUpdated = 0;
    const errors: string[] = [];
    const diagnostics: any[] = [];

    // 3. For each empresa, call Apify
    for (const [empresaId, group] of Object.entries(empresaGroups)) {
      try {
        const searchMethod = group.pageIdFacebook ? `page_id=${group.pageIdFacebook}` : `query=${group.empresaNome}`;
        console.log(`🔍 Processing ${group.criativos.length} criativos for ${group.empresaNome} (${searchMethod})`);

        const finalUrl = buildAdsLibraryUrl(group.pageIdFacebook, group.empresaNome);
        console.log(`🔗 URL: ${finalUrl}`);

        const results: ApifyAdResult[] = await runApifyActorAndWait(
          "curious_coder~facebook-ads-library-scraper",
          {
            urls: [{ url: finalUrl }],
            limitPerSource: 200,
          },
          APIFY_API_TOKEN
        );

        console.log(`📦 Apify returned ${results.length} ads for ${group.empresaNome}`);

        // Diagnostic: log sample Apify ad
        if (results.length > 0) {
          const sample = results[0];
          console.log(`📊 Sample Apify ad: adArchiveID=${sample.adArchiveID}, adid=${sample.adid}, pageID=${sample.pageID}, pageName=${sample.pageName}, link_url=${sample.snapshot?.link_url}, text=${sample.snapshot?.body_text?.substring(0, 80)}`);
        }

        // 4. Match with cascade logic
        for (const criativo of group.criativos) {
          const anuncioExterno = criativo.id_anuncio_externo || "";
          const urlFinal = criativo.url_final || "";
          const descricao = criativo.descricao || "";

          // Diagnostic: log criativo fields
          console.log(`📊 Criativo ${criativo.id_criativo}: anuncio_ext=${anuncioExterno || "NULL"}, criativo_ext=${criativo.id_criativo_externo}, url_final=${urlFinal || "NULL"}, desc=${descricao?.substring(0, 50)}`);

          let bestMatch: ApifyAdResult | null = null;
          let bestScore = 0;
          let matchMethod = "none";

          for (const ad of results) {
            const adId = ad.adArchiveID || ad.adid || "";

            // Priority 1: Match by ad ID (id_anuncio_externo vs adArchiveID/adid)
            if (anuncioExterno && adId && anuncioExterno === adId) {
              bestMatch = ad;
              bestScore = 1;
              matchMethod = "id_exact";
              break;
            }

            // Priority 2: Match by landing page URL
            if (urlFinal && ad.snapshot?.link_url) {
              const normalizedFinal = normalizeUrl(urlFinal);
              const normalizedAdLink = normalizeUrl(ad.snapshot.link_url);
              if (normalizedFinal && normalizedAdLink && 
                  (normalizedFinal.includes(normalizedAdLink) || normalizedAdLink.includes(normalizedFinal))) {
                bestMatch = ad;
                bestScore = 0.9;
                matchMethod = "url_match";
                break;
              }
            }

            // Priority 3: Text similarity (threshold 0.2)
            const adText = [
              ad.snapshot?.body_text,
              ad.snapshot?.caption,
              ad.snapshot?.title,
            ]
              .filter(Boolean)
              .join(" ");

            if (!adText || !descricao) continue;

            const score = calculateSimilarity(descricao, adText);
            if (score > bestScore && score > 0.2) {
              bestScore = score;
              bestMatch = ad;
              matchMethod = "text_similarity";
            }
          }

          if (bestMatch) {
            console.log(`✅ Match for ${criativo.id_criativo}: method=${matchMethod}, score=${bestScore.toFixed(2)}`);

            const urlPreview = bestMatch.snapshot?.images?.[0] || null;
            const videoUrl =
              bestMatch.snapshot?.videos?.[0]?.video_hd_url ||
              bestMatch.snapshot?.videos?.[0]?.video_sd_url ||
              null;
            const urlMidiaOriginal = videoUrl || bestMatch.snapshot?.images?.[0] || null;

            const updateFields: Record<string, any> = {};

            // Salvar imagem no Storage para URL permanente
            if (urlPreview || urlMidiaOriginal) {
              const mediaUrl = urlMidiaOriginal || urlPreview;
              try {
                const mediaRes = await fetch(mediaUrl!, { signal: AbortSignal.timeout(15000) });
                if (mediaRes.ok) {
                  const mediaData = await mediaRes.arrayBuffer();
                  // Limitar a 5MB
                  if (mediaData.byteLength <= 5 * 1024 * 1024) {
                    const contentType = mediaRes.headers.get("content-type") || "image/jpeg";
                    const ext = contentType.includes("video") ? "mp4" : "jpg";
                    const storagePath = `${criativo.id_criativo}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                      .from("criativos-media")
                      .upload(storagePath, mediaData, { contentType, upsert: true });

                    if (!uploadError) {
                      const { data: publicUrlData } = supabase.storage
                        .from("criativos-media")
                        .getPublicUrl(storagePath);
                      updateFields.url_midia = publicUrlData.publicUrl;
                      console.log(`💾 Mídia salva no Storage: ${storagePath}`);
                    } else {
                      console.error(`⚠️ Upload falhou para ${criativo.id_criativo}: ${uploadError.message}`);
                      updateFields.url_midia = mediaUrl;
                    }
                  } else {
                    console.log(`⚠️ Mídia muito grande (${(mediaData.byteLength / 1024 / 1024).toFixed(1)}MB), salvando URL direta`);
                    updateFields.url_midia = mediaUrl;
                  }
                } else {
                  updateFields.url_midia = mediaUrl;
                }
              } catch (fetchErr: any) {
                console.error(`⚠️ Erro ao baixar mídia: ${fetchErr.message}`);
                updateFields.url_midia = mediaUrl;
              }
            }

            // Salvar url_preview (Ad Library link permanente, não temporário)
            if (bestMatch.adArchiveID) {
              updateFields.url_preview = `https://www.facebook.com/ads/library/?id=${bestMatch.adArchiveID}`;
            } else if (urlPreview) {
              updateFields.url_preview = urlPreview;
            }

            if (videoUrl) {
              updateFields.url_video = videoUrl;
            }

            // Salvar id_anuncio_externo se não tinha
            if (!criativo.id_anuncio_externo && bestMatch.adArchiveID) {
              updateFields.id_anuncio_externo = bestMatch.adArchiveID;
            }

            const { error: updateError } = await supabase
              .from("criativo")
              .update(updateFields)
              .eq("id_criativo", criativo.id_criativo);

            if (!updateError) {
              totalUpdated++;
              diagnostics.push({
                id_criativo: criativo.id_criativo,
                match_method: matchMethod,
                score: bestScore,
                saved_to_storage: !!updateFields.url_midia?.includes("supabase"),
              });
            } else {
              errors.push(`Update error for ${criativo.id_criativo}: ${updateError.message}`);
            }
          } else {
            console.log(`❌ No match for ${criativo.id_criativo} (desc=${descricao?.substring(0, 30)})`);
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
        diagnostics,
        errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_criativos: criativos.length,
        updated: totalUpdated,
        diagnostics,
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
