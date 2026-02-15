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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = await req.json().catch(() => ({}));
  const limit = body.limit || 50;
  const BATCH_SIZE = 10;
  const BUCKET = "criativos-media";

  try {
    console.log("📸 Iniciando salvamento de thumbnails no Storage...");

    // Buscar criativos com URLs temporárias (fbcdn.net)
    const { data: criativos, error } = await supabase
      .from("criativo")
      .select("id_criativo, url_midia, url_video, tipo, id_criativo_externo, id_anuncio_externo, id_campanha")
      .eq("ativo", true)
      .like("url_midia", "%fbcdn.net%")
      .limit(limit);

    if (error) throw error;

    if (!criativos || criativos.length === 0) {
      console.log("✅ Nenhum criativo com URL temporária encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum criativo pendente", salvos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 ${criativos.length} criativos com URLs temporárias`);

    let salvos = 0;
    let falhas = 0;
    let rebusc = 0;

    // Buscar tokens Meta para fallback via Graph API
    const { data: integracoes } = await supabase
      .from("conta_anuncio")
      .select("id_conta, id_empresa, id_externo, plataforma")
      .eq("plataforma", "META")
      .eq("ativa", true);

    const { data: configs } = await supabase
      .from("integracao_config")
      .select("id_empresa, chave, valor")
      .eq("chave", "meta_access_token");

    const tokenPorEmpresa: Record<string, string> = {};
    if (configs) {
      for (const c of configs) {
        tokenPorEmpresa[c.id_empresa] = c.valor;
      }
    }

    // Buscar id_empresa de cada campanha para saber o token
    const campanhaIds = [...new Set(criativos.map(c => c.id_campanha))];
    const { data: campanhas } = await supabase
      .from("campanha")
      .select("id_campanha, id_conta")
      .in("id_campanha", campanhaIds);

    const contaPorCampanha: Record<string, string> = {};
    if (campanhas) {
      for (const camp of campanhas) {
        contaPorCampanha[camp.id_campanha] = camp.id_conta;
      }
    }

    const empresaPorConta: Record<string, string> = {};
    if (integracoes) {
      for (const integ of integracoes) {
        empresaPorConta[integ.id_conta] = integ.id_empresa;
      }
    }

    // Processar em batches
    for (let i = 0; i < criativos.length; i += BATCH_SIZE) {
      const batch = criativos.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (criativo) => {
        const ext = criativo.tipo === "VIDEO" ? "jpg" : "jpg"; // thumbnail sempre jpg
        const storagePath = `${criativo.id_criativo}.${ext}`;

        try {
          // Tentar baixar a URL atual
          let imageData: ArrayBuffer | null = null;
          let contentType = "image/jpeg";

          const res = await fetch(criativo.url_midia, { signal: AbortSignal.timeout(10000) });
          if (res.ok) {
            imageData = await res.arrayBuffer();
            contentType = res.headers.get("content-type") || "image/jpeg";
          }

          // Se falhou, tentar re-buscar via Graph API
          if (!imageData && criativo.id_criativo_externo) {
            const contaId = contaPorCampanha[criativo.id_campanha];
            const empresaId = contaId ? empresaPorConta[contaId] : null;
            const token = empresaId ? tokenPorEmpresa[empresaId] : null;

            if (token) {
              console.log(`🔄 Re-buscando thumbnail via Graph API para ${criativo.id_criativo_externo}`);
              const graphRes = await fetch(
                `https://graph.facebook.com/v22.0/${criativo.id_criativo_externo}?fields=thumbnail_url&access_token=${token}`,
                { signal: AbortSignal.timeout(10000) }
              );

              if (graphRes.ok) {
                const graphData = await graphRes.json();
                if (graphData.thumbnail_url) {
                  const thumbRes = await fetch(graphData.thumbnail_url, { signal: AbortSignal.timeout(10000) });
                  if (thumbRes.ok) {
                    imageData = await thumbRes.arrayBuffer();
                    contentType = thumbRes.headers.get("content-type") || "image/jpeg";
                    rebusc++;
                  }
                }
              }
            }
          }

          if (!imageData) {
            console.log(`⚠️ Não foi possível obter imagem para ${criativo.id_criativo}`);
            falhas++;
            return;
          }

          // Limitar a 5MB
          if (imageData.byteLength > 5 * 1024 * 1024) {
            console.log(`⚠️ Imagem muito grande (${(imageData.byteLength / 1024 / 1024).toFixed(1)}MB), pulando ${criativo.id_criativo}`);
            falhas++;
            return;
          }

          // Upload para Storage
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, imageData, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            console.error(`❌ Erro upload ${criativo.id_criativo}:`, uploadError.message);
            falhas++;
            return;
          }

          // Obter URL pública
          const { data: publicUrl } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(storagePath);

          // Atualizar url_midia com URL permanente
          const { error: updateError } = await supabase
            .from("criativo")
            .update({ url_midia: publicUrl.publicUrl })
            .eq("id_criativo", criativo.id_criativo);

          if (updateError) {
            console.error(`❌ Erro update ${criativo.id_criativo}:`, updateError.message);
            falhas++;
            return;
          }

          salvos++;
        } catch (err: any) {
          console.error(`❌ Erro processando ${criativo.id_criativo}:`, err.message);
          falhas++;
        }
      }));

      // Delay entre batches
      if (i + BATCH_SIZE < criativos.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`📸 Thumbnails: ${salvos} salvos, ${falhas} falhas, ${rebusc} re-buscados via API`);

    return new Response(
      JSON.stringify({ success: true, salvos, falhas, rebuscados_api: rebusc, total: criativos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro geral salvar-thumbnails:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
