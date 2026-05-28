import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";
import { calcularLeadsDeActions } from "../_shared/meta_helpers.ts";
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
  const nomeCronjob = "coletar-metricas-meta-historico";
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parâmetros: data_inicio, data_fim, integracao_id (opcional)
    const body = await req.json().catch(() => ({}));
    const dataInicio = body.data_inicio;
    const dataFim = body.data_fim;
    const integracaoIdFiltro = body.integracao_id;

    if (!dataInicio || !dataFim) {
      return new Response(
        JSON.stringify({ error: "Parâmetros data_inicio e data_fim são obrigatórios (formato: YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Iniciando coleta histórica Meta Ads de ${dataInicio} a ${dataFim}...`);

    // Buscar integrações Meta Ads ativas
    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome, action_types_conversao_default)")
      .eq("tipo", "META_ADS")
      .eq("ativo", true);

    if (integracaoIdFiltro) {
      query = query.eq("id_integracao", integracaoIdFiltro);
      console.log(`Filtrando por integração: ${integracaoIdFiltro}`);
    }

    const { data: integracoes, error: intError } = await query;

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Meta Ads ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = [];
    let totalMetricas = 0;
    let gastoTotal = 0;

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const accessToken = config.access_token;
      const adAccountId = config.ad_account_id;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;
      const actionTypesEmpresaDefault: string[] | null = integracao.empresa?.action_types_conversao_default ?? null;

      console.log(`Processando integração para empresa ${idEmpresa}, ad account ${adAccountId}`);

      try {
        // Buscar a conta_anuncio específica desta integração pelo id_externo
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

        // Sem filtro `.eq("ativa", true)`: paridade com a coleta diária; campanhas pausadas
        // ainda precisam ser coletadas para fechamento histórico.
        const { data: campanhas, error: campError } = await supabase
          .from("campanha")
          .select("id_campanha, id_campanha_externo, id_conta, action_types_conversao")
          .eq("id_conta", contaAnuncio.id_conta);

        if (campError) throw campError;
        if (!campanhas || campanhas.length === 0) {
          console.log(`Nenhuma campanha encontrada para empresa ${idEmpresa}`);
          continue;
        }

        console.log(`Encontradas ${campanhas.length} campanhas para processar`);

        // Buscar métricas históricas da API do Meta
        // time_range permite especificar datas personalizadas
        const fields = "campaign_id,impressions,clicks,spend,actions";
        const timeRange = JSON.stringify({ since: dataInicio, until: dataFim });
        const campanhIdsStr = campanhas.map(c => c.id_campanha_externo).join(",");
        const filtering = `[{"field":"campaign.id","operator":"IN","value":["${campanhIdsStr.replace(/,/g, '","')}"]}]`;

        // use_unified_attribution_setting=true alinha com o Ads Manager (default atual).
        const url =
          `https://graph.facebook.com/v22.0/${adAccountId}/insights` +
          `?fields=${fields}` +
          `&level=campaign` +
          `&time_range=${encodeURIComponent(timeRange)}` +
          `&time_increment=1` +
          `&use_unified_attribution_setting=true` +
          `&access_token=${accessToken}` +
          `&filtering=${encodeURIComponent(filtering)}` +
          `&limit=500`;

        console.log(`Chamando API Meta para período ${dataInicio} a ${dataFim}`);

        let apiData: any = null;
        let fonteFallback = false;
        const response = await fetch(url);
        if (response.ok) {
          apiData = await response.json();
        } else {
          const errorText = await response.text();
          console.error(`Erro na API Meta: ${response.status} - ${errorText}`);
          const errorData = (() => { try { return JSON.parse(errorText); } catch { return {}; } })();
          const code = errorData?.error?.code;
          const isTokenExpired = code === 190;
          const isPermission = code === 200 && /API access blocked|ads_management|ads_read/i.test(errorData?.error?.message || "");

          const connectedAccountId = config.composio_connected_account_id;
          if (composioEnabled(connectedAccountId)) {
            console.log(`Tentando fallback Composio para integração ${integracao.id_integracao}...`);
            const fb = await fetchMetaInsightsViaComposio({
              connectedAccountId,
              adAccountId,
              campaignIds: campanhas.map(c => c.id_campanha_externo),
              since: dataInicio,
              until: dataFim,
            });
            if (fb.ok && fb.rows) {
              apiData = { data: fb.rows.map(r => ({ ...r.raw, campaign_id: r.campaign_id })) };
              fonteFallback = true;
            } else {
              console.error(`Fallback Composio falhou: ${fb.error}`);
            }
          }

          if (!apiData) {
            const errorMessage = isTokenExpired
              ? "Access Token inválido ou expirado"
              : isPermission
                ? "API Access Blocked"
                : (errorData?.error?.message || `Erro ${response.status}`);

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

        let metricasProcessadas = 0;

        const processarLinha = async (metrica: any) => {
          const campanha = campanhas.find(c => c.id_campanha_externo === metrica.campaign_id);
          if (!campanha) return false;

          const dataMetrica = metrica.date_start || metrica.date;
          const { leads, actionTypesUsados } = calcularLeadsDeActions(
            metrica.actions,
            campanha.action_types_conversao as string[] | null,
            actionTypesEmpresaDefault,
          );
          const gasto = parseFloat(metrica.spend || "0");
          gastoTotal += gasto;

          const metricasDia = {
            id_campanha: campanha.id_campanha,
            data: dataMetrica,
            impressoes: parseInt(metrica.impressions || "0"),
            cliques: parseInt(metrica.clicks || "0"),
            verba_investida: gasto,
            leads,
            actions_json: {
              actions: metrica.actions || [],
              action_types_usados: actionTypesUsados,
            },
            fonte_conversoes: fonteFallback ? "META_API_FALLBACK_COMPOSIO" : "META_API_DAILY",
          };

          const { error: upsertError } = await supabase
            .from("campanha_metricas_dia")
            .upsert(metricasDia, { onConflict: "id_campanha,data" });

          if (upsertError) {
            console.error(`Erro ao salvar métricas:`, upsertError);
            return false;
          }
          return true;
        };

        for (const metrica of apiData.data || []) {
          if (await processarLinha(metrica)) metricasProcessadas++;
        }

        // Paginar (somente quando vier da API direta; fallback Composio retorna tudo de uma vez).
        if (!fonteFallback) {
          let nextPageUrl = apiData.paging?.next;
          while (nextPageUrl) {
            console.log("Buscando próxima página de resultados...");
            const nextResponse = await fetch(nextPageUrl);
            if (!nextResponse.ok) break;
            const nextData = await nextResponse.json();
            for (const metrica of nextData.data || []) {
              if (await processarLinha(metrica)) metricasProcessadas++;
            }
            nextPageUrl = nextData.paging?.next;
          }
        }

        totalMetricas += metricasProcessadas;
        console.log(`Processadas ${metricasProcessadas} métricas para empresa ${idEmpresa}`);
        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "META_ADS", nomeEmpresa });

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: "success",
          metricas: metricasProcessadas,
          fallback: fonteFallback,
        });
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log(`Coleta histórica concluída: ${totalMetricas} métricas, R$ ${gastoTotal.toFixed(2)} total`);
    
    // Registrar execução
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: { 
        periodo: { inicio: dataInicio, fim: dataFim },
        total_metricas: totalMetricas,
        gasto_total: gastoTotal,
        resultados 
      }
    });
    
    return new Response(
      JSON.stringify({ 
        message: `Coleta histórica concluída: ${totalMetricas} métricas processadas`,
        periodo: { inicio: dataInicio, fim: dataFim },
        gasto_total: gastoTotal,
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    
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
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
