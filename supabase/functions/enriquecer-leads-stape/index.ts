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

    console.log("🔄 Iniciando enriquecimento de leads com dados Stape...");

    // 1. Buscar leads sem stape_client_id (que têm email OU fbp)
    const { data: leads, error: leadsError } = await supabase
      .from("lead")
      .select("id_lead, email, telefone, id_empresa, stape_client_id, stape_referrer, fbp")
      .is("stape_client_id", null)
      .limit(100);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    // Filtrar leads que têm email OU fbp
    const leadsParaProcessar = (leads || []).filter(l => l.email || l.fbp);
    console.log(`📊 Encontrados ${leadsParaProcessar.length} leads para enriquecer (de ${leads?.length || 0} sem stape_client_id)`);

    let enriquecidos = 0;
    let semMatch = 0;

    for (const lead of leadsParaProcessar) {
      const emailLimpo = lead.email?.toLowerCase().trim();

      // Estratégia 1: Buscar eventos por email no custom_data
      let eventosMatch: any[] = [];

      if (emailLimpo) {
        const { data: eventosComEmail } = await supabase
          .from("stape_evento")
          .select("*")
          .filter("custom_data->email", "ilike", emailLimpo)
          .order("event_timestamp", { ascending: false })
          .limit(50);

        if (eventosComEmail && eventosComEmail.length > 0) {
          eventosMatch = eventosComEmail;
          console.log(`📧 Match por email para lead ${lead.id_lead}: ${eventosComEmail.length} eventos`);
        }
      }

      // Estratégia 2 (NOVA): Buscar eventos por FBP
      if (eventosMatch.length === 0 && lead.fbp) {
        const { data: eventosPorFbp } = await supabase
          .from("stape_evento")
          .select("*")
          .eq("fbp", lead.fbp)
          .order("event_timestamp", { ascending: false })
          .limit(50);

        if (eventosPorFbp && eventosPorFbp.length > 0) {
          eventosMatch = eventosPorFbp;
          console.log(`🔗 Match por FBP para lead ${lead.id_lead}: ${eventosPorFbp.length} eventos`);
        }
      }

      if (eventosMatch.length === 0) {
        semMatch++;
        continue;
      }

      // Agregar dados dos eventos
      const clientId = eventosMatch[0].client_id;

      // Buscar todos os eventos deste client_id para calcular métricas
      const { data: todosEventos } = await supabase
        .from("stape_evento")
        .select("*")
        .eq("client_id", clientId)
        .order("event_timestamp", { ascending: true });

      if (!todosEventos || todosEventos.length === 0) {
        semMatch++;
        continue;
      }

      // Calcular métricas agregadas (CORRIGIDO: usar todosEventos ordenado asc)
      const primeiroEvento = todosEventos[0];
      const ultimoEvento = todosEventos[todosEventos.length - 1];
      const paginasVisitadas = [...new Set(todosEventos.map(e => e.page_url).filter(Boolean))];
      const eventosAgrupados = todosEventos.reduce((acc: Record<string, number>, e: any) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {});

      const primeiroTimestamp = new Date(primeiroEvento.event_timestamp).getTime();
      const ultimoTimestamp = new Date(ultimoEvento.event_timestamp).getTime();
      const tempoTotalSegundos = Math.round((ultimoTimestamp - primeiroTimestamp) / 1000);

      const updateData: Record<string, any> = {
        stape_client_id: clientId,
        stape_session_id: ultimoEvento.session_id,
        stape_first_visit: primeiroEvento.event_timestamp,
        stape_last_activity: ultimoEvento.event_timestamp,
        stape_paginas_visitadas: paginasVisitadas,
        stape_eventos: eventosAgrupados,
        stape_tempo_total_segundos: tempoTotalSegundos > 0 ? tempoTotalSegundos : null,
      };

      // IDs de plataforma do evento mais recente
      if (ultimoEvento.fbp) updateData.stape_fbp = ultimoEvento.fbp;
      if (ultimoEvento.fbc) updateData.stape_fbc = ultimoEvento.fbc;
      if (ultimoEvento.gclid) updateData.stape_gclid = ultimoEvento.gclid;
      if (ultimoEvento.ip_address) updateData.stape_ip_address = ultimoEvento.ip_address;
      if (ultimoEvento.user_agent) updateData.stape_user_agent = ultimoEvento.user_agent;

      // Referrer do primeiro evento
      if (primeiroEvento.page_url && !lead.stape_referrer) {
        try {
          const url = new URL(primeiroEvento.page_url);
          const referrer = url.searchParams.get("referrer") || url.searchParams.get("ref");
          if (referrer) updateData.stape_referrer = referrer;
        } catch {}
      }

      // Atualizar lead
      const { error: updateError } = await supabase
        .from("lead")
        .update(updateData)
        .eq("id_lead", lead.id_lead);

      if (updateError) {
        console.error(`❌ Erro ao atualizar lead ${lead.id_lead}:`, updateError);
        continue;
      }

      // Atualizar eventos com id_lead
      await supabase
        .from("stape_evento")
        .update({ id_lead: lead.id_lead })
        .eq("client_id", clientId)
        .is("id_lead", null);

      enriquecidos++;
      console.log(`✅ Lead ${lead.id_lead} enriquecido: ${paginasVisitadas.length} páginas, ${todosEventos.length} eventos`);
    }

    // 2. Atualizar leads que já têm stape_client_id com métricas agregadas (recalcular periodicamente)
    const { data: leadsComStape } = await supabase
      .from("lead")
      .select("id_lead, stape_client_id")
      .not("stape_client_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(50);

    let atualizadosComMetricas = 0;

    for (const lead of leadsComStape || []) {
      const { data: eventos } = await supabase
        .from("stape_evento")
        .select("*")
        .eq("client_id", lead.stape_client_id)
        .order("event_timestamp", { ascending: true });

      if (!eventos || eventos.length < 2) continue;

      const paginasVisitadas = [...new Set(eventos.map(e => e.page_url).filter(Boolean))];
      const eventosAgrupados = eventos.reduce((acc: Record<string, number>, e: any) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {});

      const primeiroTimestamp = new Date(eventos[0].event_timestamp).getTime();
      const ultimoTimestamp = new Date(eventos[eventos.length - 1].event_timestamp).getTime();
      const tempoTotalSegundos = Math.round((ultimoTimestamp - primeiroTimestamp) / 1000);

      await supabase
        .from("lead")
        .update({
          stape_paginas_visitadas: paginasVisitadas,
          stape_eventos: eventosAgrupados,
          stape_tempo_total_segundos: tempoTotalSegundos > 0 ? tempoTotalSegundos : null,
          stape_last_activity: eventos[eventos.length - 1].event_timestamp,
        })
        .eq("id_lead", lead.id_lead);

      atualizadosComMetricas++;
    }

    const duracao = Date.now() - startTime;

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "enriquecer-leads-stape",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        leads_processados: leadsParaProcessar.length,
        enriquecidos,
        sem_match: semMatch,
        atualizados_com_metricas: atualizadosComMetricas,
      },
    });

    console.log(`✅ Enriquecimento concluído: ${enriquecidos} enriquecidos, ${atualizadosComMetricas} atualizados com métricas`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_processados: leadsParaProcessar.length,
        enriquecidos,
        sem_match: semMatch,
        atualizados_com_metricas: atualizadosComMetricas,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro no enriquecer-leads-stape:", error);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "enriquecer-leads-stape",
      status: "erro",
      mensagem_erro: errorMessage,
      duracao_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
