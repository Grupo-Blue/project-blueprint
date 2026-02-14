import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "atualizar-preview-criativos";

  try {
    console.log("🔄 Iniciando atualização de URLs de preview dos criativos (links permanentes)...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const maxCriativos = body.max_criativos || 200;
    const apenasAtivos = body.apenas_ativos !== false;
    const forcarAtualizacao = body.forcar === true;

    // Buscar criativos Meta que precisam de atualização
    let query = supabase
      .from("criativo")
      .select(`
        id_criativo,
        id_anuncio_externo,
        id_criativo_externo,
        id_campanha,
        descricao,
        tipo,
        url_preview,
        url_midia,
        campanha:id_campanha!inner (
          id_campanha_externo,
          nome,
          id_conta,
          conta_anuncio:id_conta!inner (
            id_empresa,
            id_externo,
            plataforma
          )
        )
      `)
      .eq("campanha.conta_anuncio.plataforma", "META")
      .order("created_at", { ascending: false })
      .limit(maxCriativos);

    if (!forcarAtualizacao) {
      // Buscar apenas criativos sem url_preview ou com fb.me (links temporários)
      query = query.or("url_preview.is.null,url_preview.like.%fb.me%");
    }

    if (apenasAtivos) {
      query = query.eq("ativo", true);
    }

    const { data: criativos, error: criativosError } = await query;

    if (criativosError) {
      throw new Error(`Erro ao buscar criativos: ${criativosError.message}`);
    }

    console.log(`📊 ${criativos?.length || 0} criativos para processar`);

    if (!criativos || criativos.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum criativo para atualizar",
          atualizados: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupar criativos por empresa para buscar tokens
    const criativosPorEmpresa: Record<string, any[]> = {};
    for (const criativo of criativos) {
      const idEmpresa = (criativo.campanha as any)?.conta_anuncio?.id_empresa;
      if (!idEmpresa) continue;
      if (!criativosPorEmpresa[idEmpresa]) {
        criativosPorEmpresa[idEmpresa] = [];
      }
      criativosPorEmpresa[idEmpresa].push(criativo);
    }

    const estatisticas = {
      total_processados: 0,
      atualizados_ads_manager: 0,
      atualizados_ad_library: 0,
      buscou_ad_id: 0,
      erros: 0,
      sem_token: 0,
      videos_resolvidos: 0,
      sem_id: 0,
    };

    for (const [idEmpresa, criativosEmpresa] of Object.entries(criativosPorEmpresa)) {
      const { data: integracoes } = await supabase
        .from("integracao")
        .select("id_empresa, config_json")
        .eq("tipo", "META_ADS")
        .eq("ativo", true);

      const integracao = integracoes?.find(
        (i: any) => i.id_empresa === idEmpresa
      );

      const accessToken = integracao ? (integracao.config_json as any)?.access_token : null;

      if (!accessToken) {
        console.log(`⚠️ Sem token Meta para empresa ${idEmpresa}, usando apenas links permanentes locais`);
      }

      const BATCH_SIZE = 10;
      const RATE_LIMIT_DELAY = 2000;

      for (let i = 0; i < criativosEmpresa.length; i += BATCH_SIZE) {
        const batch = criativosEmpresa.slice(i, i + BATCH_SIZE);

        if (i > 0 && accessToken) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
        }

        const promises = batch.map(async (criativo) => {
          try {
            estatisticas.total_processados++;
            let adId = criativo.id_anuncio_externo;
            const creativeId = criativo.id_criativo_externo;
            const accountId = (criativo.campanha as any)?.conta_anuncio?.id_externo;

            // Se não tiver id_anuncio_externo, tentar buscar via Graph API
            if (!adId && creativeId && accountId && accessToken) {
              console.log(`🔍 Buscando anúncio para creative ${creativeId}...`);
              try {
                const searchUrl = `https://graph.facebook.com/v22.0/${accountId}/ads?fields=id,creative{id}&filtering=[{"field":"creative.id","operator":"EQUAL","value":"${creativeId}"}]&limit=1&access_token=${accessToken}`;
                const searchResp = await fetch(searchUrl);
                if (searchResp.ok) {
                  const searchData = await searchResp.json();
                  if (searchData.data && searchData.data.length > 0) {
                    adId = searchData.data[0].id;
                    estatisticas.buscou_ad_id++;
                    console.log(`✅ Encontrado ad ${adId} para creative ${creativeId}`);
                    await supabase
                      .from("criativo")
                      .update({ id_anuncio_externo: adId })
                      .eq("id_criativo", criativo.id_criativo);
                  }
                }
              } catch (searchErr) {
                console.log(`⚠️ Erro ao buscar anúncio: ${searchErr}`);
              }
            }

            // Gerar link permanente
            const updateFields: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };

            if (adId && accountId) {
              // Formato Ads Manager (permanente, requer login)
              const cleanAccountId = accountId.replace(/^act_/, "");
              updateFields.url_preview = `https://www.facebook.com/ads/manager/creation/adpreview/?act=${cleanAccountId}&adId=${adId}`;
              estatisticas.atualizados_ads_manager++;
            } else if (adId) {
              // Fallback: Ad Library (público, permanente)
              updateFields.url_preview = `https://www.facebook.com/ads/library/?id=${adId}`;
              estatisticas.atualizados_ad_library++;
            } else {
              console.log(`⚠️ Criativo ${criativo.id_criativo} sem IDs para gerar link`);
              estatisticas.sem_id++;
              return;
            }

            // Buscar thumbnail/video se não tem url_midia e tem token
            if (!criativo.url_midia && accessToken && adId) {
              try {
                const adUrl = `https://graph.facebook.com/v22.0/${adId}?fields=creative{thumbnail_url,video_id}&access_token=${accessToken}`;
                const response = await fetch(adUrl);
                if (response.ok) {
                  const adData = await response.json();
                  const thumbnailUrl = adData.creative?.thumbnail_url;
                  const videoId = adData.creative?.video_id;

                  if (thumbnailUrl) updateFields.url_midia = thumbnailUrl;

                  if (videoId && (criativo.tipo === "VIDEO" || criativo.tipo === "video")) {
                    try {
                      const videoResp = await fetch(`https://graph.facebook.com/v22.0/${videoId}?fields=source&access_token=${accessToken}`);
                      if (videoResp.ok) {
                        const vd = await videoResp.json();
                        if (vd.source) {
                          updateFields.url_video = vd.source;
                          estatisticas.videos_resolvidos++;
                        }
                      }
                    } catch {}
                  }
                }
              } catch {}
            }

            const { error: updateError } = await supabase
              .from("criativo")
              .update(updateFields)
              .eq("id_criativo", criativo.id_criativo);

            if (updateError) {
              console.log(`❌ Erro ao atualizar criativo ${criativo.id_criativo}: ${updateError.message}`);
              estatisticas.erros++;
            } else {
              console.log(`✅ ${criativo.descricao?.substring(0, 40) || adId} → ${adId && accountId ? 'AdsManager' : 'AdLibrary'}`);
            }
          } catch (err) {
            console.error(`❌ Erro ao processar criativo:`, err);
            estatisticas.erros++;
          }
        });

        await Promise.all(promises);
      }
    }

    const duracao = Date.now() - startTime;
    const totalAtualizados = estatisticas.atualizados_ads_manager + estatisticas.atualizados_ad_library;

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: estatisticas.erros > 0 ? "parcial" : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: estatisticas,
    });

    console.log(`\n📊 ===== RESUMO =====`);
    console.log(`   Processados: ${estatisticas.total_processados}`);
    console.log(`   Ads Manager: ${estatisticas.atualizados_ads_manager}`);
    console.log(`   Ad Library: ${estatisticas.atualizados_ad_library}`);
    console.log(`   Ad IDs recuperados: ${estatisticas.buscou_ad_id}`);
    console.log(`   Vídeos resolvidos: ${estatisticas.videos_resolvidos}`);
    console.log(`   Sem IDs: ${estatisticas.sem_id}`);
    console.log(`   Erros: ${estatisticas.erros}`);
    console.log(`   Duração: ${(duracao / 1000).toFixed(1)}s`);
    console.log(`====================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Atualização concluída: ${totalAtualizados} criativos com links permanentes`,
        estatisticas,
        duracao_segundos: (duracao / 1000).toFixed(1),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro na atualização de previews:", error);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: Date.now() - startTime,
      mensagem_erro: errorMessage,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});