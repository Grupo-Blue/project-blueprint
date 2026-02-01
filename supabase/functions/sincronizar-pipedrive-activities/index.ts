import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "sincronizar-pipedrive-activities";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 Iniciando sincronização de atividades e notas do Pipedrive...");

    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "PIPEDRIVE")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Pipedrive ativa");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const apiToken = config.api_token;
      const domain = config.domain.replace('.pipedrive.com', '');
      const idEmpresa = integracao.id_empresa;

      console.log(`\n📊 Processando empresa ${idEmpresa}`);

      try {
        let activitiesSynced = 0;
        let notesSynced = 0;
        let errors = 0;

        // ========== SINCRONIZAR ATIVIDADES ==========
        console.log("  📅 Buscando atividades...");
        
        let activitiesStart = 0;
        const activitiesLimit = 500;
        
        while (true) {
          const activitiesUrl = `https://${domain}.pipedrive.com/api/v1/activities?api_token=${apiToken}&start=${activitiesStart}&limit=${activitiesLimit}&done=0,1`;
          
          const activitiesResponse = await fetch(activitiesUrl);
          if (!activitiesResponse.ok) {
            console.error(`  ❌ Erro ao buscar atividades: ${activitiesResponse.status}`);
            errors++;
            break;
          }

          const activitiesData = await activitiesResponse.json();
          
          if (!activitiesData.success || !activitiesData.data || activitiesData.data.length === 0) {
            break;
          }

          const activitiesToUpsert = activitiesData.data.map((activity: any) => ({
            id_empresa: idEmpresa,
            id_activity_externo: String(activity.id),
            id_lead_externo: activity.deal_id ? String(activity.deal_id) : null,
            id_deal_externo: activity.deal_id ? String(activity.deal_id) : null,
            id_person_externo: activity.person_id ? String(activity.person_id) : null,
            tipo: activity.type || "task",
            subject: activity.subject || null,
            note: activity.note || activity.public_description || null,
            done: activity.done === true || activity.done === 1,
            due_date: activity.due_date || null,
            due_time: activity.due_time || null,
            duration: activity.duration || null,
            add_time: activity.add_time || null,
            marked_as_done_time: activity.marked_as_done_time || null,
            assigned_to_user_id: activity.user_id ? String(activity.user_id) : null,
            assigned_to_user_name: activity.owner_name || null,
          }));

          // Batch upsert
          const { error: upsertError } = await supabase
            .from("pipedrive_activity")
            .upsert(activitiesToUpsert, { 
              onConflict: "id_empresa,id_activity_externo" 
            });

          if (upsertError) {
            console.error(`  ⚠️ Erro ao salvar atividades:`, upsertError.message);
            errors++;
          } else {
            activitiesSynced += activitiesToUpsert.length;
          }

          const pagination = activitiesData.additional_data?.pagination;
          if (!pagination || !pagination.more_items_in_collection) {
            break;
          }
          activitiesStart = pagination.next_start ?? (activitiesStart + activitiesLimit);
        }

        console.log(`  ✅ ${activitiesSynced} atividades sincronizadas`);

        // ========== SINCRONIZAR NOTAS ==========
        console.log("  📝 Buscando notas...");
        
        let notesStart = 0;
        const notesLimit = 500;
        
        while (true) {
          const notesUrl = `https://${domain}.pipedrive.com/api/v1/notes?api_token=${apiToken}&start=${notesStart}&limit=${notesLimit}`;
          
          const notesResponse = await fetch(notesUrl);
          if (!notesResponse.ok) {
            console.error(`  ❌ Erro ao buscar notas: ${notesResponse.status}`);
            errors++;
            break;
          }

          const notesData = await notesResponse.json();
          
          if (!notesData.success || !notesData.data || notesData.data.length === 0) {
            break;
          }

          const notesToUpsert = notesData.data.map((note: any) => ({
            id_empresa: idEmpresa,
            id_note_externo: String(note.id),
            id_lead_externo: note.deal_id ? String(note.deal_id) : null,
            id_deal_externo: note.deal_id ? String(note.deal_id) : null,
            id_person_externo: note.person_id ? String(note.person_id) : null,
            content: note.content || null,
            add_time: note.add_time || null,
            update_time: note.update_time || null,
            user_id: note.user_id ? String(note.user_id) : null,
            user_name: note.user?.name || null,
            pinned_to_deal: note.pinned_to_deal_flag === true || note.pinned_to_deal_flag === 1,
            pinned_to_person: note.pinned_to_person_flag === true || note.pinned_to_person_flag === 1,
          }));

          // Batch upsert
          const { error: upsertError } = await supabase
            .from("pipedrive_note")
            .upsert(notesToUpsert, { 
              onConflict: "id_empresa,id_note_externo" 
            });

          if (upsertError) {
            console.error(`  ⚠️ Erro ao salvar notas:`, upsertError.message);
            errors++;
          } else {
            notesSynced += notesToUpsert.length;
          }

          const pagination = notesData.additional_data?.pagination;
          if (!pagination || !pagination.more_items_in_collection) {
            break;
          }
          notesStart = pagination.next_start ?? (notesStart + notesLimit);
        }

        console.log(`  ✅ ${notesSynced} notas sincronizadas`);

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: errors > 0 ? "partial" : "success",
          activities_synced: activitiesSynced,
          notes_synced: notesSynced,
          errors,
        });

      } catch (error: any) {
        console.error(`❌ Erro ao processar integração:`, error.message);
        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: "error",
          error: error.message,
        });
      }
    }

    const duracao = Date.now() - startTime;
    const temErros = resultados.some(r => r.status === "error");

    // Registrar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: temErros ? "partial" : "success",
      duracao_ms: duracao,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Sincronização concluída em ${(duracao / 1000).toFixed(1)}s`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronização de atividades e notas concluída",
        duracao_ms: duracao,
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);

    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "error",
      duracao_ms: duracao,
      mensagem_erro: error.message,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
