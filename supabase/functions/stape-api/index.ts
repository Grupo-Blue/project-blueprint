import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StapeApiRequest {
  action: "statistics" | "statistics-by-day" | "logs" | "test-connection" | "container-info";
  /** Obrigatório para ações por-container (exceto test-connection) */
  container_id?: string;
  region?: "global" | "eu";
  /** API key específica da empresa (opcional, fallback para env) */
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

    // Usar api_key do body ou fallback para env
    const stapeApiKey = api_key || Deno.env.get("STAPE_API_KEY");

    if (!stapeApiKey) {
      console.error("[stape-api] API Key não fornecida nem configurada");
      return new Response(
        JSON.stringify({ success: false, error: "API Key do Stape não configurada. Configure nas Integrações da empresa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // container_id só é obrigatório quando a ação é específica de um container
    const requiresContainer = action !== "test-connection";
    if (requiresContainer && !container_id) {
      return new Response(
        JSON.stringify({ success: false, error: "container_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar URL base baseado na região (API v2 do Stape)
    const baseUrl = region === "eu" ? "https://api.app.eu.stape.io" : "https://api.app.stape.io";

    // Auth do Stape: o formato do header varia conforme o esquema da API.
    // Para evitar 401 por formato incorreto, tentamos alguns padrões comuns.
    const headerCandidates: Array<{ mode: string; headers: Record<string, string> }> = [
      {
        mode: "authorization_bearer",
        headers: {
          Authorization: `Bearer ${stapeApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      {
        mode: "authorization_raw",
        headers: {
          Authorization: stapeApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      {
        mode: "authorization_apikey",
        headers: {
          Authorization: `ApiKey ${stapeApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      {
        mode: "x_api_key_only",
        headers: {
          "X-API-Key": stapeApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      {
        mode: "x_api_key_and_bearer",
        headers: {
          Authorization: `Bearer ${stapeApiKey}`,
          "X-API-Key": stapeApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    ];

    let endpoint = "";
    let queryParams = "";

    switch (action) {
      case "test-connection":
        // Testar conexão listando containers
        endpoint = `/api/v2/containers`;
        break;

      case "statistics":
        // Endpoint de analytics do container
        endpoint = `/api/v2/containers/${container_id}/analytics/info`;
        break;

      case "statistics-by-day":
        // Uso de analytics com clientes por período
        endpoint = `/api/v2/containers/${container_id}/analytics/clients`;
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const fullUrl = `${baseUrl}${endpoint}${queryParams}`;
    console.log(`[stape-api] Chamando: ${fullUrl}`);

    let response: Response | null = null;
    let authModeUsed: string | null = null;

    for (const candidate of headerCandidates) {
      const res = await fetch(fullUrl, {
        method: "GET",
        headers: candidate.headers,
      });

      authModeUsed = candidate.mode;

      // Se funcionou, paramos
      if (res.ok) {
        response = res;
        break;
      }

      // Se não funcionou e é 401/403, tentamos outro formato de auth
      if (res.status === 401 || res.status === 403) {
        console.warn(`[stape-api] Auth falhou (${candidate.mode}) -> ${res.status}`);
        response = res;
        continue;
      }

      // Outros erros (400/404/500...) não valem retry de auth
      response = res;
      break;
    }

    if (!response) {
      throw new Error("Falha ao chamar API do Stape (sem resposta)");
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
         stape_auth_mode: authModeUsed,
         status_code: response.status,
         success: response.ok,
       },
      mensagem_erro: response.ok ? null : responseText.substring(0, 500),
    });

    // Importante: não propagar o status HTTP do Stape para o cliente.
    // Quando retornamos 401/403/etc, o supabase-js lança FunctionsHttpError ("non-2xx"),
    // o que quebra o fluxo do frontend. Em vez disso, retornamos 200 e sinalizamos erro no payload.
    if (!response.ok) {
      console.error(`[stape-api] Erro na API Stape: ${response.status}`, responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro na API Stape: ${response.status}`,
          stape_status_code: response.status,
          details: responseData,
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
