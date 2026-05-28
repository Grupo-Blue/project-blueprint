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

        if (emails.length === 0) {
          resultados.push({
            integracao: integracao.id_integracao,
            empresa: idEmpresa,
            status: "success",
            emails_total: 0,
            processados: 0,
            erros: 0,
          });
          await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "MAUTIC", nomeEmpresa });
          continue;
        }

        // 1) Bulk upsert de campanhas
        const campanhasPayload = (emails as any[]).map((email) => ({
          id_empresa: idEmpresa,
          id_externo: String(email.id),
          nome: email.name || `Email #${email.id}`,
          assunto: email.subject ?? null,
          status: normalizarStatusEmail(email),
          tipo: email.emailType || "campaign",
          data_envio: email.publishUp || email.dateAdded || null,
        }));

        const { data: campanhasSalvas, error: bulkCampanhaErr } = await supabase
          .from("email_campanha")
          .upsert(campanhasPayload, { onConflict: "id_empresa,id_externo" })
          .select("id_email_campanha, id_externo");

        if (bulkCampanhaErr) {
          throw new Error(`bulk upsert email_campanha falhou: ${bulkCampanhaErr.message}`);
        }

        const idPorExterno = new Map<string, string>();
        for (const c of campanhasSalvas ?? []) {
          idPorExterno.set(String(c.id_externo), c.id_email_campanha);
        }

        // 2) Bulk upsert de métricas do dia
        const metricasPayload: any[] = [];
        for (const email of emails as any[]) {
          const idCampanha = idPorExterno.get(String(email.id));
          if (!idCampanha) {
            comErro++;
            continue;
          }
          const enviados = parseInt(email.sentCount || "0");
          const bounces = parseInt(email.bounceCount || "0");
          metricasPayload.push({
            id_email_campanha: idCampanha,
            data: hoje,
            enviados,
            entregues: Math.max(0, enviados - bounces),
            abertos: parseInt(email.readCount || "0"),
            cliques: parseInt(email.clickCount || "0"),
            bounces_hard: bounces,
            bounces_soft: 0,
            descadastros: parseInt(email.unsubscribeCount || "0"),
            leads_gerados: 0,
          });
        }

        if (metricasPayload.length > 0) {
          const { error: bulkMetErr } = await supabase
            .from("email_metricas_dia")
            .upsert(metricasPayload, { onConflict: "id_email_campanha,data" });
          if (bulkMetErr) {
            console.error("bulk upsert email_metricas_dia falhou:", bulkMetErr);
            comErro += metricasPayload.length;
          } else {
            processados = metricasPayload.length;
          }
        }

        // Enriquece leads_gerados em 1 query agregada + bulk update
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
  // RPC agregada por utm_campaign (1 query). Substitui o loop N+1 anterior.
  const { data: agregadoLeads, error: rpcErr } = await supabase
    .rpc("leads_por_email_campanha_dia", { p_id_empresa: idEmpresa, p_data: hoje });
  if (rpcErr) {
    console.error("RPC leads_por_email_campanha_dia falhou:", rpcErr);
    return;
  }

  const porCampanhaNome = new Map<string, number>();
  for (const row of (agregadoLeads ?? []) as Array<{ utm_campaign: string; total: number }>) {
    if (row.utm_campaign) porCampanhaNome.set(row.utm_campaign, Number(row.total) || 0);
  }
  if (porCampanhaNome.size === 0) return;

  // 1 SELECT em email_campanha para mapear nome -> id_email_campanha
  const { data: campanhas } = await supabase
    .from("email_campanha")
    .select("id_email_campanha, nome")
    .eq("id_empresa", idEmpresa)
    .in("nome", Array.from(porCampanhaNome.keys()));

  if (!campanhas?.length) return;

  // Bulk upsert dos leads_gerados em email_metricas_dia
  const updates: any[] = [];
  for (const c of campanhas) {
    const total = porCampanhaNome.get(c.nome);
    if (total && total > 0) {
      updates.push({
        id_email_campanha: c.id_email_campanha,
        data: hoje,
        leads_gerados: total,
      });
    }
  }
  if (updates.length === 0) return;

  // Upsert mantém os outros campos via onConflict + ignoreDuplicates=false. Como já gravamos
  // a linha cheia antes (zerando leads_gerados), aqui apenas sobrescrevemos o contador.
  // Estratégia: para cada update, usar update direto agrupado por id_email_campanha.
  // Como queremos 1 round-trip, fazemos um upsert parcial usando o mesmo onConflict.
  // PostgREST sobrescreve apenas as colunas presentes; outros campos ficam null se inserir novo.
  // Por segurança, fazemos update por id (1 round-trip por linha; n é pequeno, igual ao número de
  // campanhas de e-mail com leads no dia).
  await Promise.all(
    updates.map((u) =>
      supabase
        .from("email_metricas_dia")
        .update({ leads_gerados: u.leads_gerados })
        .eq("id_email_campanha", u.id_email_campanha)
        .eq("data", u.data),
    ),
  );
}
