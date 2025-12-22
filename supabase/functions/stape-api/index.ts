import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StapeApiRequest {
  action: "statistics" | "statistics-by-day" | "logs" | "test-connection";
  container_id: string;
  region?: "global" | "eu";
  log_type?: "access" | "request" | "response";
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
  const stapeApiKey = Deno.env.get("STAPE_API_KEY");

  try {
    if (!stapeApiKey) {
      console.error("[stape-api] STAPE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ success: false, error: "STAPE_API_KEY não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: StapeApiRequest = await req.json();
    const { action, container_id, region = "global", log_type, start_date, end_date, limit = 100 } = body;

    if (!container_id) {
      return new Response(
        JSON.stringify({ success: false, error: "container_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar URL base baseado na região
    const baseUrl = region === "eu" 
      ? "https://eu.stape.io/api" 
      : "https://stape.io/api";

    const headers = {
      "Authorization": `Bearer ${stapeApiKey}`,
      "Content-Type": "application/json",
    };

    let endpoint = "";
    let queryParams = "";

    switch (action) {
      case "test-connection":
        // Testar conexão buscando estatísticas básicas
        endpoint = `/containers/${container_id}/statistics`;
        break;

      case "statistics":
        endpoint = `/containers/${container_id}/statistics`;
        break;

      case "statistics-by-day":
        endpoint = `/containers/${container_id}/statistics-by-day`;
        if (start_date || end_date) {
          const params = new URLSearchParams();
          if (start_date) params.append("start_date", start_date);
          if (end_date) params.append("end_date", end_date);
          queryParams = `?${params.toString()}`;
        }
        break;

      case "logs":
        if (!log_type) {
          return new Response(
            JSON.stringify({ success: false, error: "log_type é obrigatório para ação 'logs'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `/containers/${container_id}/logs/${log_type}`;
        const logsParams = new URLSearchParams();
        logsParams.append("limit", String(limit));
        if (start_date) logsParams.append("start_date", start_date);
        if (end_date) logsParams.append("end_date", end_date);
        queryParams = `?${logsParams.toString()}`;
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const fullUrl = `${baseUrl}${endpoint}${queryParams}`;
    console.log(`[stape-api] Chamando: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

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

    if (!response.ok) {
      console.error(`[stape-api] Erro na API Stape: ${response.status}`, responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API Stape: ${response.status}`,
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
