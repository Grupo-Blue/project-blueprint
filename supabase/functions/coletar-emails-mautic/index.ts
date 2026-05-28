import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { listarEmails } from "../_shared/mautic_client.ts";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const nomeCronjob = "coletar-emails-mautic";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome)")
      .eq("tipo", "MAUTIC")
      .eq("ativo", true);
    if (integracaoIdFiltro) query = query.eq("id_integracao", integracaoIdFiltro);

    const { data: integracoes, error: intError } = await query;
    if (intError) throw intError;
    if (!integracoes?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma integração Mautic ativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;

      try {
        const emails = await listarEmails(config);
        const hoje = new Date().toISOString().split("T")[0];
        let processados = 0;
        let comErro = 0;

        for (const email of emails as any[]) {
          const idExterno = String(email.id);
          // Upsert campanha
          const { data: campanhaSalva, error: upErr } = await supabase
            .from("email_campanha")
            .upsert(
              {
                id_empresa: idEmpresa,
                id_externo: idExterno,
                nome: email.name || `Email #${idExterno}`,
                assunto: email.subject || null,
                status: normalizarStatusEmail(email),
                tipo: email.emailType || "campaign",
                data_envio: email.publishUp || email.dateAdded || null,
              },
              { onConflict: "id_empresa,id_externo" },
            )
            .select("id_email_campanha")
            .single();

          if (upErr || !campanhaSalva) {
            console.error(`Erro ao upsertar email_campanha ${idExterno}:`, upErr);
            comErro++;
            continue;
          }

          // Snapshot de métrica do dia. Mautic devolve totais acumulados — gravamos como snapshot diário.
          const metricasDia = {
            id_email_campanha: campanhaSalva.id_email_campanha,
            data: hoje,
            enviados: parseInt(email.sentCount || "0"),
            entregues: Math.max(0, parseInt(email.sentCount || "0") - parseInt(email.bounceCount || "0")),
            abertos: parseInt(email.readCount || "0"),
            cliques: parseInt(email.clickCount || "0"),
            bounces_hard: parseInt(email.bounceCount || "0"),
            bounces_soft: 0,
            descadastros: parseInt(email.unsubscribeCount || "0"),
            leads_gerados: 0, // preenchido por enriquecimento posterior (cruza com lead.utm_campaign)
          };

          const { error: metErr } = await supabase
            .from("email_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_email_campanha,data" });

          if (metErr) {
            console.error(`Erro ao upsertar email_metricas_dia:`, metErr);
            comErro++;
          } else {
            processados++;
          }
        }

        // Enriquece leads_gerados cruzando lead.utm_campaign == email.nome do dia.
        await enriquecerLeadsGerados(supabase, idEmpresa, hoje);

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "MAUTIC", nomeEmpresa });

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: comErro > 0 && processados === 0 ? "error" : comErro > 0 ? "parcial" : "success",
          emails_total: emails.length,
          processados,
          erros: comErro,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isAuth = /401|UNAUTHENTICATED|invalid/i.test(errMsg);
        const isPerm = /403|PERMISSION|forbidden/i.test(errMsg);
        await registrarFalha({
          supabase,
          idIntegracao: integracao.id_integracao,
          tipo: "MAUTIC",
          nomeEmpresa,
          errorKind: isAuth ? "UNAUTHENTICATED" : isPerm ? "PERMISSION" : "OTHER",
          errorMsg: errMsg,
        });
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: errMsg });
      }
    }

    const erros = resultados.filter((r) => r.status === "error");
    const sucessos = resultados.filter((r) => r.status === "success" || r.status === "parcial");

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: erros.length > 0 && sucessos.length === 0 ? "erro" : erros.length > 0 ? "parcial" : "sucesso",
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: { sucessos: sucessos.length, erros: erros.length, resultados },
    });

    return new Response(
      JSON.stringify({ message: `${sucessos.length} integrações processadas, ${erros.length} com erro`, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro fatal:", error);
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizarStatusEmail(email: any): string {
  if (email.isPublished === false) return "rascunho";
  if (email.sentCount > 0) return "enviada";
  if (email.publishUp && new Date(email.publishUp) > new Date()) return "agendada";
  return "rascunho";
}

async function enriquecerLeadsGerados(supabase: any, idEmpresa: string, hoje: string) {
  // Para cada email_campanha da empresa, conta leads com utm_source IN (email,newsletter) e utm_campaign = nome do email
  // que foram criados no dia.
  const { data: campanhas } = await supabase
    .from("email_campanha")
    .select("id_email_campanha, nome")
    .eq("id_empresa", idEmpresa);
  if (!campanhas?.length) return;

  for (const ec of campanhas) {
    const { count } = await supabase
      .from("lead")
      .select("id_lead", { count: "exact", head: true })
      .eq("id_empresa", idEmpresa)
      .in("utm_source", ["email", "newsletter"])
      .eq("utm_campaign", ec.nome)
      .gte("data_criacao", `${hoje}T00:00:00`)
      .lte("data_criacao", `${hoje}T23:59:59`);

    if ((count ?? 0) > 0) {
      await supabase
        .from("email_metricas_dia")
        .update({ leads_gerados: count })
        .eq("id_email_campanha", ec.id_email_campanha)
        .eq("data", hoje);
    }
  }
}
