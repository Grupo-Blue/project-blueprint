import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METRICOOL_API_BASE = "https://app.metricool.com/api";

interface MetricoolConfig {
  user_token: string;
  user_id: string;
  blog_id: string;
  id_empresa: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("🚀 Iniciando sincronização Metricool...");

    // Buscar todas as integrações Metricool ativas
    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("⚠️ Nenhuma integração Metricool configurada");
      return new Response(JSON.stringify({ 
        message: "Nenhuma integração Metricool configurada",
        processadas: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as MetricoolConfig;
      const empresaId = config.id_empresa;

      console.log(`\n📊 Processando empresa ${empresaId}...`);

      try {
        // Calcular período (últimos 30 dias)
        const hoje = new Date();
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        
        const initDate = trintaDiasAtras.toISOString().split('T')[0];
        const endDate = hoje.toISOString().split('T')[0];

        // Headers de autenticação Metricool
        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        // 1. Coletar métricas de seguidores
        console.log("📈 Coletando métricas de seguidores...");
        const followersUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/igFollowers?initDate=${initDate}&endDate=${endDate}`;
        
        const followersResp = await fetch(followersUrl, { headers });
        
        if (!followersResp.ok) {
          const errorText = await followersResp.text();
          console.error(`❌ Erro ao buscar seguidores: ${followersResp.status} - ${errorText}`);
          throw new Error(`Erro API Metricool (seguidores): ${followersResp.status}`);
        }

        const followersData = await followersResp.json();
        console.log(`✅ Dados de seguidores recebidos: ${followersData?.length || 0} registros`);

        // 2. Coletar visitas ao perfil
        console.log("👀 Coletando visitas ao perfil...");
        const profileViewsUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/igProfileViews?initDate=${initDate}&endDate=${endDate}`;
        
        const profileViewsResp = await fetch(profileViewsUrl, { headers });
        const profileViewsData = profileViewsResp.ok ? await profileViewsResp.json() : [];
        console.log(`✅ Visitas ao perfil: ${profileViewsData?.length || 0} registros`);

        // 3. Coletar cliques no website
        console.log("🔗 Coletando cliques no website...");
        const websiteClicksUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/igWebsiteClicks?initDate=${initDate}&endDate=${endDate}`;
        
        const websiteClicksResp = await fetch(websiteClicksUrl, { headers });
        const websiteClicksData = websiteClicksResp.ok ? await websiteClicksResp.json() : [];
        console.log(`✅ Cliques website: ${websiteClicksData?.length || 0} registros`);

        // 4. Coletar alcance
        console.log("📢 Coletando alcance...");
        const reachUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/igReach?initDate=${initDate}&endDate=${endDate}`;
        
        const reachResp = await fetch(reachUrl, { headers });
        const reachData = reachResp.ok ? await reachResp.json() : [];
        console.log(`✅ Alcance: ${reachData?.length || 0} registros`);

        // 5. Coletar impressões
        console.log("👁️ Coletando impressões...");
        const impressionsUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/igImpressions?initDate=${initDate}&endDate=${endDate}`;
        
        const impressionsResp = await fetch(impressionsUrl, { headers });
        const impressionsData = impressionsResp.ok ? await impressionsResp.json() : [];
        console.log(`✅ Impressões: ${impressionsData?.length || 0} registros`);

        // Consolidar dados por data
        const metricasPorData = new Map<string, {
          seguidores_total: number;
          novos_seguidores: number;
          visitas_perfil: number;
          cliques_website: number;
          alcance: number;
          impressoes: number;
        }>();

        // Processar seguidores (estrutura: [{date: "YYYY-MM-DD", value: number}])
        let seguidoresAnterior = 0;
        for (const item of (followersData || [])) {
          const data = item.date;
          if (!metricasPorData.has(data)) {
            metricasPorData.set(data, {
              seguidores_total: 0,
              novos_seguidores: 0,
              visitas_perfil: 0,
              cliques_website: 0,
              alcance: 0,
              impressoes: 0,
            });
          }
          const metricas = metricasPorData.get(data)!;
          metricas.seguidores_total = item.value || 0;
          metricas.novos_seguidores = seguidoresAnterior > 0 ? (item.value || 0) - seguidoresAnterior : 0;
          seguidoresAnterior = item.value || 0;
        }

        // Processar visitas ao perfil
        for (const item of (profileViewsData || [])) {
          const data = item.date;
          if (!metricasPorData.has(data)) {
            metricasPorData.set(data, {
              seguidores_total: 0,
              novos_seguidores: 0,
              visitas_perfil: 0,
              cliques_website: 0,
              alcance: 0,
              impressoes: 0,
            });
          }
          metricasPorData.get(data)!.visitas_perfil = item.value || 0;
        }

        // Processar cliques website
        for (const item of (websiteClicksData || [])) {
          const data = item.date;
          if (metricasPorData.has(data)) {
            metricasPorData.get(data)!.cliques_website = item.value || 0;
          }
        }

        // Processar alcance
        for (const item of (reachData || [])) {
          const data = item.date;
          if (metricasPorData.has(data)) {
            metricasPorData.get(data)!.alcance = item.value || 0;
          }
        }

        // Processar impressões
        for (const item of (impressionsData || [])) {
          const data = item.date;
          if (metricasPorData.has(data)) {
            metricasPorData.get(data)!.impressoes = item.value || 0;
          }
        }

        // Upsert métricas no banco
        console.log(`💾 Salvando ${metricasPorData.size} registros de métricas...`);
        
        for (const [data, metricas] of metricasPorData) {
          const { error: upsertError } = await supabase
            .from('instagram_metricas_dia')
            .upsert({
              id_empresa: empresaId,
              data,
              ...metricas,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id_empresa,data'
            });

          if (upsertError) {
            console.error(`⚠️ Erro ao salvar métrica ${data}:`, upsertError.message);
          }
        }

        // 6. Coletar SmartLinks (se disponível)
        console.log("🔗 Coletando SmartLinks...");
        try {
          const smartlinksUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/smartlinks/stats?initDate=${initDate}&endDate=${endDate}`;
          
          const smartlinksResp = await fetch(smartlinksUrl, { headers });
          
          if (smartlinksResp.ok) {
            const smartlinksData = await smartlinksResp.json();
            console.log(`✅ SmartLinks: ${smartlinksData?.length || 0} registros`);

            // Processar SmartLinks
            for (const smartlink of (smartlinksData || [])) {
              for (const stat of (smartlink.stats || [])) {
                const { error: slError } = await supabase
                  .from('smartlink_cliques')
                  .upsert({
                    id_empresa: empresaId,
                    smartlink_id: smartlink.id,
                    smartlink_nome: smartlink.name,
                    smartlink_url: smartlink.url,
                    data: stat.date,
                    cliques: stat.clicks || 0,
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'id_empresa,smartlink_id,data'
                  });

                if (slError) {
                  console.error(`⚠️ Erro ao salvar SmartLink:`, slError.message);
                }
              }
            }
          } else {
            console.log("ℹ️ SmartLinks não disponível ou sem dados");
          }
        } catch (slError) {
          console.log("ℹ️ Endpoint de SmartLinks não acessível:", slError);
        }

        resultados.push({
          empresa_id: empresaId,
          status: "success",
          metricas_processadas: metricasPorData.size,
        });

      } catch (empresaError: any) {
        console.error(`❌ Erro na empresa ${empresaId}:`, empresaError.message);
        resultados.push({
          empresa_id: empresaId,
          status: "error",
          error: empresaError.message,
        });
      }
    }

    // Registrar execução do cronjob
    const duracao = Date.now() - startTime;
    const temErro = resultados.some(r => r.status === "error");
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'sincronizar-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find(r => r.status === "error")?.error : null,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Sincronização Metricool concluída em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Sincronização concluída",
      duracao_ms: duracao,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    
    // Registrar erro no cronjob
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'sincronizar-metricool',
      status: 'error',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
