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

    console.log("Iniciando sincronização de Activities e Notes do Pipedrive...");

    // Buscar integração Pipedrive ativa
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
        // Buscar todos os leads da empresa no SGT
        const { data: leads, error: leadsError } = await supabase
          .from("lead")
          .select("id_lead, id_lead_externo, nome")
          .eq("id_empresa", idEmpresa)
          .not("id_lead_externo", "is", null);

        if (leadsError) throw leadsError;

        if (!leads || leads.length === 0) {
          console.log(`  ↳ Nenhum lead com id_lead_externo encontrado`);
          continue;
        }

        console.log(`  ↳ ${leads.length} leads encontrados`);

        let activitiesSincronizadas = 0;
        let notesSincronizadas = 0;

        // Para cada lead, buscar activities e notes
        for (const lead of leads) {
          const dealId = lead.id_lead_externo;

          // 1. Buscar Activities do deal
          const activitiesUrl = `https://${domain}.pipedrive.com/api/v1/deals/${dealId}/activities?api_token=${apiToken}`;
          
          try {
            const activitiesResponse = await fetch(activitiesUrl);
            
            if (activitiesResponse.ok) {
              const activitiesData = await activitiesResponse.json();
              
              if (activitiesData.success && activitiesData.data) {
                const activities = activitiesData.data;
                
                for (const activity of activities) {
                  const activityData = {
                    id_lead: lead.id_lead,
                    id_activity_externo: activity.id,
                    tipo: activity.type || null,
                    assunto: activity.subject || null,
                    descricao: activity.note || null,
                    data_vencimento: activity.due_date || null,
                    hora_vencimento: activity.due_time || null,
                    duracao: activity.duration || null,
                    concluida: activity.done || false,
                    data_conclusao: activity.marked_as_done_time || null,
                    usuario_responsavel: activity.user_id?.toString() || null,
                    id_empresa: idEmpresa,
                  };

                  const { error: upsertError } = await supabase
                    .from("pipedrive_activity")
                    .upsert(activityData, { 
                      onConflict: "id_activity_externo",
                      ignoreDuplicates: false 
                    });

                  if (upsertError) {
                    console.error(`    ⚠️ Erro ao salvar activity ${activity.id}:`, upsertError.message);
                  } else {
                    activitiesSincronizadas++;
                  }
                }
              }
            } else if (activitiesResponse.status !== 404) {
              console.error(`    ⚠️ Erro ao buscar activities do deal ${dealId}: ${activitiesResponse.status}`);
            }
          } catch (actErr) {
            console.error(`    ⚠️ Erro ao processar activities do deal ${dealId}:`, actErr);
          }

          // 2. Buscar Notes do deal
          const notesUrl = `https://${domain}.pipedrive.com/api/v1/notes?deal_id=${dealId}&api_token=${apiToken}`;
          
          try {
            const notesResponse = await fetch(notesUrl);
            
            if (notesResponse.ok) {
              const notesData = await notesResponse.json();
              
              if (notesData.success && notesData.data) {
                const notes = notesData.data;
                
                for (const note of notes) {
                  const noteData = {
                    id_lead: lead.id_lead,
                    id_note_externo: note.id,
                    conteudo: note.content || null,
                    data_criacao: note.add_time || null,
                    data_atualizacao: note.update_time || null,
                    usuario_criador: note.user_id?.toString() || null,
                    pinned: note.pinned_to_deal_flag || false,
                    id_empresa: idEmpresa,
                  };

                  const { error: upsertError } = await supabase
                    .from("pipedrive_note")
                    .upsert(noteData, { 
                      onConflict: "id_note_externo",
                      ignoreDuplicates: false 
                    });

                  if (upsertError) {
                    console.error(`    ⚠️ Erro ao salvar note ${note.id}:`, upsertError.message);
                  } else {
                    notesSincronizadas++;
                  }
                }
              }
            } else if (notesResponse.status !== 404) {
              console.error(`    ⚠️ Erro ao buscar notes do deal ${dealId}: ${notesResponse.status}`);
            }
          } catch (noteErr) {
            console.error(`    ⚠️ Erro ao processar notes do deal ${dealId}:`, noteErr);
          }
        }

        resultados.push({
          integracao: integracao.id_integracao,
          id_empresa: idEmpresa,
          status: "success",
          activities_sincronizadas: activitiesSincronizadas,
          notes_sincronizadas: notesSincronizadas,
        });

        console.log(`  ✅ ${activitiesSincronizadas} activities e ${notesSincronizadas} notes sincronizadas`);

      } catch (error) {
        console.error(`  ❌ Erro ao processar empresa ${idEmpresa}:`, error);
        resultados.push({
          integracao: integracao.id_integracao,
          id_empresa: idEmpresa,
          status: "error",
          error: String(error),
        });
      }
    }

    const duracao = Date.now() - startTime;
    console.log(`\n✅ Sincronização concluída em ${(duracao/1000).toFixed(1)}s`);

    // Registrar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { resultados }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronização de activities e notes concluída",
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro geral:", error);
    
    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : String(error)
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
