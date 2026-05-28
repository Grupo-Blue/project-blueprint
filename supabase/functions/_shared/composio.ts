// Cliente HTTP direto para a Composio REST API.
// Usado como fallback de coleta quando a API direta (Meta/Google) falha por token/5xx.
//
// IMPORTANTE: este módulo PRESSUPÕE que os slugs e o shape de response foram validados
// manualmente no Composio Dashboard antes do primeiro deploy. Os slugs default abaixo
// são placeholders; ajuste para o que sua conta Composio realmente expõe.
//
// Variável de ambiente necessária: COMPOSIO_API_KEY
// Por integração no Supabase: integracao.composio_connected_account_id

const COMPOSIO_API = "https://backend.composio.dev/api/v3";

export type ComposioInsightsRow = {
  campaign_id: string;
  date?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  actions?: Array<{ action_type: string; value: string | number }>;
  raw?: any;
};

export type ComposioCallResult = {
  ok: boolean;
  rows?: ComposioInsightsRow[];
  error?: string;
  raw?: any;
};

function apiKey(): string | undefined {
  return Deno.env.get("COMPOSIO_API_KEY") || undefined;
}

export function composioEnabled(connectedAccountId: string | null | undefined): boolean {
  return !!apiKey() && !!connectedAccountId;
}

async function executeTool(slug: string, params: any, connectedAccountId: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("COMPOSIO_API_KEY ausente no ambiente");

  const res = await fetch(`${COMPOSIO_API}/tools/execute/${slug}`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connected_account_id: connectedAccountId,
      arguments: params,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Composio ${slug} HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// Meta: insights de campanha entre datas. Slug default pode precisar de ajuste.
export async function fetchMetaInsightsViaComposio(opts: {
  connectedAccountId: string;
  adAccountId: string;
  campaignIds: string[];
  since: string;
  until: string;
  slug?: string;
}): Promise<ComposioCallResult> {
  try {
    const slug = opts.slug || Deno.env.get("COMPOSIO_SLUG_META_INSIGHTS") || "META_GET_CAMPAIGN_INSIGHTS";
    const raw = await executeTool(slug, {
      ad_account_id: opts.adAccountId,
      campaign_ids: opts.campaignIds,
      time_range: { since: opts.since, until: opts.until },
      level: "campaign",
      fields: ["campaign_id", "impressions", "clicks", "spend", "actions", "reach", "frequency"],
      use_unified_attribution_setting: true,
    }, opts.connectedAccountId);

    const data = raw?.data?.data || raw?.data || [];
    const rows: ComposioInsightsRow[] = (Array.isArray(data) ? data : []).map((d: any) => ({
      campaign_id: String(d.campaign_id ?? d.id ?? ""),
      date: d.date_start || d.date,
      spend: Number(d.spend ?? 0),
      impressions: Number(d.impressions ?? 0),
      clicks: Number(d.clicks ?? 0),
      actions: Array.isArray(d.actions) ? d.actions : [],
      raw: d,
    }));

    return { ok: true, rows, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Google Ads: métricas de campanha entre datas. Slug default pode precisar de ajuste.
export async function fetchGoogleAdsMetricsViaComposio(opts: {
  connectedAccountId: string;
  customerId: string;
  loginCustomerId?: string;
  campaignIds: string[];
  since: string;
  until: string;
  slug?: string;
}): Promise<ComposioCallResult> {
  try {
    const slug = opts.slug || Deno.env.get("COMPOSIO_SLUG_GOOGLE_INSIGHTS") || "GOOGLEADS_GET_CAMPAIGN_METRICS";
    const raw = await executeTool(slug, {
      customer_id: opts.customerId,
      login_customer_id: opts.loginCustomerId,
      campaign_ids: opts.campaignIds,
      date_range: { since: opts.since, until: opts.until },
      metrics: ["impressions", "clicks", "cost_micros", "conversions", "average_cpc"],
    }, opts.connectedAccountId);

    const data = raw?.data?.results || raw?.data || [];
    const rows: ComposioInsightsRow[] = (Array.isArray(data) ? data : []).map((d: any) => ({
      campaign_id: String(d.campaign?.id ?? d.campaign_id ?? ""),
      date: d.segments?.date || d.date,
      spend: Number(d.metrics?.cost_micros ?? d.cost_micros ?? 0) / 1_000_000,
      impressions: Number(d.metrics?.impressions ?? d.impressions ?? 0),
      clicks: Number(d.metrics?.clicks ?? d.clicks ?? 0),
      actions: [{ action_type: "conversions", value: Number(d.metrics?.conversions ?? d.conversions ?? 0) }],
      raw: d,
    }));

    return { ok: true, rows, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Google Search Console: query analytics por página + query + data via Composio.
// Slug default a confirmar na pré-validação.
export type GSCRow = {
  url: string;
  query?: string;
  date?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  raw?: any;
};
export type GSCCallResult = { ok: boolean; rows?: GSCRow[]; error?: string; raw?: any };

export async function fetchGSCQueryAnalytics(opts: {
  connectedAccountId: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: ("page" | "query" | "date")[];
  rowLimit?: number;
  slug?: string;
}): Promise<GSCCallResult> {
  try {
    const slug = opts.slug
      || Deno.env.get("COMPOSIO_SLUG_GSC_QUERY_ANALYTICS")
      || "GOOGLE_SEARCH_CONSOLE_QUERY_ANALYTICS";
    const dims = opts.dimensions ?? ["page", "query", "date"];
    const raw = await executeTool(slug, {
      site_url: opts.siteUrl,
      start_date: opts.startDate,
      end_date: opts.endDate,
      dimensions: dims,
      row_limit: opts.rowLimit ?? 5000,
    }, opts.connectedAccountId);

    const data = raw?.data?.rows || raw?.rows || raw?.data || [];
    const idxPage = dims.indexOf("page");
    const idxQuery = dims.indexOf("query");
    const idxDate = dims.indexOf("date");
    const rows: GSCRow[] = (Array.isArray(data) ? data : []).map((d: any) => {
      const keys = Array.isArray(d.keys) ? d.keys : [];
      return {
        url: idxPage >= 0 ? (keys[idxPage] ?? "") : (d.page ?? d.url ?? ""),
        query: idxQuery >= 0 ? keys[idxQuery] : d.query,
        date: idxDate >= 0 ? keys[idxDate] : d.date,
        impressions: Number(d.impressions ?? 0),
        clicks: Number(d.clicks ?? 0),
        ctr: Number(d.ctr ?? 0),
        position: Number(d.position ?? 0),
        raw: d,
      };
    });

    return { ok: true, rows, raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
