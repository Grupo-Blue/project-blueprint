import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StapeApiRequest {
  action: "statistics" | "statistics-by-day" | "logs" | "test-connection" | "container-info";
  /** Container identifier (obrigatório exceto para test-connection) */
  container_id?: string;
  region?: "global" | "eu";
  /** Account API key da empresa (para API v2 de monitoramento) */
  api_key?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: StapeApiRequest = await req.json();
    const { action, container_id, region = "global", api_key, start_date, end_date, limit = 100 } = body;

    // Usar api_key do body (Account API Key) ou fallback para env
    const stapeAccountApiKey = api_key || Deno.env.get("STAPE_API_KEY");

    if (!stapeAccountApiKey) {
      console.error("[stape-api] Account API Key não fornecida nem configurada");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Account API Key do Stape não configurada. Configure nas Integrações da empresa.",
          hint: "Use a Account API Key (formato: hash simples), não a Container API Key (formato: sar:xxx:xxx)"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar que não é Container API Key (começa com "sar:")
    if (stapeAccountApiKey.startsWith("sar:")) {
      console.error("[stape-api] Container API Key usada em vez de Account API Key");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Você está usando a Container API Key. Para monitoramento, use a Account API Key.",
          hint: "Obtenha a Account API Key em stape.io/account/api"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // container_id só é obrigatório quando a ação é específica de um container
    const requiresContainer = action !== "test-connection";
    if (requiresContainer && !container_id) {
      return new Response(
        JSON.stringify({ success: false, error: "container_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar URL base baseado na região (API v2 do Stape)
    // SA East (Brazil), US, Asia = Global | Europa = EU
    const baseUrl = region === "eu" ? "https://api.app.eu.stape.io" : "https://api.app.stape.io";

    let endpoint = "";
    let queryParams = "";

    switch (action) {
      case "test-connection":
        // Testar conexão listando containers
        endpoint = `/api/v2/containers`;
        break;

      case "statistics":
        // Endpoint correto de estatísticas do container (documentação Swagger)
        endpoint = `/api/v2/containers/${container_id}/statistics`;
        break;

      case "statistics-by-day":
        // Estatísticas por dia
        endpoint = `/api/v2/containers/${container_id}/statistics-by-day`;
        if (start_date || end_date) {
          const params = new URLSearchParams();
          if (start_date) params.append("start_date", start_date);
          if (end_date) params.append("end_date", end_date);
          queryParams = `?${params.toString()}`;
        }
        break;

      case "logs":
        // Logs do container (changelog)
        endpoint = `/api/v2/containers/${container_id}/logs`;
        const logsParams = new URLSearchParams();
        logsParams.append("limit", String(limit));
        if (start_date) logsParams.append("start_date", start_date);
        if (end_date) logsParams.append("end_date", end_date);
        queryParams = `?${logsParams.toString()}`;
        break;

      case "container-info":
        // Obter informações do container específico
        endpoint = `/api/v2/containers/${container_id}`;
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const fullUrl = `${baseUrl}${endpoint}${queryParams}`;
    console.log(`[stape-api] Chamando: ${fullUrl}`);

    // Tentar múltiplos formatos de autenticação
    const authMethods: Array<{ name: string; headers: Record<string, string> }> = [
      { name: "Bearer", headers: { "Authorization": `Bearer ${stapeAccountApiKey}`, "Content-Type": "application/json", "Accept": "application/json" } },
      { name: "ApiKey", headers: { "Authorization": `ApiKey ${stapeAccountApiKey}`, "Content-Type": "application/json", "Accept": "application/json" } },
      { name: "Direct", headers: { "Authorization": stapeAccountApiKey, "Content-Type": "application/json", "Accept": "application/json" } },
      { name: "X-Api-Key", headers: { "X-Api-Key": stapeAccountApiKey, "Content-Type": "application/json", "Accept": "application/json" } },
      { name: "api-key header", headers: { "api-key": stapeAccountApiKey, "Content-Type": "application/json", "Accept": "application/json" } },
    ];

    let response: Response | null = null;
    let successfulMethod = "";
    const attempts: Array<{ method: string; status: number; body?: string }> = [];

    for (const auth of authMethods) {
      console.log(`[stape-api] Tentando auth: ${auth.name}`);
      
      const res = await fetch(fullUrl, {
        method: "GET",
        headers: auth.headers,
      });

      const bodyText = await res.text();
      attempts.push({ method: auth.name, status: res.status, body: bodyText.substring(0, 200) });

      if (res.ok) {
        response = new Response(bodyText, { status: res.status, headers: res.headers });
        successfulMethod = auth.name;
        console.log(`[stape-api] Auth bem-sucedida: ${auth.name}`);
        break;
      }

      // Se for 401/403, continuar tentando
      if (res.status === 401 || res.status === 403) {
        console.warn(`[stape-api] Auth falhou (${auth.name}): ${res.status}`);
        continue;
      }

      // Outros erros (404, 500, etc.) não valem retry
      response = new Response(bodyText, { status: res.status, headers: res.headers });
      break;
    }

    if (!response) {
      // Todas as tentativas falharam com 401/403
      return new Response(
        JSON.stringify({
          success: false,
          error: "Todas as tentativas de autenticação falharam",
          attempts,
          hint: "Verifique se a Account API Key está correta. A chave deve ser criada em stape.io -> Account Settings -> API Keys.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    const duration = Date.now() - startTime;

    // Logar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-api",
      status: response.ok ? "sucesso" : "erro",
      duracao_ms: duration,
      detalhes_execucao: {
        action,
        container_id,
        region,
        status_code: response.status,
        success: response.ok,
      },
      mensagem_erro: response.ok ? null : responseText.substring(0, 500),
    });

    // Não propagar status HTTP do Stape para o cliente
    if (!response.ok) {
      console.error(`[stape-api] Erro na API Stape: ${response.status}`, responseText);
      
      let errorHint = "";
      if (response.status === 401) {
        errorHint = "Verifique se você está usando a Account API Key correta. A chave deve ser criada em stape.io -> Account Settings -> API Keys.";
      } else if (response.status === 403) {
        errorHint = "A API Key não tem permissão. Verifique as configurações no Stape.";
      } else if (response.status === 404) {
        errorHint = "Container não encontrado. Verifique o Container ID.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro na API Stape: ${response.status}`,
          stape_status_code: response.status,
          hint: errorHint,
          details: responseData,
          request_url: fullUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[stape-api] Sucesso - ${action} em ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData,
        action,
        duration_ms: duration 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[stape-api] Erro:", error);

    // Logar erro
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "stape-api",
      status: "erro",
      duracao_ms: duration,
      mensagem_erro: error.message,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
