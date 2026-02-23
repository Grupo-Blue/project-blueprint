import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

function normalizePhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");

  // Remove country code 55 if present
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.substring(2);
  }

  // Add 9th digit if missing (10 digits = DDD + 8)
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    digits = `${ddd}9${numero}`;
  }

  if (digits.length === 11) {
    return `+55${digits}`;
  }

  console.warn(`[normalizePhone] Telefone inválido: ${phone} → ${digits} (${digits.length} dígitos)`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. Auth validation
    const webhookSecret = Deno.env.get("SGT_WEBHOOK_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ") || authHeader.replace("Bearer ", "") !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log(`📥 whatsapp-disparo-webhook: event=${payload.event}, campaign=${payload.campaignName}, contacts=${payload.contacts?.length}`);

    // 2. Validate event type
    if (payload.event !== "campaign.dispatched") {
      return new Response(JSON.stringify({ error: "Evento não suportado", event: payload.event }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaignName, company, contacts, dispatchedAt } = payload;

    if (!company || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: company, contacts[]" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Map company name → id_empresa
    const { data: empresas } = await supabase
      .from("empresa")
      .select("id_empresa, nome")
      .ilike("nome", `%${company}%`)
      .limit(1);

    if (!empresas || empresas.length === 0) {
      return new Response(JSON.stringify({ error: `Empresa não encontrada: ${company}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idEmpresa = empresas[0].id_empresa;
    console.log(`🏢 Empresa mapeada: ${empresas[0].nome} → ${idEmpresa}`);

    // 4. Process contacts in batches
    let leadsCreated = 0;
    let leadsUpdated = 0;
    const allLeadIds: string[] = [];

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      // Normalize phones
      const normalized = batch.map((c: { name?: string; phone: string }) => ({
        name: c.name || null,
        phone: normalizePhone(c.phone),
      })).filter((c: { phone: string | null }) => c.phone !== null);

      if (normalized.length === 0) continue;

      const phones = normalized.map((c: { phone: string }) => c.phone);

      // Find existing leads by phone
      const { data: existingLeads } = await supabase
        .from("lead")
        .select("id_lead, telefone, nome_lead")
        .eq("id_empresa", idEmpresa)
        .in("telefone", phones);

      const existingByPhone = new Map(
        (existingLeads || []).map((l: any) => [l.telefone, l])
      );

      // Separate new vs existing
      const leadsToInsert: any[] = [];
      const leadsToUpdate: { id: string; name: string }[] = [];

      for (const contact of normalized) {
        const existing = existingByPhone.get(contact.phone);
        if (existing) {
          allLeadIds.push(existing.id_lead);
          if (contact.name && !existing.nome_lead) {
            leadsToUpdate.push({ id: existing.id_lead, name: contact.name });
          }
        } else {
          leadsToInsert.push({
            telefone: contact.phone,
            nome_lead: contact.name,
            id_empresa: idEmpresa,
            origem_tipo: "WEBHOOK",
            origem_canal: "WHATSAPP",
            stage_atual: "WhatsApp Disparo",
          });
        }
      }

      // Update existing leads missing names
      for (const u of leadsToUpdate) {
        await supabase.from("lead").update({ nome_lead: u.name }).eq("id_lead", u.id);
        leadsUpdated++;
      }

      // Insert new leads
      if (leadsToInsert.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from("lead")
          .insert(leadsToInsert)
          .select("id_lead");

        if (insertErr) {
          console.error(`❌ Erro ao inserir leads batch ${i}:`, insertErr);
        } else if (inserted) {
          leadsCreated += inserted.length;
          allLeadIds.push(...inserted.map((l: any) => l.id_lead));
        }
      }
    }

    console.log(`✅ Leads processados: ${leadsCreated} criados, ${leadsUpdated} atualizados, ${allLeadIds.length} total`);

    // 5. Create disparo_whatsapp
    const { data: disparo, error: disparoErr } = await supabase
      .from("disparo_whatsapp")
      .insert({
        nome: campaignName || "Campanha WhatsApp",
        id_empresa: idEmpresa,
        qtd_leads: allLeadIds.length,
        preset_usado: "webhook-externo",
        enviado: true,
        data_envio: dispatchedAt || new Date().toISOString(),
      })
      .select("id_disparo")
      .single();

    if (disparoErr) {
      console.error("❌ Erro ao criar disparo:", disparoErr);
      throw new Error(`Erro ao criar disparo: ${disparoErr.message}`);
    }

    console.log(`📋 Disparo criado: ${disparo.id_disparo}`);

    // 6. Link leads to disparo in batches
    for (let i = 0; i < allLeadIds.length; i += BATCH_SIZE) {
      const batchIds = allLeadIds.slice(i, i + BATCH_SIZE);
      const links = batchIds.map((id_lead: string) => ({
        id_disparo: disparo.id_disparo,
        id_lead,
      }));

      const { error: linkErr } = await supabase
        .from("disparo_whatsapp_lead")
        .insert(links);

      if (linkErr) {
        console.error(`❌ Erro ao vincular batch ${i}:`, linkErr);
      }
    }

    const duracao = Date.now() - startTime;

    // Log execution
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "whatsapp-disparo-webhook",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        campaign: campaignName,
        company,
        leads_created: leadsCreated,
        leads_updated: leadsUpdated,
        leads_total: allLeadIds.length,
        id_disparo: disparo.id_disparo,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        id_disparo: disparo.id_disparo,
        leads_criados: leadsCreated,
        leads_atualizados: leadsUpdated,
        leads_total: allLeadIds.length,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no whatsapp-disparo-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
