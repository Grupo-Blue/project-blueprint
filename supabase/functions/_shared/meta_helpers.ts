// Helpers compartilhados para coleta Meta Ads.

const DEFAULT_ACTION_TYPES = ["lead", "onsite_conversion.lead_grouped"];

// Resolve timezone da conta Meta. Cacheia em config_json.timezone_cache (rotacionado a cada 7 dias).
export async function resolveTimezoneConta(opts: {
  supabase: any;
  integracao: any;
  adAccountId: string;
  accessToken: string;
}): Promise<string> {
  const cached = opts.integracao.config_json?.timezone_cache;
  const cachedAt = opts.integracao.config_json?.timezone_cached_at;
  if (cached && cachedAt) {
    const idadeDias = (Date.now() - new Date(cachedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (idadeDias < 7) return cached;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${opts.adAccountId}?fields=timezone_name&access_token=${opts.accessToken}`,
    );
    if (res.ok) {
      const data = await res.json();
      const tz = data.timezone_name || "America/Sao_Paulo";
      const newConfig = {
        ...opts.integracao.config_json,
        timezone_cache: tz,
        timezone_cached_at: new Date().toISOString(),
      };
      await opts.supabase
        .from("integracao")
        .update({ config_json: newConfig })
        .eq("id_integracao", opts.integracao.id_integracao);
      return tz;
    }
  } catch (err) {
    console.warn("[meta_helpers] Falha ao buscar timezone, usando América/Sao_Paulo:", err);
  }
  return "America/Sao_Paulo";
}

// Retorna data "hoje" no timezone fornecido em formato YYYY-MM-DD.
export function hojeNoTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

// Calcula leads a partir de actions[] usando lista configurada para a campanha (ou default da empresa).
export function calcularLeadsDeActions(
  actions: Array<{ action_type: string; value: string | number }> | null | undefined,
  actionTypesCampanha: string[] | null,
  actionTypesEmpresaDefault: string[] | null,
): { leads: number; actionTypesUsados: string[] } {
  const tipos = actionTypesCampanha?.length
    ? actionTypesCampanha
    : actionTypesEmpresaDefault?.length
      ? actionTypesEmpresaDefault
      : DEFAULT_ACTION_TYPES;
  if (!actions?.length) return { leads: 0, actionTypesUsados: tipos };

  let total = 0;
  for (const a of actions) {
    if (tipos.includes(a.action_type)) {
      total += Number(a.value) || 0;
    }
  }
  return { leads: Math.round(total), actionTypesUsados: tipos };
}
