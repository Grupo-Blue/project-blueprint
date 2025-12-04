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

// Configuração de métricas por rede social
const REDES_CONFIG: Record<string, {
  prefixo: string;
  metricas: { nome: string; campo: string }[];
  dbRede: string;
}> = {
  INSTAGRAM: {
    prefixo: 'ig',
    metricas: [
      { nome: 'Followers', campo: 'seguidores_total' },
      { nome: 'ProfileViews', campo: 'visitas_perfil' },
      { nome: 'WebsiteClicks', campo: 'cliques_website' },
      { nome: 'Reach', campo: 'alcance' },
      { nome: 'Impressions', campo: 'impressoes' },
    ],
    dbRede: 'INSTAGRAM',
  },
  FACEBOOK: {
    prefixo: 'fb',
    metricas: [
      { nome: 'PageFollowers', campo: 'seguidores_total' },
      { nome: 'PageViews', campo: 'visitas_perfil' },
      { nome: 'WebsiteClicks', campo: 'cliques_website' },
      { nome: 'Reach', campo: 'alcance' },
      { nome: 'Impressions', campo: 'impressoes' },
    ],
    dbRede: 'FACEBOOK',
  },
  LINKEDIN: {
    prefixo: 'li',
    metricas: [
      { nome: 'Followers', campo: 'seguidores_total' },
      { nome: 'ProfileViews', campo: 'visitas_perfil' },
      { nome: 'WebsiteClicks', campo: 'cliques_website' },
      { nome: 'Reach', campo: 'alcance' },
      { nome: 'Impressions', campo: 'impressoes' },
    ],
    dbRede: 'LINKEDIN',
  },
  TIKTOK: {
    prefixo: 'tk',
    metricas: [
      { nome: 'Followers', campo: 'seguidores_total' },
      { nome: 'ProfileViews', campo: 'visitas_perfil' },
      { nome: 'VideoViews', campo: 'alcance' },
      { nome: 'Engagement', campo: 'engajamento' },
    ],
    dbRede: 'TIKTOK',
  },
  YOUTUBE: {
    prefixo: 'yt',
    metricas: [
      { nome: 'Subscribers', campo: 'seguidores_total' },
      { nome: 'Views', campo: 'alcance' },
      { nome: 'WatchTime', campo: 'impressoes' },
      { nome: 'Engagement', campo: 'engajamento' },
    ],
    dbRede: 'YOUTUBE',
  },
  TWITTER: {
    prefixo: 'tw',
    metricas: [
      { nome: 'Followers', campo: 'seguidores_total' },
      { nome: 'ProfileViews', campo: 'visitas_perfil' },
      { nome: 'UrlClicks', campo: 'cliques_website' },
      { nome: 'Impressions', campo: 'impressoes' },
    ],
    dbRede: 'TWITTER',
  },
};

