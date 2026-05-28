import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resumirAtribuicao, Touchpoint } from "../_shared/atribuicao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const idLead = body.id_lead;
    const bulkLimite = Number(body.limite) || 1000;

    if (idLead) {
      await recalcularLead(supabase, idLead);
      return new Response(JSON.stringify({ success: true, id_lead: idLead }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo batch: leads que têm touchpoint mas first_touch_canal vazio
    const { data: leads, error } = await supabase
      .from("lead")
      .select("id_lead")
      .is("first_touch_canal", null)
      .eq("merged", false)
      .limit(bulkLimite);
    if (error) throw error;

    let atualizados = 0;
    for (const l of leads ?? []) {
      try {
        const ok = await recalcularLead(supabase, l.id_lead);
        if (ok) atualizados++;
      } catch (err) {
        console.error(`Erro ao recalcular ${l.id_lead}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, leads_examinados: leads?.length ?? 0, atualizados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function recalcularLead(supabase: any, idLead: string): Promise<boolean> {
  const { data: tps, error } = await supabase
    .from("lead_touchpoint")
    .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, url_origem, referrer, capturado_em, fonte")
    .eq("id_lead", idLead)
    .order("ordem", { ascending: true });
  if (error) throw error;
  if (!tps?.length) return false;

  const resumo = resumirAtribuicao(tps as Touchpoint[]);
  const { error: upErr } = await supabase
    .from("lead")
    .update(resumo)
    .eq("id_lead", idLead);
  if (upErr) throw upErr;
  return true;
}
