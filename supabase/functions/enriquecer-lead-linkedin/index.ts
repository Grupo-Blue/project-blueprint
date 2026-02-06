import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE_URL = "https://api.apify.com/v2";

const PERSONAL_DOMAINS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
  "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br",
  "globo.com", "zipmail.com.br", "r7.com", "protonmail.com",
];

function isPersonalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return PERSONAL_DOMAINS.includes(domain);
}

function determineSenioridade(cargo: string): string {
  const cargoLower = cargo.toLowerCase();
  
  if (/\b(ceo|cto|cfo|coo|cmo|cio|presidente|founder|co-founder|sócio|diretor|vp|vice.president)\b/.test(cargoLower)) {
    return "C-Level";
  }
  if (/\b(gerente|manager|head|coordenador|supervisor|superintendent)\b/.test(cargoLower)) {
    return "Senior";
  }
  if (/\b(senior|sênior|sr\.|pleno|specialist|especialista|analista\s+s[eê]nior)\b/.test(cargoLower)) {
    return "Pleno";
  }
  if (/\b(junior|júnior|jr\.|estagiário|trainee|assistente|auxiliar)\b/.test(cargoLower)) {
    return "Junior";
  }
  return "Pleno"; // default
}

async function runApifyActorAndWait(actorId: string, input: object, token: string): Promise<any[]> {
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const errText = await runResponse.text();
    throw new Error(`Apify actor start failed: ${runResponse.status} ${errText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("No run ID from Apify");

  const maxWait = 3 * 60 * 1000;
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data?.defaultDatasetId;
      const itemsRes = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}`);
      return await itemsRes.json();
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify run ${status}`);
    }
  }

  throw new Error("Apify run timed out");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { id_lead, id_empresa, limit = 20 } = await req.json().catch(() => ({}));

    // Build query for leads needing enrichment
    let query = supabase
      .from("lead")
      .select("id_lead, email, nome, id_empresa")
      .is("linkedin_url", null)
      .not("email", "is", null)
      .limit(limit);

    if (id_lead) {
      query = query.eq("id_lead", id_lead);
    } else if (id_empresa) {
      query = query.eq("id_empresa", id_empresa);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw new Error(`Leads fetch error: ${leadsError.message}`);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No leads to enrich", enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out personal emails
    const corporateLeads = leads.filter((l) => l.email && !isPersonalEmail(l.email));
    const skippedPersonal = leads.length - corporateLeads.length;

    let enriched = 0;
    const errors: string[] = [];

    // Process each lead individually (Apify enrichment is per-email)
    for (const lead of corporateLeads) {
      try {
        const results = await runApifyActorAndWait(
          "enrichmentlabs~linkedin-data-enrichment-api",
          { email: lead.email },
          APIFY_API_TOKEN
        );

        if (results && results.length > 0) {
          const profile = results[0];

          const updateData: Record<string, any> = {
            linkedin_url: profile.linkedinUrl || profile.profileUrl || null,
            linkedin_cargo: profile.currentTitle || profile.headline || null,
            linkedin_empresa: profile.currentCompany || null,
            linkedin_setor: profile.industry || null,
            linkedin_senioridade: profile.currentTitle
              ? determineSenioridade(profile.currentTitle)
              : null,
            linkedin_conexoes: profile.connectionsCount || null,
            linkedin_ultima_atualizacao: new Date().toISOString(),
          };

          // Remove null values
          const filteredUpdate = Object.fromEntries(
            Object.entries(updateData).filter(([_, v]) => v !== null)
          );

          if (Object.keys(filteredUpdate).length > 0) {
            const { error: updateError } = await supabase
              .from("lead")
              .update(filteredUpdate)
              .eq("id_lead", lead.id_lead);

            if (!updateError) {
              enriched++;
            } else {
              errors.push(`Update error for lead ${lead.id_lead}: ${updateError.message}`);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Enrichment error for ${lead.email}: ${msg}`);
        console.error(msg);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Log execution
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "enriquecer-lead-linkedin",
      status: errors.length === 0 ? "sucesso" : "parcial",
      detalhes_execucao: {
        total_leads: leads.length,
        skipped_personal: skippedPersonal,
        enriched,
        errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: leads.length,
        skipped_personal: skippedPersonal,
        enriched,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
