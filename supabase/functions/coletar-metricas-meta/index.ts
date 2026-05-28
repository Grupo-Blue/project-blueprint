import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";
import { calcularLeadsDeActions, hojeNoTimezone, resolveTimezoneConta } from "../_shared/meta_helpers.ts";
import { composioEnabled, fetchMetaInsightsViaComposio } from "../_shared/composio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "coletar-metricas-meta";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando coleta de métricas Meta Ads...");

    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome, action_types_conversao_default)")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
    }

    const { data: integracoes, error: intError } = await query;
    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const accessToken = config.access_token;
      const adAccountId = config.ad_account_id;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;
      const actionTypesEmpresaDefault: string[] | null = integracao.empresa?.action_types_conversao_default ?? null;

      try {
        const { data: contaAnuncio } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_externo", adAccountId)
          .eq("plataforma", "META")
          .maybeSingle();

        if (!contaAnuncio) {
          console.log(`Conta de anúncio ${adAccountId} não encontrada no banco, pulando...`);
          continue;
        }

        // Removido filtro `.eq("ativa", true)`: precisamos coletar até de campanhas
        // pausadas hoje, pois Meta ainda retorna spend parcial do dia.
        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta, action_types_conversao")
          .eq("id_conta", contaAnuncio.id_conta);

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) continue;

        const campanhIdsStr = campanhas.map((c) => c.id_campanha_externo).join(",");

        // Refresh metadados das campanhas (nome/status/objetivo).
        try {
          const campaignsUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,objective&ids=${campanhIdsStr}&access_token=${accessToken}`;
          const campaignsResponse = await fetch(campaignsUrl);
          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            for (const campData of campaignsData.data || []) {
              const campanhaLocal = campanhas.find((c) => c.id_campanha_externo === campData.id);
              if (campanhaLocal) {
                await supabase
                  .from("campanha")
                  .update({
                    nome: campData.name,
                    ativa: campData.status === "ACTIVE",
                    objetivo: campData.objective || null,
                  })
                  .eq("id_campanha", campanhaLocal.id_campanha);
              }
            }
          }
        } catch (err) {
          console.error("Erro ao atualizar metadados de campanha:", err);
        }

        // Timezone da conta (cacheado em config_json.timezone_cache).
        const tz = await resolveTimezoneConta({ supabase, integracao, adAccountId, accessToken });
        const hoje = hojeNoTimezone(tz);
        const timeRange = JSON.stringify({ since: hoje, until: hoje });

        // Fields agora inclui actions completas + use_unified_attribution_setting=true.
        const fields = "campaign_id,impressions,clicks,spend,actions,reach,frequency,video_play_actions,video_avg_time_watched_actions,website_ctr,inline_link_clicks";
        const filtering = `[{"field":"campaign.id","operator":"IN","value":["${campanhIdsStr.replace(/,/g, '","')}"]}]`;
        const url =
          `https://graph.facebook.com/v22.0/${adAccountId}/insights` +
          `?fields=${fields}` +
          `&level=campaign` +
          `&time_range=${encodeURIComponent(timeRange)}` +
          `&use_unified_attribution_setting=true` +
          `&access_token=${accessToken}` +
          `&filtering=${encodeURIComponent(filtering)}`;

        let apiData: any = null;
        let fonteFallback = false;

        const response = await fetch(url);
        if (response.ok) {
          apiData = await response.json();
        } else {
          const errorText = await response.text();
          console.error(`Erro na API Meta direta: ${response.status} - ${errorText}`);
          const errorData = (() => { try { return JSON.parse(errorText); } catch { return {}; } })();
          const code = errorData?.error?.code;
          const isTokenExpired = code === 190;
          const isPermission = code === 200 && /API access blocked|ads_management|ads_read/i.test(errorData?.error?.message || "");

          // Fallback Composio se habilitado.
          const connectedAccountId = config.composio_connected_account_id;
          if (composioEnabled(connectedAccountId)) {
            console.log(`Tentando fallback Composio para integração ${integracao.id_integracao}...`);
            const fb = await fetchMetaInsightsViaComposio({
              connectedAccountId,
              adAccountId,
              campaignIds: campanhas.map((c) => c.id_campanha_externo),
              since: hoje,
              until: hoje,
            });
            if (fb.ok && fb.rows) {
              apiData = { data: fb.rows.map((r) => ({ ...r.raw, campaign_id: r.campaign_id })) };
              fonteFallback = true;
              console.log(`Fallback Composio bem-sucedido: ${fb.rows.length} linhas`);
            } else {
              console.error(`Fallback Composio falhou: ${fb.error}`);
            }
          }

          if (!apiData) {
            const errorMessage = isTokenExpired
              ? "Access Token inválido ou expirado. Gere um novo System User Token no Meta Business Manager."
              : isPermission
                ? "API Access Blocked: System User sem permissão (ads_read/ads_management) ou app fora de modo Produção."
                : (errorData?.error?.message || `Erro ${response.status}: Verifique suas credenciais do Meta Ads`);

            await registrarFalha({
              supabase,
              idIntegracao: integracao.id_integracao,
              tipo: "META_ADS",
              nomeEmpresa,
              errorKind: isTokenExpired ? "TOKEN_EXPIRED" : isPermission ? "PERMISSION" : "OTHER",
              errorMsg: errorMessage,
            });

            resultados.push({
              integracao: integracao.id_integracao,
              status: "error",
              error: errorMessage,
            });
            continue;
          }
        }

        // Processar resultados.
        for (const metrica of apiData.data || []) {
          const campanha = campanhas.find((c) => c.id_campanha_externo === metrica.campaign_id);
          if (!campanha) continue;

          const { leads, actionTypesUsados } = calcularLeadsDeActions(
            metrica.actions,
            campanha.action_types_conversao as string[] | null,
            actionTypesEmpresaDefault,
          );

          const videoViews = metrica.video_play_actions?.find((a: any) => a.action_type === "video_view")?.value || 0;
          const videoAvgWatch = metrica.video_avg_time_watched_actions?.find((a: any) => a.action_type === "video_view")?.value || 0;
          const inlineLinkClicks = parseInt(metrica.inline_link_clicks || "0");
          const reach = parseInt(metrica.reach || "0");
          const frequency = parseFloat(metrica.frequency || "0");
          const spend = parseFloat(metrica.spend || "0");
          const clicks = parseInt(metrica.clicks || "0");

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: hoje,
            impressoes: parseInt(metrica.impressions || "0"),
            cliques: clicks,
            verba_investida: spend,
            leads,
            alcance: reach,
            frequencia: frequency,
            cpc_medio: clicks > 0 ? spend / clicks : 0,
            video_views: parseInt(videoViews),
            video_avg_watch_time: parseFloat(videoAvgWatch),
            inline_link_clicks: inlineLinkClicks,
            actions_json: {
              actions: metrica.actions || [],
              action_types_usados: actionTypesUsados,
              tz,
            },
            fonte_conversoes: fonteFallback ? "META_API_FALLBACK_COMPOSIO" : "META_API_DAILY",
          };

          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`Erro ao salvar métricas da campanha ${campanha.id_campanha}:`, upsertError);
          } else {
            resultados.push({
              campanha: campanha.id_campanha,
              status: "success",
              fallback: fonteFallback,
            });
          }
        }

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "META_ADS", nomeEmpresa });
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    const erros = resultados.filter((r) => r.status === "error");
    const sucessos = resultados.filter((r) => r.status === "success");
    const fallbacks = resultados.filter((r) => r.fallback).length;

    if (erros.length > 0 && sucessos.length === 0) {
      await supabase.from("cronjob_execucao").insert({
        nome_cronjob: nomeCronjob,
        status: "erro",
        duracao_ms: Date.now() - startTime,
        mensagem_erro: erros[0].error || "Todos os processamentos falharam",
        detalhes_execucao: { erros: erros.length, resultados },
      });
      return new Response(
        JSON.stringify({ error: erros[0].error || "Erro ao coletar métricas do Meta Ads", resultados }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: erros.length > 0 ? "parcial" : "sucesso",
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: {
        sucessos: sucessos.length,
        erros: erros.length,
        fallbacks_composio: fallbacks,
        resultados,
      },
    });

    return new Response(
      JSON.stringify({
        message: `Coleta concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s), ${fallbacks} via Composio`,
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro na função:", error);
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
