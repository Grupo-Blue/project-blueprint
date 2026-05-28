import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lista os top eventos disparados no GA4 nas últimas 24h para uma propriedade.
// Útil para o admin descobrir QUAL evento configurar como conversão por LP.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Erro refresh");
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { id_empresa, dias = 1 } = await req.json().catch(() => ({}));
    if (!id_empresa) {
      return new Response(JSON.stringify({ success: false, error: "id_empresa é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integracao, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "GA4")
      .eq("ativo", true)
      .eq("id_empresa", id_empresa)
      .maybeSingle();
    if (intError) throw intError;
    if (!integracao) {
      return new Response(JSON.stringify({ success: false, error: "Integração GA4 não encontrada para a empresa" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = integracao.config_json as any;
    const accessToken = await getAccessToken(config.client_id, config.client_secret, config.refresh_token);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - dias * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${config.property_id}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: 30,
        }),
      },
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`GA4 audit error: ${errData.error?.message || "desconhecido"}`);
    }

    const data = await res.json();
    const eventos = (data.rows ?? []).map((r: any) => ({
      evento: r.dimensionValues[0].value,
      contagem: parseInt(r.metricValues[0].value) || 0,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        property_id: config.property_id,
        periodo: { inicio: fmt(startDate), fim: fmt(endDate) },
        eventos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
