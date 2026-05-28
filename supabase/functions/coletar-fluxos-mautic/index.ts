import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { listarCampaigns } from "../_shared/mautic_client.ts";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const nomeCronjob = "coletar-fluxos-mautic";
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
        const fluxos = await listarCampaigns(config);
        let processados = 0;
        let comErro = 0;

        for (const fluxo of fluxos as any[]) {
          const idExterno = String(fluxo.id);
          const status = fluxo.isPublished ? "ativo" : "pausado";
          const contatos = parseInt(fluxo.contactCount || fluxo.lead_count || "0");

          const { error: upErr } = await supabase
            .from("email_fluxo")
            .upsert(
              {
                id_empresa: idEmpresa,
                id_externo: idExterno,
                nome: fluxo.name || `Fluxo #${idExterno}`,
                status,
                contatos_no_fluxo: contatos,
                conversoes: 0,
              },
              { onConflict: "id_empresa,id_externo" },
            );

          if (upErr) {
            console.error(`Erro ao upsertar email_fluxo ${idExterno}:`, upErr);
            comErro++;
          } else {
            processados++;
          }
        }

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "MAUTIC", nomeEmpresa });

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: comErro > 0 && processados === 0 ? "error" : comErro > 0 ? "parcial" : "success",
          fluxos_total: fluxos.length,
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
      detalhes_execucao: { resultados },
    });

    return new Response(
      JSON.stringify({ message: `${sucessos.length} integrações processadas`, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
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
