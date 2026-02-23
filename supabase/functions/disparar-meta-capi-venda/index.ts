import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));

    // Modo 1: Disparo para um lead específico (chamado pelo pipedrive-webhook)
    // Modo 2: Batch - buscar todos os leads com venda pendente de CAPI
    const specificLeadId = body.id_lead;

    let leadsParaProcessar: any[] = [];

    if (specificLeadId) {
      const { data: lead } = await supabase
        .from("lead")
        .select("id_lead, id_empresa, email, telefone, nome_lead, fbp, fbc, stape_fbp, stape_fbc, stape_ip_address, stape_user_agent, valor_venda, data_venda, meta_capi_purchase_enviado")
        .eq("id_lead", specificLeadId)
        .eq("venda_realizada", true)
        .eq("meta_capi_purchase_enviado", false)
        .maybeSingle();

      if (lead) leadsParaProcessar = [lead];
    } else {
      // Batch: buscar leads com venda não enviada
      const { data: leads } = await supabase
        .from("lead")
        .select("id_lead, id_empresa, email, telefone, nome_lead, fbp, fbc, stape_fbp, stape_fbc, stape_ip_address, stape_user_agent, valor_venda, data_venda, meta_capi_purchase_enviado")
        .eq("venda_realizada", true)
        .eq("meta_capi_purchase_enviado", false)
        .limit(50);

      leadsParaProcessar = leads || [];
    }

    console.log(`📊 ${leadsParaProcessar.length} leads com venda pendente de CAPI`);

    let enviados = 0;
    let erros = 0;
    let semDados = 0;

    for (const lead of leadsParaProcessar) {
      // Precisa ter pelo menos email, fbp ou fbc para enviar ao Meta
      const fbpFinal = lead.fbp || lead.stape_fbp;
      const fbcFinal = lead.fbc || lead.stape_fbc;
      const hasIdentifier = lead.email || fbpFinal || fbcFinal;

      if (!hasIdentifier) {
        console.log(`⚠️ Lead ${lead.id_lead} sem identificadores para CAPI, pulando`);
        semDados++;
        continue;
      }

      // Extrair primeiro e último nome
      const nomeParts = (lead.nome_lead || "").split(" ");
      const firstName = nomeParts[0] || null;
      const lastName = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : null;

      // Montar payload para stape-meta-capi
      const capiPayload: Record<string, any> = {
        event_name: "Purchase",
        event_time: lead.data_venda
          ? Math.floor(new Date(lead.data_venda).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        action_source: "website",
        id_empresa: lead.id_empresa,
        event_id: `purchase_${lead.id_lead}`,
      };

      if (lead.email) capiPayload.email = lead.email;
      if (lead.telefone) capiPayload.phone = lead.telefone;
      if (firstName) capiPayload.first_name = firstName;
      if (lastName) capiPayload.last_name = lastName;
      if (fbpFinal) capiPayload.fbp = fbpFinal;
      if (fbcFinal) capiPayload.fbc = fbcFinal;
      if (lead.stape_ip_address) capiPayload.client_ip_address = lead.stape_ip_address;
      if (lead.stape_user_agent) capiPayload.client_user_agent = lead.stape_user_agent;
      if (lead.valor_venda) capiPayload.value = String(lead.valor_venda);
      capiPayload.external_id = lead.id_lead;

      try {
        const { data: capiResult, error: capiError } = await supabase.functions.invoke(
          "stape-meta-capi",
          { body: capiPayload }
        );

        if (capiError) {
          console.error(`❌ Erro CAPI para lead ${lead.id_lead}:`, capiError);
          erros++;
          continue;
        }

        if (capiResult?.success) {
          // Marcar como enviado
          await supabase
            .from("lead")
            .update({
              meta_capi_purchase_enviado: true,
              meta_capi_purchase_at: new Date().toISOString(),
            })
            .eq("id_lead", lead.id_lead);

          enviados++;
          console.log(`✅ CAPI Purchase enviado para lead ${lead.id_lead} (valor: R$ ${lead.valor_venda || 0})`);
        } else {
          console.error(`❌ CAPI falhou para lead ${lead.id_lead}:`, capiResult);
          erros++;
        }
      } catch (invokeErr) {
        console.error(`❌ Erro ao invocar stape-meta-capi para lead ${lead.id_lead}:`, invokeErr);
        erros++;
      }
    }

    const duracao = Date.now() - startTime;

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "disparar-meta-capi-venda",
      status: erros === leadsParaProcessar.length && leadsParaProcessar.length > 0 ? "erro" : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        total: leadsParaProcessar.length,
        enviados,
        erros,
        sem_dados: semDados,
        modo: specificLeadId ? "unitario" : "batch",
      },
    });

    console.log(`✅ CAPI concluído: ${enviados} enviados, ${erros} erros, ${semDados} sem dados`);

    return new Response(
      JSON.stringify({
        success: true,
        total: leadsParaProcessar.length,
        enviados,
        erros,
        sem_dados: semDados,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no disparar-meta-capi-venda:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
