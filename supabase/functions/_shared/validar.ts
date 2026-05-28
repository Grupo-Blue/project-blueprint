export type ValidacaoResultado = {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
  errorKind?: "TOKEN_EXPIRED" | "PERMISSION" | "NOT_FOUND" | "DEVELOPER_TOKEN" | "UNAUTHENTICATED" | "OTHER";
};

export async function validarMetaAds(config: any): Promise<ValidacaoResultado> {
  const { access_token, ad_account_id } = config;
  if (!access_token || !ad_account_id) {
    return { success: false, error: "Access Token e Ad Account ID são obrigatórios", errorKind: "OTHER" };
  }

  const meResponse = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${access_token}`);
  if (!meResponse.ok) {
    const err = await meResponse.json().catch(() => ({}));
    if (err.error?.code === 190) {
      return {
        success: false,
        error: "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager.",
        errorKind: "TOKEN_EXPIRED",
      };
    }
    return { success: false, error: err.error?.message || "Token inválido", errorKind: "OTHER" };
  }
  const meData = await meResponse.json();

  const accountResponse = await fetch(
    `https://graph.facebook.com/v22.0/${ad_account_id}?fields=name,account_status,owner,timezone_name&access_token=${access_token}`
  );
  if (!accountResponse.ok) {
    const err = await accountResponse.json().catch(() => ({}));
    const errorCode = err.error?.code;
    const errorMsg = err.error?.message || "";

    if (errorCode === 200 || errorMsg.includes("ads_management") || errorMsg.includes("ads_read")) {
      return {
        success: false,
        error: "Sem permissão na conta de anúncio. No Meta Business Manager, vá em Configurações > Pessoas > System Users, selecione o System User e atribua acesso à conta de anúncio com permissão 'Gerenciar campanhas'.",
        details: { errorCode, errorMsg, token_user: meData.name || meData.id },
        errorKind: "PERMISSION",
      };
    }
    if (errorCode === 100) {
      return {
        success: false,
        error: `Conta de anúncio ${ad_account_id} não encontrada. Verifique se o ID está correto (formato: act_XXXXXXXXX).`,
        errorKind: "NOT_FOUND",
      };
    }
    return { success: false, error: err.error?.message || "Erro ao acessar conta de anúncio", errorKind: "OTHER" };
  }

  const accountData = await accountResponse.json();
  return {
    success: true,
    message: `Conectado com sucesso à conta "${accountData.name}"`,
    details: {
      account_name: accountData.name,
      account_status: accountData.account_status,
      timezone_name: accountData.timezone_name,
      token_user: meData.name || meData.id,
    },
  };
}

