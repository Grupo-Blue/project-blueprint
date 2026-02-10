import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integracao_id } = await req.json();

    if (!integracao_id) {
      return new Response(
        JSON.stringify({ success: false, error: "integracao_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: integracao, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("id_integracao", integracao_id)
      .single();

    if (intError || !integracao) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integracao.config_json as any;
    let result: { success: boolean; message?: string; error?: string; details?: any };

    switch (integracao.tipo) {
      case "META_ADS":
        result = await validarMetaAds(config);
        break;
      case "GOOGLE_ADS":
        result = await validarGoogleAds(config);
        break;
      case "PIPEDRIVE":
        result = await validarPipedrive(config);
        break;
      case "TOKENIZA":
        result = await validarTokeniza(config);
        break;
      case "MAUTIC":
        result = await validarMautic(config);
        break;
      case "NOTION":
        result = await validarNotion(config);
        break;
      case "METRICOOL":
        result = await validarMetricool(config);
        break;
      case "GA4":
        result = await validarGA4(config);
        break;
      case "CHATWOOT":
        result = await validarChatblue(config);
        break;
      default:
        result = { success: false, error: `Tipo ${integracao.tipo} não suportado para validação` };
    }

    const status = result.success ? 200 : 400;
    return new Response(
      JSON.stringify(result),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na validação:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validarMetaAds(config: any) {
  const { access_token, ad_account_id } = config;
  if (!access_token || !ad_account_id) {
    return { success: false, error: "Access Token e Ad Account ID são obrigatórios" };
  }

  // Step 1: Validate token
  const meResponse = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${access_token}`);
  if (!meResponse.ok) {
    const err = await meResponse.json().catch(() => ({}));
    if (err.error?.code === 190) {
      return { success: false, error: "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager." };
    }
    return { success: false, error: err.error?.message || "Token inválido" };
  }
  const meData = await meResponse.json();

  // Step 2: Validate ad account access & permissions
  const accountResponse = await fetch(
    `https://graph.facebook.com/v22.0/${ad_account_id}?fields=name,account_status,owner&access_token=${access_token}`
  );
  if (!accountResponse.ok) {
    const err = await accountResponse.json().catch(() => ({}));
    const errorCode = err.error?.code;
    const errorMsg = err.error?.message || "";

    if (errorCode === 200 || errorMsg.includes("ads_management") || errorMsg.includes("ads_read")) {
      return {
        success: false,
        error: "Sem permissão na conta de anúncio. No Meta Business Manager, vá em Configurações > Pessoas > System Users, selecione o System User e atribua acesso à conta de anúncio com permissão 'Gerenciar campanhas'.",
        details: { errorCode, errorMsg, token_user: meData.name || meData.id }
      };
    }
    if (errorCode === 100) {
      return { success: false, error: `Conta de anúncio ${ad_account_id} não encontrada. Verifique se o ID está correto (formato: act_XXXXXXXXX).` };
    }
    return { success: false, error: err.error?.message || "Erro ao acessar conta de anúncio" };
  }

  const accountData = await accountResponse.json();
  return {
    success: true,
    message: `Conectado com sucesso à conta "${accountData.name}"`,
    details: { account_name: accountData.name, account_status: accountData.account_status, token_user: meData.name || meData.id }
  };
}

async function validarGoogleAds(config: any) {
  const { developer_token, client_id, client_secret, refresh_token, customer_id } = config;
  if (!developer_token || !client_id || !client_secret || !refresh_token || !customer_id) {
    return { success: false, error: "Todos os campos de credenciais são obrigatórios" };
  }

  // Get access token from refresh token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id, client_secret, refresh_token, grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    return { success: false, error: "Falha ao obter access token. Verifique Client ID, Client Secret e Refresh Token." };
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Test API access
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
      return { success: false, error: "Developer Token não aprovado. Solicite acesso Básico ou Standard no Google Ads API Center." };
    }
    if (errMsg.includes("UNAUTHENTICATED")) {
      return { success: false, error: "Credenciais inválidas. Verifique Developer Token e permissões da conta." };
    }
    return { success: false, error: err.error?.message || "Erro ao acessar Google Ads API" };
  }

  return { success: true, message: "Credenciais do Google Ads válidas" };
}

async function validarPipedrive(config: any) {
  const { api_token, domain } = config;
  if (!api_token || !domain) {
    return { success: false, error: "API Token e Domínio são obrigatórios" };
  }

  const response = await fetch(`https://${domain}.pipedrive.com/api/v1/users/me?api_token=${api_token}`);
  if (!response.ok) {
    return { success: false, error: "API Token inválido ou domínio incorreto" };
  }

  const data = await response.json();
  return { success: true, message: `Conectado como ${data.data?.name || "usuário"}` };
}

async function validarTokeniza(config: any) {
  const { api_token, base_url } = config;
  if (!api_token) {
    return { success: false, error: "API Token é obrigatório" };
  }

  const response = await fetch(`${base_url || "https://api.tokeniza.com.br"}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${api_token}` },
  });

  if (!response.ok) {
    return { success: false, error: "API Token inválido" };
  }

  return { success: true, message: "Credenciais da Tokeniza válidas" };
}