async function coletarMetricasRede(
  config: MetricoolConfig,
  headers: Record<string, string>,
  redeConfig: typeof REDES_CONFIG[string],
  redeName: string,
  initDate: string,
  endDate: string
): Promise<Map<string, Record<string, number>>> {
  const metricasPorData = new Map<string, Record<string, number>>();

  console.log(`  📊 Coletando métricas ${redeName}...`);

  for (const metrica of redeConfig.metricas) {
    try {
      const url = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/stats/timeline/${redeConfig.prefixo}${metrica.nome}?initDate=${initDate}&endDate=${endDate}`;
      const resp = await fetch(url, { headers });
      
      if (resp.ok) {
        const data = await resp.json();
        
        let valorAnterior = 0;
        for (const item of (data || [])) {
          const dataStr = item.date;
          if (!metricasPorData.has(dataStr)) {
            metricasPorData.set(dataStr, {
              seguidores_total: 0,
              novos_seguidores: 0,
              visitas_perfil: 0,
              cliques_website: 0,
              alcance: 0,
              impressoes: 0,
              engajamento: 0,
            });
          }
          
          const metricas = metricasPorData.get(dataStr)!;
          metricas[metrica.campo] = item.value || 0;
          
          // Calcular novos seguidores se for métrica de seguidores
          if (metrica.campo === 'seguidores_total') {
            metricas.novos_seguidores = valorAnterior > 0 ? (item.value || 0) - valorAnterior : 0;
            valorAnterior = item.value || 0;
          }
        }
        
        console.log(`    ✅ ${metrica.nome}: ${data?.length || 0} registros`);
      } else {
        console.log(`    ⚠️ ${metrica.nome}: não disponível (${resp.status})`);
      }
    } catch (error) {
      console.log(`    ⚠️ ${metrica.nome}: erro ao coletar`, error);
    }
  }

  return metricasPorData;
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
    console.log("🚀 Iniciando sincronização Metricool (Multi-Rede)...");

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

        const redesProcessadas: string[] = [];
        let totalMetricas = 0;

        // Iterar sobre todas as redes configuradas
        for (const [redeName, redeConfig] of Object.entries(REDES_CONFIG)) {
          try {
            console.log(`\n🌐 Processando ${redeName}...`);
            
            const metricasPorData = await coletarMetricasRede(
              config,
              headers,
              redeConfig,
              redeName,
              initDate,
              endDate
            );

            if (metricasPorData.size > 0) {
              redesProcessadas.push(redeName);
              totalMetricas += metricasPorData.size;

              // Salvar na tabela genérica social_metricas_dia
              for (const [data, metricas] of metricasPorData) {
                const { error: upsertError } = await supabase
                  .from('social_metricas_dia')
                  .upsert({
                    id_empresa: empresaId,
                    rede_social: redeConfig.dbRede,
                    data,
                    ...metricas,
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'id_empresa,rede_social,data'
                  });

                if (upsertError) {
                  console.error(`  ⚠️ Erro ao salvar ${redeName} ${data}:`, upsertError.message);
                }
              }

              // Também salvar na tabela instagram_metricas_dia para compatibilidade
              if (redeName === 'INSTAGRAM') {
                for (const [data, metricas] of metricasPorData) {
                  await supabase
                    .from('instagram_metricas_dia')
                    .upsert({
                      id_empresa: empresaId,
                      data,
                      seguidores_total: metricas.seguidores_total,
                      novos_seguidores: metricas.novos_seguidores,
                      visitas_perfil: metricas.visitas_perfil,
                      cliques_website: metricas.cliques_website,
                      alcance: metricas.alcance,
                      impressoes: metricas.impressoes,
                      updated_at: new Date().toISOString(),
                    }, {
                      onConflict: 'id_empresa,data'
                    });
                }
              }

              console.log(`  ✅ ${redeName}: ${metricasPorData.size} registros salvos`);
            } else {
              console.log(`  ℹ️ ${redeName}: sem dados disponíveis`);
            }
          } catch (redeError) {
            console.log(`  ❌ ${redeName}: erro ao processar`, redeError);
          }
        }

        // Coletar SmartLinks (se disponível)
        console.log("\n🔗 Coletando SmartLinks...");
        try {
          const smartlinksUrl = `${METRICOOL_API_BASE}/${config.user_id}/${config.blog_id}/smartlinks/stats?initDate=${initDate}&endDate=${endDate}`;
          const smartlinksResp = await fetch(smartlinksUrl, { headers });
          
          if (smartlinksResp.ok) {
            const smartlinksData = await smartlinksResp.json();
            console.log(`✅ SmartLinks: ${smartlinksData?.length || 0} registros`);

            for (const smartlink of (smartlinksData || [])) {
              for (const stat of (smartlink.stats || [])) {
                await supabase
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
              }
            }
          } else {
            console.log("ℹ️ SmartLinks não disponível");
          }
        } catch (slError) {
          console.log("ℹ️ SmartLinks não acessível:", slError);
        }

        resultados.push({
          empresa_id: empresaId,
          status: "success",
          redes_processadas: redesProcessadas,
          total_metricas: totalMetricas,
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

    console.log(`\n✅ Sincronização Multi-Rede concluída em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Sincronização Multi-Rede concluída",
      duracao_ms: duracao,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    
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
