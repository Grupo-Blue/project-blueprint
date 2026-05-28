// Helpers de atribuição multi-toque.
// Usado por: calcular-atribuicao, lp-lead-webhook, criar-lead-api.

export interface Touchpoint {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  url_origem?: string | null;
  referrer?: string | null;
  capturado_em?: string | null;
  fonte?: string | null;
}

// Mapeia UTM source/medium para o ENUM canal_origem usado no SGT.
export function canalDoTouchpoint(t: Touchpoint): string {
  const s = (t.utm_source ?? "").toLowerCase();
  const m = (t.utm_medium ?? "").toLowerCase();

  if (m === "cpc" || m === "paid-social" || m === "display") {
    if (s === "google") return "GOOGLE";
    if (s === "facebook" || s === "meta" || s === "instagram") return "META";
  }
  if (s === "google") return "GOOGLE";
  if (s === "facebook" || s === "meta") return "META";
  if (s === "instagram" && (m === "social" || m === "organic")) return "SOCIAL_ORGANICO";
  if (m === "email" || s === "email" || s === "newsletter" || m === "newsletter") return "EMAIL";
  if (s === "whatsapp" || m === "messaging" || m === "whatsapp") return "WHATSAPP";
  if (m === "organic" || s === "organic") return "ORGANICO";
  if (m === "direct" || s === "(direct)" || s === "direct") return "DIRETO";
  if (s) return "OUTRO";
  return "DIRETO";
}

// Calcula atribuição linear: peso 1/n para cada touchpoint, agregado por canal.
// Retorna { CANAL: pesoEntre0e1 } com soma ≈ 1.0.
export function atribuicaoLinear(touchpoints: Touchpoint[]): Record<string, number> {
  if (!touchpoints.length) return {};
  const peso = 1 / touchpoints.length;
  const out: Record<string, number> = {};
  for (const t of touchpoints) {
    const canal = canalDoTouchpoint(t);
    out[canal] = (out[canal] ?? 0) + peso;
  }
  // Arredonda para 4 casas
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10000) / 10000;
  return out;
}

// Resumo de atribuição final para gravação na tabela lead.
export function resumirAtribuicao(touchpoints: Touchpoint[]) {
  if (!touchpoints.length) {
    return {
      first_touch_canal: null,
      first_touch_utm_source: null,
      first_touch_utm_medium: null,
      first_touch_utm_campaign: null,
      first_touch_utm_content: null,
      first_touch_em: null,
      last_touch_canal: null,
      total_toques: 0,
      atribuicao_linear: {},
    };
  }
  const first = touchpoints[0];
  const last = touchpoints[touchpoints.length - 1];
  return {
    first_touch_canal: canalDoTouchpoint(first),
    first_touch_utm_source: first.utm_source ?? null,
    first_touch_utm_medium: first.utm_medium ?? null,
    first_touch_utm_campaign: first.utm_campaign ?? null,
    first_touch_utm_content: first.utm_content ?? null,
    first_touch_em: first.capturado_em ?? null,
    last_touch_canal: canalDoTouchpoint(last),
    total_toques: touchpoints.length,
    atribuicao_linear: atribuicaoLinear(touchpoints),
  };
}