async function validarMautic(config: any) {
  const { url_base, login, senha } = config;
  if (!url_base || !login || !senha) {
    return { success: false, error: "URL, login e senha são obrigatórios" };
  }

  const response = await fetch(`${url_base}/api/contacts?limit=1`, {
    headers: { Authorization: "Basic " + btoa(`${login}:${senha}`) },
  });

  if (!response.ok) {
    return { success: false, error: "Credenciais do Mautic inválidas ou URL incorreta" };
  }

  return { success: true, message: "Credenciais do Mautic válidas" };
}

async function validarNotion(config: any) {
  const { api_token, database_id } = config;
  if (!api_token) {
    return { success: false, error: "API Token é obrigatório" };
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${database_id}`, {
    headers: {
      Authorization: `Bearer ${api_token}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    return { success: false, error: "Token Notion inválido ou sem acesso ao banco de dados" };
  }

  const data = await response.json();
  return { success: true, message: `Conectado ao banco "${data.title?.[0]?.plain_text || database_id}"` };
}

async function validarMetricool(config: any) {
  const { user_token, user_id, blog_id } = config;
  if (!user_token || !user_id || !blog_id) {
    return { success: false, error: "Todos os campos são obrigatórios" };
  }

  const response = await fetch(`https://app.metricool.com/api/v2/${user_id}/blog/${blog_id}`, {
    headers: { Authorization: `Bearer ${user_token}` },
  });

  if (!response.ok) {
    return { success: false, error: "Credenciais do Metricool inválidas" };
  }

  return { success: true, message: "Credenciais do Metricool válidas" };
}

async function validarGA4(config: any) {
  const { client_id, client_secret, refresh_token, property_id } = config;
  if (!client_id || !client_secret || !refresh_token || !property_id) {
    return { success: false, error: "Todos os campos são obrigatórios" };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id, client_secret, refresh_token, grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    return { success: false, error: "Falha ao obter access token GA4. Verifique credenciais OAuth." };
  }

  const tokenData = await tokenResponse.json();

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: [{ name: "sessions" }],
        limit: 1,
      }),
    }
  );

  if (!response.ok) {
    return { success: false, error: "Sem acesso à propriedade GA4. Verifique permissões." };
  }

  return { success: true, message: "Credenciais GA4 válidas" };
}

async function validarChatblue(config: any) {
  const { api_url, api_token } = config;
  if (!api_url || !api_token) {
    return { success: false, error: "URL da API e API Token são obrigatórios" };
  }

  const healthUrl = `${api_url}/external/health`;
  try {
    const response = await fetch(healthUrl, {
      headers: { "X-API-Key": api_token },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Erro ${response.status}: ${errText}` };
    }

    const data = await response.json();
    return { success: true, message: `Chatblue conectado: ${data.status || 'OK'}`, details: data };
  } catch (error) {
    return { success: false, error: `Não foi possível conectar em ${healthUrl}. Verifique se a URL está correta e a rota /api/external/health existe.` };
  }
}
