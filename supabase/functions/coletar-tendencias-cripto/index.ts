import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

const FONTES = [
  {
    nome: "Portal do Bitcoin",
    url: "https://portaldobitcoin.uol.com.br/",
    categorias: ["mercado", "tributacao"],
    empresas: ["Blue Consult", "Tokeniza"],
  },
  {
    nome: "Livecoins",
    url: "https://livecoins.com.br/",
    categorias: ["mercado"],
    empresas: ["Blue Consult", "Tokeniza"],
  },
  {
    nome: "CoinTelegraph BR",
    url: "https://br.cointelegraph.com/",
    categorias: ["mercado", "regulamentacao"],
    empresas: ["Blue Consult", "Axia", "Tokeniza"],
  },
];

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
    throw new Error(`Apify start failed: ${runResponse.status}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("No run ID");

  const maxWait = 5 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, 10000));
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

function categorizeArticle(title: string, text: string): string[] {
  const combined = `${title} ${text}`.toLowerCase();
  const cats: string[] = [];

  if (/regulament|cvm|bacen|banco central|lei|legisla|norma|instrução/.test(combined)) cats.push("regulamentacao");
  if (/imposto|tribut|irpf|receita federal|declaração/.test(combined)) cats.push("tributacao");
  if (/bitcoin|ethereum|cripto|defi|nft|token|blockchain/.test(combined)) cats.push("mercado");
  if (/investiment|rendiment|rentabilidade|fundo|ação/.test(combined)) cats.push("investimento");

  return cats.length > 0 ? cats : ["mercado"];
}

function scoreRelevance(title: string): number {
  const keywords = [
    "regulamentação", "cvm", "imposto", "cripto", "bitcoin",
    "tokenização", "blockchain", "defi", "receita federal",
    "banco central", "drex", "cbdc",
  ];
  const lower = title.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).length;
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

    let totalCollected = 0;
    const errors: string[] = [];

    for (const fonte of FONTES) {
      try {
        console.log(`Scraping: ${fonte.nome}`);

        const results = await runApifyActorAndWait(
          "apify~web-scraper",
          {
            startUrls: [{ url: fonte.url }],
            pageFunction: `async function pageFunction(context) {
              const { $, request } = context;
              const articles = [];
              $('article, .post, .entry, [class*="article"], [class*="post"]').each((i, el) => {
                const $el = $(el);
                const title = $el.find('h1, h2, h3, [class*="title"]').first().text().trim();
                const summary = $el.find('p, [class*="excerpt"], [class*="summary"]').first().text().trim();
                const link = $el.find('a').first().attr('href');
                if (title && title.length > 10) {
                  articles.push({
                    title,
                    summary: summary.substring(0, 500),
                    url: link ? new URL(link, request.url).href : request.url,
                  });
                }
              });
              return articles.slice(0, 20);
            }`,
            maxPagesPerCrawl: 3,
          },
          APIFY_API_TOKEN
        );

        const articles = results.flat().filter((a: any) => a.title);

        for (const article of articles) {
          const categorias = categorizeArticle(article.title, article.summary || "");
          const relevancia = scoreRelevance(article.title);

          const { error: insertError } = await supabase
            .from("tendencia_mercado")
            .upsert(
              {
                fonte: fonte.nome,
                titulo: article.title,
                resumo: article.summary || null,
                url: article.url,
                data_publicacao: new Date().toISOString(),
                categorias,
                relevancia_score: relevancia,
                empresas_relacionadas: fonte.empresas,
              },
              { onConflict: "url", ignoreDuplicates: true }
            );

          if (!insertError) totalCollected++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error scraping ${fonte.nome}: ${msg}`);
        console.error(msg);
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "coletar-tendencias-cripto",
      status: errors.length === 0 ? "sucesso" : "parcial",
      detalhes_execucao: { total_collected: totalCollected, errors },
    });

    return new Response(
      JSON.stringify({ success: true, collected: totalCollected, errors: errors.length > 0 ? errors : undefined }),
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
