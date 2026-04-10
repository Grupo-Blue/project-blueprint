import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashApiKey } from "../_shared/api-key-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Auth helper ──────────────────────────────────────────────
async function authenticateRequest(req: Request): Promise<{ ok: boolean; error?: string }> {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return { ok: false, error: "Missing API key. Send via x-api-key header or Bearer token." };

  const keyHash = await hashApiKey(apiKey);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, empresa, permissions, is_active, expires_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Invalid API key." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false, error: "API key expired." };

  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});

  return { ok: true };
}

function getAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── MCP Server ───────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "sgt-marketing",
  version: "1.0.0",
});

// ── TOOLS ────────────────────────────────────────────────────

// === EMPRESAS ===
mcpServer.tool("list_empresas", {
  description: "List all companies (empresas) in the system with their KPI targets.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const db = getAdmin();
    const { data, error } = await db.from("empresa").select("*").order("nome");
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_empresa", {
  description: "Get a single company by ID with full details.",
  inputSchema: {
    type: "object",
    properties: { id_empresa: { type: "string", description: "Company UUID" } },
    required: ["id_empresa"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from("empresa").select("*").eq("id_empresa", args.id_empresa).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data) return { content: [{ type: "text" as const, text: "Company not found." }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === LEADS ===
mcpServer.tool("search_leads", {
  description: "Search leads by name, email, phone, or filters. Returns up to 100 results.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term (name, email or phone)" },
      id_empresa: { type: "string", description: "Filter by company UUID" },
      status: { type: "string", description: "Filter by status" },
      origem_canal: { type: "string", description: "Filter by origin channel" },
      data_inicio: { type: "string", description: "Start date (YYYY-MM-DD)" },
      data_fim: { type: "string", description: "End date (YYYY-MM-DD)" },
      limit: { type: "number", description: "Max results (default 50, max 100)" },
    },
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const max = Math.min(args.limit || 50, 100);
    let q = db.from("lead")
      .select("id_lead, nome_lead, email, telefone, id_empresa, origem_canal, origem_tipo, stage_atual, utm_source, utm_medium, utm_campaign, venda_realizada, is_mql, data_criacao, amelia_icp, amelia_persona, amelia_temperatura, amelia_prioridade, amelia_score", { count: "exact" })
      .order("data_criacao", { ascending: false })
      .limit(max);

    if (args.query) q = q.or(`nome_lead.ilike.%${args.query}%,email.ilike.%${args.query}%,telefone.ilike.%${args.query}%`);
    if (args.id_empresa) q = q.eq("id_empresa", args.id_empresa);
    if (args.status) q = q.eq("stage_atual", args.status);
    if (args.origem_canal) q = q.eq("origem_canal", args.origem_canal);
    if (args.data_inicio) q = q.gte("data_criacao", args.data_inicio);
    if (args.data_fim) q = q.lte("data_criacao", args.data_fim);

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ total: count, leads: data }, null, 2) }] };
  },
});

