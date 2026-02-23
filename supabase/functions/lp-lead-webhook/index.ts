import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.substring(2);
  if (digits.length === 10) {
    digits = `${digits.substring(0, 2)}9${digits.substring(2)}`;
  }
  if (digits.length === 11) return `+55${digits}`;
  console.warn(`[normalizePhone] Inválido: ${phone} → ${digits}`);
  return null;
}

function parseElementorPayload(body: Record<string, string>): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^fields\[(\w+)\]\[value\]$/);
    if (match && value && String(value).trim()) {
      parsed[match[1]] = String(value).trim();
    }
  }
  return parsed;
}

function parseFlatPayload(body: Record<string, any>): Record<string, string> {
  const parsed: Record<string, string> = {};
  const directFields = [
    "name", "email", "phone", "cpf", "prefix", "pipeline_id", "stage_id",
    "channel", "channel_id", "value", "utm_source", "utm_medium",
    "utm_campaign", "utm_content", "utm_term", "fbp", "fbc", "fbclid",
    "gclid", "gbraid", "gad_source", "title", "currency", "owner_id",
    "person_id",
  ];
  for (const key of directFields) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim()) {
      parsed[key] = String(body[key]).trim();
    }
  }
  // Extract fbp from custom_fields if present
  if (!parsed.fbp && body.custom_fields) {
    for (const val of Object.values(body.custom_fields)) {
      if (typeof val === "string" && val.startsWith("fb.")) {
        parsed.fbp = val;
        break;
      }
    }
  }
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Parse payload — support both Elementor format and flat JSON
    const rawBody = await req.json();
    const elementorFields = parseElementorPayload(rawBody);
    const isElementor = Object.keys(elementorFields).length > 0;
    const fields = isElementor ? elementorFields : parseFlatPayload(rawBody);
    console.log("📥 lp-lead-webhook fields:", JSON.stringify(fields), "format:", isElementor ? "elementor" : "flat");

    const email = fields.email || null;
    const phone = fields.phone ? normalizePhone(fields.phone) : null;

    if (!email && !phone) {
      return json({ error: "Email ou telefone obrigatório" }, 400);
    }

    // 2. Map pipeline_id → id_empresa
    const pipelineId = fields.pipeline_id;
    if (!pipelineId) {
      return json({ error: "pipeline_id obrigatório" }, 400);
    }

    const { data: mapa } = await supabase
      .from("pipeline_empresa_mapa")
      .select("id_empresa")
      .eq("pipeline_id", pipelineId)
      .single();

    if (!mapa) {
      return json({ error: `Pipeline ${pipelineId} não mapeado a nenhuma empresa` }, 400);
    }

    const idEmpresa = mapa.id_empresa;

    // 3. Get empresa name for response
    const { data: empresa } = await supabase
      .from("empresa")
      .select("nome")
      .eq("id_empresa", idEmpresa)
      .single();

    // 4. Search existing lead by email or phone
    let existingLead: any = null;

    if (email) {
      const { data } = await supabase
        .from("lead")
        .select("id_lead, nome_lead, utm_source, utm_medium, utm_campaign, utm_content, utm_term, cpf, fbp, fbc, gclid, gbraid, lp_prefix")
        .eq("id_empresa", idEmpresa)
        .eq("email", email)
        .limit(1)
        .single();
      if (data) existingLead = data;
    }

    if (!existingLead && phone) {
      const { data } = await supabase
        .from("lead")
        .select("id_lead, nome_lead, utm_source, utm_medium, utm_campaign, utm_content, utm_term, cpf, fbp, fbc, gclid, gbraid, lp_prefix")
        .eq("id_empresa", idEmpresa)
        .eq("telefone", phone)
        .limit(1)
        .single();
      if (data) existingLead = data;
    }

    // 5. Build tracking/enrichment data
    const enrichData: Record<string, any> = {};

    // UTMs — only fill if currently empty
    const utmFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
    for (const f of utmFields) {
      if (fields[f]) enrichData[f] = fields[f];
    }

    // Tracking pixels
    if (fields.fbp) enrichData.fbp = fields.fbp;
    if (fields.fbc || fields.fbclid) enrichData.fbc = fields.fbc || fields.fbclid;
    if (fields.gclid) enrichData.gclid = fields.gclid;
    if (fields.gbraid) enrichData.gbraid = fields.gbraid;

    // Other fields
    if (fields.cpf) enrichData.cpf = fields.cpf;
    if (fields.prefix) enrichData.lp_prefix = fields.prefix;

    let leadId: string;
    let isNovo = false;

    if (existingLead) {
      // 6a. Update existing — only fill empty fields
      const updateData: Record<string, any> = {};
      
      if (fields.name && !existingLead.nome_lead) updateData.nome_lead = fields.name;
      if (phone && !existingLead.telefone) updateData.telefone = phone;

      for (const [key, val] of Object.entries(enrichData)) {
        if (!existingLead[key]) updateData[key] = val;
      }

      if (Object.keys(updateData).length > 0) {
        await supabase.from("lead").update(updateData).eq("id_lead", existingLead.id_lead);
        console.log(`✏️ Lead atualizado: ${existingLead.id_lead}`, Object.keys(updateData));
      }

      leadId = existingLead.id_lead;
    } else {
      // 6b. Create new lead
      const newLead: Record<string, any> = {
        id_empresa: idEmpresa,
        email: email || null,
        telefone: phone || null,
        nome_lead: fields.name || null,
        origem_tipo: "PAGO",
        origem_canal: "OUTRO",
        stage_atual: fields.prefix || "LP",
        pipeline_id: pipelineId,
        ...enrichData,
      };

      // valor_venda
      if (fields.value) {
        const val = parseFloat(fields.value);
        if (!isNaN(val)) newLead.valor_venda = val;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("lead")
        .insert(newLead)
        .select("id_lead")
        .single();

      if (insertErr) {
        console.error("❌ Erro ao criar lead:", insertErr);
        return json({ error: `Erro ao criar lead: ${insertErr.message}` }, 500);
      }

      leadId = inserted.id_lead;
      isNovo = true;
      console.log(`✅ Lead criado: ${leadId}`);
    }

    // 7. Trigger SDR webhook
    try {
      await supabase.functions.invoke("disparar-webhook-leads", {
        body: { id_lead: leadId },
      });
      console.log(`🔔 Webhook SDR disparado para lead ${leadId}`);
    } catch (webhookErr) {
      console.warn("⚠️ Erro ao disparar webhook SDR:", webhookErr);
    }

    return json({
      success: true,
      lead_id: leadId,
      is_novo: isNovo,
      empresa: empresa?.nome || idEmpresa,
    });
  } catch (error) {
    console.error("❌ Erro no lp-lead-webhook:", error);
    return json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});