export async function validarGoogleAds(config: any): Promise<ValidacaoResultado> {
  const { developer_token, client_id, client_secret, refresh_token, customer_id } = config;
  if (!developer_token || !client_id || !client_secret || !refresh_token || !customer_id) {
    return { success: false, error: "Todos os campos de credenciais são obrigatórios", errorKind: "OTHER" };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.json().catch(() => ({}));
    if (err.error === "invalid_grant") {
      return {
        success: false,
        error: "Refresh token expirado ou revogado. Gere um novo no Google Cloud Console.",
        errorKind: "TOKEN_EXPIRED",
      };
    }
    return {
      success: false,
      error: "Falha ao obter access token. Verifique Client ID, Client Secret e Refresh Token.",
      errorKind: "UNAUTHENTICATED",
    };
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  const customerId = customer_id.replace(/-/g, "");
  const loginCustomerId = config.login_customer_id?.replace(/-/g, "") || customerId;

  const apiResponse = await fetch(
    `https://googleads.googleapis.com/v19/customers/${customerId}:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developer_token,
        "login-customer-id": loginCustomerId,
      },
    }
  );

  if (!apiResponse.ok) {
    const err = await apiResponse.json().catch(() => ({}));
    const errMsg = JSON.stringify(err);
    if (errMsg.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
      return {
        success: false,
        error: "Developer Token não aprovado. Solicite acesso Básico ou Standard no Google Ads API Center.",
        errorKind: "DEVELOPER_TOKEN",
      };
    }
    if (errMsg.includes("UNAUTHENTICATED")) {
      return {
        success: false,
        error: "Credenciais inválidas. Verifique Developer Token e permissões da conta.",
        errorKind: "UNAUTHENTICATED",
      };
    }
    return { success: false, error: err.error?.message || "Erro ao acessar Google Ads API", errorKind: "OTHER" };
  }

  return { success: true, message: "Credenciais do Google Ads válidas" };
}

export async function obterAccessTokenGoogle(config: any): Promise<{ access_token?: string; errorKind?: ValidacaoResultado["errorKind"]; error?: string }> {
  const { client_id, client_secret, refresh_token } = config;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.json().catch(() => ({}));
    if (err.error === "invalid_grant") {
      return { errorKind: "TOKEN_EXPIRED", error: "Refresh token expirado (invalid_grant)" };
    }
    return { errorKind: "UNAUTHENTICATED", error: err.error_description || err.error || "Falha no refresh token" };
  }

  const tokenData = await tokenResponse.json();
  return { access_token: tokenData.access_token };
}

// Mautic com permissão de e-mails. Diferente do validarMautic genérico, este testa /api/emails.
export async function validarMauticEmails(config: any): Promise<ValidacaoResultado> {
  const { url_base, login, senha } = config;
  if (!url_base || !login || !senha) {
    return { success: false, error: "url_base, login e senha são obrigatórios", errorKind: "OTHER" };
  }
  try {
    const auth = "Basic " + btoa(`${login}:${senha}`);
    const res = await fetch(`${url_base.replace(/\/$/, "")}/api/emails?limit=1`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (res.status === 401) return { success: false, error: "Credenciais Mautic inválidas", errorKind: "UNAUTHENTICATED" };
    if (res.status === 403) return { success: false, error: "Usuário Mautic sem permissão para visualizar e-mails", errorKind: "PERMISSION" };
    if (!res.ok) return { success: false, error: `Mautic /api/emails -> ${res.status}`, errorKind: "OTHER" };
    const data = await res.json().catch(() => ({}));
    return { success: true, message: `Acesso confirmado (${data.total ?? 0} e-mails na conta)` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), errorKind: "OTHER" };
  }
}

// WordPress REST API com Application Password (Basic Auth com user:app_password).
// Pode ser configurado também com Bearer token (JWT plugin); tentamos Basic primeiro, depois Bearer.
export async function validarWordPress(config: any): Promise<ValidacaoResultado> {
  const { url_base, usuario, app_password, bearer_token } = config;
  if (!url_base) return { success: false, error: "url_base é obrigatório", errorKind: "OTHER" };

  const headers: Record<string, string> = { Accept: "application/json" };
  if (usuario && app_password) {
    headers["Authorization"] = "Basic " + btoa(`${usuario}:${app_password}`);
  } else if (bearer_token) {
    headers["Authorization"] = `Bearer ${bearer_token}`;
  } else {
    return { success: false, error: "Informe usuario+app_password ou bearer_token", errorKind: "OTHER" };
  }

  try {
    const res = await fetch(`${url_base.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=1`, { headers });
    if (res.status === 401) return { success: false, error: "Credenciais WordPress inválidas", errorKind: "UNAUTHENTICATED" };
    if (res.status === 403) return { success: false, error: "Usuário sem permissão para leitura de posts", errorKind: "PERMISSION" };
    if (res.status === 404) return { success: false, error: "REST API não encontrada — verifique se /wp-json está habilitado", errorKind: "NOT_FOUND" };
    if (!res.ok) return { success: false, error: `WordPress /wp-json -> ${res.status}`, errorKind: "OTHER" };
    const total = res.headers.get("x-wp-total") || "?";
    return { success: true, message: `Conexão OK. Total de posts publicados: ${total}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), errorKind: "OTHER" };
  }
}

// GSC via Composio: valida apenas que existe connected_account_id + site_url configurados.
// O teste real depende do slug Composio e roda na coleta.
export async function validarGSC(config: any): Promise<ValidacaoResultado> {
  const { site_url, composio_connected_account_id } = config;
  if (!site_url) return { success: false, error: "site_url é obrigatório (ex: https://www.tayara.com.br/)", errorKind: "OTHER" };
  if (!composio_connected_account_id) {
    return { success: false, error: "composio_connected_account_id é obrigatório (configure a conexão Search Console no Composio)", errorKind: "OTHER" };
  }
  if (!Deno.env.get("COMPOSIO_API_KEY")) {
    return { success: false, error: "COMPOSIO_API_KEY ausente no ambiente Supabase", errorKind: "OTHER" };
  }
  return { success: true, message: `Configuração presente para ${site_url}. Validação real ocorrerá na primeira coleta.` };
}