mcpServer.tool("get_lead", {
  description: "Get a single lead by ID with full details.",
  inputSchema: {
    type: "object",
    properties: { id_lead: { type: "string", description: "Lead UUID" } },
    required: ["id_lead"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from("lead").select("*").eq("id_lead", args.id_lead).maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data) return { content: [{ type: "text" as const, text: "Lead not found." }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("create_lead", {
  description: "Create a new lead in the system.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Company UUID (required)" },
      nome_lead: { type: "string", description: "Full name" },
      email: { type: "string", description: "Email address" },
      telefone: { type: "string", description: "Phone number" },
      organizacao: { type: "string", description: "Organization" },
      origem_canal: { type: "string", description: "Origin channel (e.g. GOOGLE, META, ORGANICO)" },
      origem_tipo: { type: "string", description: "Origin type (INBOUND, OUTBOUND)" },
      utm_source: { type: "string" },
      utm_medium: { type: "string" },
      utm_campaign: { type: "string" },
      utm_content: { type: "string" },
      utm_term: { type: "string" },
      observacoes: { type: "string" },
    },
    required: ["id_empresa"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from("lead").insert({
      id_empresa: args.id_empresa,
      nome_lead: args.nome_lead || "Sem nome",
      email: args.email || null,
      telefone: args.telefone || null,
      organizacao: args.organizacao || null,
      origem_canal: args.origem_canal || "API",
      origem_tipo: args.origem_tipo || "INBOUND",
      stage_atual: "lead",
      utm_source: args.utm_source || null,
      utm_medium: args.utm_medium || null,
      utm_campaign: args.utm_campaign || null,
      utm_content: args.utm_content || null,
      utm_term: args.utm_term || null,
      observacoes: args.observacoes || null,
      data_criacao: new Date().toISOString(),
    }).select("id_lead, nome_lead, email").single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Lead created: ${JSON.stringify(data)}` }] };
  },
});

mcpServer.tool("update_lead", {
  description: "Update an existing lead by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id_lead: { type: "string", description: "Lead UUID (required)" },
      nome_lead: { type: "string" },
      email: { type: "string" },
      telefone: { type: "string" },
      organizacao: { type: "string" },
      stage_atual: { type: "string" },
      origem_canal: { type: "string" },
      venda_realizada: { type: "boolean" },
      is_mql: { type: "boolean" },
      observacoes: { type: "string" },
      score_temperatura: { type: "string" },
    },
    required: ["id_lead"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { id_lead, ...fields } = args;
    const update: any = {};
    for (const [k, v] of Object.entries(fields)) { if (v !== undefined) update[k] = v; }
    if (Object.keys(update).length === 0) return { content: [{ type: "text" as const, text: "No fields to update." }] };
    const { error } = await db.from("lead").update(update).eq("id_lead", id_lead);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Lead ${id_lead} updated successfully.` }] };
  },
});

