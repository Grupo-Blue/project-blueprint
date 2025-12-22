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

    // 1. Buscar leads sem stape_client_id
    const { data: leads, error: leadsError } = await supabase
      .from("lead")
      .select("id_lead, email, telefone, id_empresa, stape_client_id, stape_referrer")
      .is("stape_client_id", null)
      .not("email", "is", null)
      .limit(100);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`📊 Encontrados ${leads?.length || 0} leads para enriquecer`);

    let enriquecidos = 0;
    let semMatch = 0;

    for (const lead of leads || []) {
      const emailLimpo = lead.email?.toLowerCase().trim();
      const telefoneLimpo = lead.telefone?.replace(/\D/g, "");

      if (!emailLimpo && !telefoneLimpo) {
        semMatch++;
        continue;
      }

      // Buscar eventos Stape que correspondam ao lead
      let eventosQuery = supabase
        .from("stape_evento")
        .select("*")
        .order("event_timestamp", { ascending: false });

      // Não temos como fazer match direto pois stape_evento não tem email/telefone
      // Vamos buscar por client_id que já foi vinculado a este lead
      // ou buscar por eventos que tenham custom_data com email

      // Primeiro, verificar se já existe um client_id associado
      const { data: eventosComEmail } = await supabase
        .from("stape_evento")
        .select("*")
        .filter("custom_data->email", "ilike", emailLimpo || "NOMATCH")
        .order("event_timestamp", { ascending: false })
        .limit(50);

      if (!eventosComEmail || eventosComEmail.length === 0) {
        semMatch++;
        continue;
      }

      // Agregar dados dos eventos
      const clientId = eventosComEmail[0].client_id;
      const firstEvent = eventosComEmail[eventosComEmail.length - 1];
      const lastEvent = eventosComEmail[0];

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

      // Calcular métricas agregadas
      const paginasVisitadas = [...new Set(todosEventos.map(e => e.page_url).filter(Boolean))];
      const eventosAgrupados = todosEventos.reduce((acc, e) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calcular tempo total estimado (diferença entre primeiro e último evento)
      const primeiroTimestamp = new Date(firstEvent.event_timestamp).getTime();
      const ultimoTimestamp = new Date(lastEvent.event_timestamp).getTime();
      const tempoTotalSegundos = Math.round((ultimoTimestamp - primeiroTimestamp) / 1000);

      // Dados para atualização
      const updateData: Record<string, any> = {
        stape_client_id: clientId,
        stape_session_id: lastEvent.session_id,
        stape_first_visit: firstEvent.event_timestamp,
        stape_last_activity: lastEvent.event_timestamp,
        stape_paginas_visitadas: paginasVisitadas,
        stape_eventos: eventosAgrupados,
        stape_tempo_total_segundos: tempoTotalSegundos > 0 ? tempoTotalSegundos : null,
      };

      // Pegar IDs de plataforma do evento mais recente
      if (lastEvent.fbp) updateData.stape_fbp = lastEvent.fbp;
      if (lastEvent.fbc) updateData.stape_fbc = lastEvent.fbc;
      if (lastEvent.gclid) updateData.stape_gclid = lastEvent.gclid;
      if (lastEvent.ip_address) updateData.stape_ip_address = lastEvent.ip_address;
      if (lastEvent.user_agent) updateData.stape_user_agent = lastEvent.user_agent;

      // Pegar referrer do primeiro evento
      if (firstEvent.page_url && !lead.stape_referrer) {
        try {
          const url = new URL(firstEvent.page_url);
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

    // 2. Atualizar leads que já têm stape_client_id com métricas agregadas
    const { data: leadsComStape } = await supabase
      .from("lead")
      .select("id_lead, stape_client_id")
      .not("stape_client_id", "is", null)
      .is("stape_tempo_total_segundos", null)
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
      const eventosAgrupados = eventos.reduce((acc, e) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

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

    // Log de execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "enriquecer-leads-stape",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        leads_processados: leads?.length || 0,
        enriquecidos,
        sem_match: semMatch,
        atualizados_com_metricas: atualizadosComMetricas,
      },
    });

    console.log(`✅ Enriquecimento concluído: ${enriquecidos} enriquecidos, ${atualizadosComMetricas} atualizados com métricas`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_processados: leads?.length || 0,
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
