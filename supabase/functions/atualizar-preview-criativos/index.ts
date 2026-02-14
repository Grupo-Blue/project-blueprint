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
    console.log("🔄 Iniciando atualização de URLs de preview dos criativos...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const maxCriativos = body.max_criativos || 50;
    const apenasAtivos = body.apenas_ativos !== false;

    let query = supabase
      .from("criativo")
      .select(`
        id_criativo,
        id_anuncio_externo,
        id_criativo_externo,
        id_campanha,
        descricao,
        tipo,
        campanha:id_campanha (
          id_campanha_externo,
          nome,
          id_conta,
          conta_anuncio:id_conta (
            id_empresa,
            id_externo
          )
        )
      `)
      .is("url_preview", null)
      .order("created_at", { ascending: false })
      .limit(maxCriativos);

    if (apenasAtivos) {
      query = query.eq("ativo", true);
    }

    const { data: criativos, error: criativosError } = await query;

    if (criativosError) {
      throw new Error(`Erro ao buscar criativos: ${criativosError.message}`);
    }

    console.log(`📊 ${criativos?.length || 0} criativos sem url_preview encontrados`);

    if (!criativos || criativos.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum criativo sem url_preview encontrado",
          atualizados: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupar criativos por empresa
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
      atualizados: 0,
      erros: 0,
      sem_token: 0,
      videos_resolvidos: 0,
    };

    for (const [idEmpresa, criativosEmpresa] of Object.entries(criativosPorEmpresa)) {
      const { data: integracoes } = await supabase
        .from("integracao")
        .select("config_json")
        .eq("tipo", "META_ADS")
        .eq("ativo", true);

      const integracao = integracoes?.find(
        (i: any) => i.id_empresa === idEmpresa
      );

      if (!integracao) {
        console.log(`⚠️ Sem integração Meta ativa para empresa ${idEmpresa}`);
        estatisticas.sem_token += criativosEmpresa.length;
        continue;
      }

      const accessToken = (integracao.config_json as any)?.access_token;
      if (!accessToken) {
        console.log(`⚠️ Token não encontrado para empresa ${idEmpresa}`);
        estatisticas.sem_token += criativosEmpresa.length;
        continue;
      }

      const BATCH_SIZE = 10;
      const RATE_LIMIT_DELAY = 2000;

      for (let i = 0; i < criativosEmpresa.length; i += BATCH_SIZE) {
        const batch = criativosEmpresa.slice(i, i + BATCH_SIZE);

        if (i > 0) {
          console.log(`⏱️ Rate limit: aguardando ${RATE_LIMIT_DELAY / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
        }

        const promises = batch.map(async (criativo) => {
          try {
            estatisticas.total_processados++;
            let adId = criativo.id_anuncio_externo;
            const creativeId = criativo.id_criativo_externo;
            const accountId = (criativo.campanha as any)?.conta_anuncio?.id_externo;

            // Se não tiver id_anuncio_externo, tentar buscar via creative
            if (!adId && creativeId && accountId) {
              console.log(`🔍 Buscando anúncio para creative ${creativeId}...`);
              const searchUrl = `https://graph.facebook.com/v22.0/${accountId}/ads?fields=id,creative{id}&filtering=[{"field":"creative.id","operator":"EQUAL","value":"${creativeId}"}]&limit=1&access_token=${accessToken}`;
              
              try {
                const searchResp = await fetch(searchUrl);
                if (searchResp.ok) {
                  const searchData = await searchResp.json();
                  if (searchData.data && searchData.data.length > 0) {
                    adId = searchData.data[0].id;
                    console.log(`✅ Encontrado ad ${adId} para creative ${creativeId}`);
                    await supabase
                      .from("criativo")
                      .update({ id_anuncio_externo: adId })
                      .eq("id_criativo", criativo.id_criativo);
                  }
                }
              } catch (searchErr) {
                console.log(`⚠️ Erro ao buscar anúncio por creative: ${searchErr}`);
              }
            }

            if (!adId) {
              console.log(`⚠️ Criativo ${criativo.id_criativo} não possui id_anuncio_externo`);
              return;
            }

            // Fetch ad data with creative details (thumbnail + video_id)
            const adUrl = `https://graph.facebook.com/v22.0/${adId}?fields=preview_shareable_link,creative{thumbnail_url,video_id}&access_token=${accessToken}`;
            const response = await fetch(adUrl);

            if (!response.ok) {
              console.log(`❌ Erro ao buscar ad ${adId}: ${response.status}`);
              estatisticas.erros++;
              return;
            }

            const adData = await response.json();
            const previewUrl = adData.preview_shareable_link;
            const thumbnailUrl = adData.creative?.thumbnail_url;
            const videoId = adData.creative?.video_id;

            // Build public Ad Library link (works without login)
            const adLibraryUrl = `https://www.facebook.com/ads/library/?id=${adId}`;

            const updateFields: Record<string, any> = {
              // Prefer Ad Library URL (public), fallback to preview_shareable_link
              url_preview: adLibraryUrl,
              updated_at: new Date().toISOString(),
            };

            // Use thumbnail as higher-quality url_midia if available
            if (thumbnailUrl) {
              updateFields.url_midia = thumbnailUrl;
            }

            // For VIDEO creatives, fetch the actual video source URL
            if (videoId && (criativo.tipo === "VIDEO" || criativo.tipo === "video")) {
              try {
                const videoUrl = `https://graph.facebook.com/v22.0/${videoId}?fields=source&access_token=${accessToken}`;
                const videoResp = await fetch(videoUrl);
                if (videoResp.ok) {
                  const videoData = await videoResp.json();
                  if (videoData.source) {
                    updateFields.url_video = videoData.source;
                    estatisticas.videos_resolvidos++;
                    console.log(`🎬 Video source obtido para ad ${adId}`);
                  }
                }
              } catch (videoErr) {
                console.log(`⚠️ Erro ao buscar video source para ${videoId}: ${videoErr}`);
              }
            }

            const { error: updateError } = await supabase
              .from("criativo")
              .update(updateFields)
              .eq("id_criativo", criativo.id_criativo);

            if (updateError) {
              console.log(`❌ Erro ao atualizar criativo ${criativo.id_criativo}: ${updateError.message}`);
              estatisticas.erros++;
            } else {
              estatisticas.atualizados++;
              console.log(`✅ Atualizado: ${criativo.descricao?.substring(0, 40) || adId}...`);
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

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: estatisticas.erros > 0 ? "parcial" : "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: estatisticas,
    });

    console.log(`\n📊 ===== RESUMO =====`);
    console.log(`   Processados: ${estatisticas.total_processados}`);
    console.log(`   Atualizados: ${estatisticas.atualizados}`);
    console.log(`   Vídeos resolvidos: ${estatisticas.videos_resolvidos}`);
    console.log(`   Erros: ${estatisticas.erros}`);
    console.log(`   Sem token: ${estatisticas.sem_token}`);
    console.log(`   Duração: ${(duracao / 1000).toFixed(1)}s`);
    console.log(`====================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Atualização concluída: ${estatisticas.atualizados} criativos atualizados`,
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