// === CAMPANHAS ===
mcpServer.tool("list_campanhas", {
  description: "List campaigns with optional filters. Includes ad account and company info.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Filter by company UUID" },
      ativas_apenas: { type: "boolean", description: "Only active campaigns" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const max = Math.min(args.limit || 100, 500);
    let q = db.from("campanha")
      .select(`*, conta_anuncio (id_conta, nome, plataforma, id_empresa, empresa:id_empresa (nome))`)
      .order("nome")
      .limit(max);
    if (args.ativas_apenas) q = q.eq("ativa", true);
    if (args.id_empresa) q = q.eq("conta_anuncio.id_empresa", args.id_empresa);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === MÉTRICAS ===
mcpServer.tool("get_metricas_empresa", {
  description: "Get daily metrics for a company in a date range. Returns verba, leads, vendas, CPL, CAC, etc.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Company UUID (required)" },
      data_inicio: { type: "string", description: "Start date YYYY-MM-DD (required)" },
      data_fim: { type: "string", description: "End date YYYY-MM-DD (required)" },
    },
    required: ["id_empresa", "data_inicio", "data_fim"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from("empresa_metricas_dia")
      .select("*")
      .eq("id_empresa", args.id_empresa)
      .gte("data", args.data_inicio)
      .lte("data", args.data_fim)
      .order("data");
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_metricas_campanha", {
  description: "Get daily metrics for a campaign in a date range. Returns impressoes, cliques, leads, verba, CPC, etc.",
  inputSchema: {
    type: "object",
    properties: {
      id_campanha: { type: "string", description: "Campaign UUID (required)" },
      data_inicio: { type: "string", description: "Start date YYYY-MM-DD (required)" },
      data_fim: { type: "string", description: "End date YYYY-MM-DD (required)" },
    },
    required: ["id_campanha", "data_inicio", "data_fim"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from("campanha_metricas_dia")
      .select("*")
      .eq("id_campanha", args.id_campanha)
      .gte("data", args.data_inicio)
      .lte("data", args.data_fim)
      .order("data");
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === ALERTAS ===
mcpServer.tool("list_alertas", {
  description: "List automatic alerts with optional filters.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Filter by company UUID" },
      resolvido: { type: "boolean", description: "Filter by resolved status" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const max = Math.min(args.limit || 50, 200);
    let q = db.from("alerta_automatico").select("*").order("created_at", { ascending: false }).limit(max);
    if (args.id_empresa) q = q.eq("id_empresa", args.id_empresa);
    if (args.resolvido !== undefined) q = q.eq("resolvido", args.resolvido);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("resolve_alerta", {
  description: "Mark an alert as resolved.",
  inputSchema: {
    type: "object",
    properties: { id_alerta: { type: "string", description: "Alert UUID (required)" } },
    required: ["id_alerta"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { error } = await db.from("alerta_automatico")
      .update({ resolvido: true, resolvido_em: new Date().toISOString(), resolvido_por: "mcp-api" })
      .eq("id_alerta", args.id_alerta);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Alert ${args.id_alerta} resolved.` }] };
  },
});

// === CRIATIVOS ===
mcpServer.tool("list_criativos", {
  description: "List ad creatives for a campaign.",
  inputSchema: {
    type: "object",
    properties: {
      id_campanha: { type: "string", description: "Campaign UUID (required)" },
      ativo: { type: "boolean", description: "Filter by active status" },
    },
    required: ["id_campanha"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    let q = db.from("criativo").select("*").eq("id_campanha", args.id_campanha);
    if (args.ativo !== undefined) q = q.eq("ativo", args.ativo);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === INTEGRAÇÕES ===
mcpServer.tool("list_integracoes", {
  description: "List integrations for a company.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Filter by company UUID" },
      tipo: { type: "string", description: "Filter by type (META, GOOGLE, PIPEDRIVE, MAUTIC, GA4, etc.)" },
    },
  },
  handler: async (args: any) => {
    const db = getAdmin();
    let q = db.from("integracao").select("*").order("created_at");
    if (args.id_empresa) q = q.eq("id_empresa", args.id_empresa);
    if (args.tipo) q = q.eq("tipo", args.tipo);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === PIPEDRIVE DEALS ===
mcpServer.tool("list_pipedrive_deals", {
  description: "List Pipedrive deals synced to the system.",
  inputSchema: {
    type: "object",
    properties: {
      id_empresa: { type: "string", description: "Filter by company UUID" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const max = Math.min(args.limit || 100, 500);
    let q = db.from("pipedrive_deal").select("*").order("updated_at", { ascending: false }).limit(max);
    if (args.id_empresa) q = q.eq("id_empresa", args.id_empresa);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === QUERY GENÉRICA ===
mcpServer.tool("query_table", {
  description: "Run a generic query on any table. Use with caution. Supports filters, ordering, and limits.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (required)" },
      select: { type: "string", description: "Columns to select (default: *)" },
      filters: { type: "object", description: "Key-value filters (equality)" },
      order_column: { type: "string", description: "Column to order by" },
      order_ascending: { type: "boolean", description: "Ascending order (default: true)" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    required: ["table"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    let q = db.from(args.table).select(args.select || "*");
    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        q = q.eq(key, value);
      }
    }
    if (args.order_column) q = q.order(args.order_column, { ascending: args.order_ascending ?? true });
    const { data, error } = await q.limit(args.limit || 100);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// === INSERT GENÉRICO ===
mcpServer.tool("insert_record", {
  description: "Insert a record into any table.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (required)" },
      record: { type: "object", description: "Record data as key-value pairs (required)" },
    },
    required: ["table", "record"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    const { data, error } = await db.from(args.table).insert(args.record).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Record inserted: ${JSON.stringify(data)}` }] };
  },
});

// === UPDATE GENÉRICO ===
mcpServer.tool("update_record", {
  description: "Update records in any table matching filters.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (required)" },
      filters: { type: "object", description: "Key-value filters to match rows (required)" },
      data: { type: "object", description: "Fields to update (required)" },
    },
    required: ["table", "filters", "data"],
  },
  handler: async (args: any) => {
    const db = getAdmin();
    let q = db.from(args.table).update(args.data);
    for (const [key, value] of Object.entries(args.filters)) {
      q = q.eq(key, value as any);
    }
    const { error, count } = await q.select();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Updated successfully.` }] };
  },
});

// ── Hono app + transport ─────────────────────────────────────
const app = new Hono();
const transport = new StreamableHttpTransport();

app.use("/*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type, accept, mcp-session-id",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      },
    });
  }

  const auth = await authenticateRequest(c.req.raw);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await next();
});

const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  const response = await httpHandler(c.req.raw);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "authorization, x-api-key, x-client-info, apikey, content-type, accept, mcp-session-id");
  return response;
});

Deno.serve(app.fetch);
