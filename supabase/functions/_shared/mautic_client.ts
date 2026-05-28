// Cliente HTTP para a API Mautic via Basic Auth.
// Mautic é o sistema de e-mail marketing usado pelo SGT (já existe integração para leads via webhook).
// Este módulo amplia para os endpoints de e-mail (campanhas, fluxos, listas, estatísticas).
//
// Config esperada em integracao.config_json: { url_base, login, senha }

export interface MauticConfig {
  url_base: string;
  login: string;
  senha: string;
}

export interface MauticPaginated<T> {
  total: number;
  items: T[];
}

function authHeader(config: MauticConfig): string {
  return "Basic " + btoa(`${config.login}:${config.senha}`);
}

function baseUrl(config: MauticConfig): string {
  return config.url_base.replace(/\/$/, "");
}

export async function mauticGet(
  config: MauticConfig,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `${baseUrl(config)}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(config), Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mautic ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

// Itera por todas as páginas usando start/limit (padrão Mautic).
// extractItems recebe o JSON cru e retorna { total, items }.
export async function mauticList<T = any>(
  config: MauticConfig,
  path: string,
  extractItems: (raw: any) => MauticPaginated<T>,
  pageSize = 200,
): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  while (true) {
    const raw = await mauticGet(config, path, { start, limit: pageSize });
    const { total, items } = extractItems(raw);
    out.push(...items);
    start += items.length;
    if (start >= total || items.length === 0) break;
    if (start > 50_000) break; // segurança
  }
  return out;
}

// /api/emails — retorna campanhas de e-mail (broadcasts).
// O Mautic devolve { total, emails: { ID: {...} } } — extrair como array.
export async function listarEmails(config: MauticConfig) {
  return mauticList(config, "/api/emails", (raw) => ({
    total: Number(raw.total ?? 0),
    items: Object.values(raw.emails ?? {}),
  }));
}

// /api/campaigns — fluxos/automações.
export async function listarCampaigns(config: MauticConfig) {
  return mauticList(config, "/api/campaigns", (raw) => ({
    total: Number(raw.total ?? 0),
    items: Object.values(raw.campaigns ?? {}),
  }));
}

// /api/segments — listas/segmentos.
export async function listarSegments(config: MauticConfig) {
  return mauticList(config, "/api/segments", (raw) => ({
    total: Number(raw.total ?? 0),
    items: Object.values(raw.lists ?? raw.segments ?? {}),
  }));
}
