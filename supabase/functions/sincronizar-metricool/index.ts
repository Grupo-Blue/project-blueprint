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

// Configuração de métricas por rede social - nomes CORRETOS da API Metricool
const REDES_CONFIG: Record<string, {
  metricas: { nome: string; campo: string }[];
  dbRede: string;
}> = {
  INSTAGRAM: {
    metricas: [
      { nome: 'igFollowers', campo: 'seguidores_total' },
      { nome: 'igprofile_views', campo: 'visitas_perfil' },
      { nome: 'igwebsite_clicks', campo: 'cliques_website' },
      { nome: 'igreach', campo: 'alcance' },
      { nome: 'igimpressions', campo: 'impressoes' },
    ],
    dbRede: 'INSTAGRAM',
  },
  FACEBOOK: {
    metricas: [
      { nome: 'facebookLikes', campo: 'seguidores_total' },
      { nome: 'pageViews', campo: 'visitas_perfil' },
      { nome: 'dailyClicks', campo: 'cliques_website' },
      { nome: 'pageImpressions', campo: 'alcance' },
      { nome: 'dailyImpressions', campo: 'impressoes' },
    ],
    dbRede: 'FACEBOOK',
  },
  LINKEDIN: {
    metricas: [
      { nome: 'inFollowers', campo: 'seguidores_total' },
      { nome: 'inCliks', campo: 'cliques_website' },
      { nome: 'inCompanyImpressions', campo: 'impressoes' },
    ],
    dbRede: 'LINKEDIN',
  },
  TIKTOK: {
    metricas: [
      { nome: 'tiktokFollowers', campo: 'seguidores_total' },
      { nome: 'tiktokVideoViews', campo: 'alcance' },
      { nome: 'tiktokProfileViews', campo: 'visitas_perfil' },
    ],
    dbRede: 'TIKTOK',
  },
  YOUTUBE: {
    metricas: [
      { nome: 'yttotalSubscribers', campo: 'seguidores_total' },
      { nome: 'ytviews', campo: 'alcance' },
      { nome: 'ytestimatedMinutesWatched', campo: 'impressoes' },
    ],
    dbRede: 'YOUTUBE',
  },
  TWITTER: {
    metricas: [
      { nome: 'twitterFollowers', campo: 'seguidores_total' },
      { nome: 'twFavorites', campo: 'engajamento' },
      { nome: 'twImpressions', campo: 'impressoes' },
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
      // CORREÇÃO: URL com query parameters e formato correto
      const url = `${METRICOOL_API_BASE}/stats/timeline/${metrica.nome}?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
      
      console.log(`    🔗 URL: ${url}`);
      const resp = await fetch(url, { headers });
      
      if (resp.ok) {
        const data = await resp.json();
        
        // DEBUG: Logar estrutura do primeiro item para entender o formato da API
        if (data && data.length > 0) {
          console.log(`    📋 Estrutura do primeiro item: ${JSON.stringify(data[0])}`);
          console.log(`    📋 Tipo do item: ${typeof data[0]}, É array: ${Array.isArray(data[0])}`);
        }
        
        let valorAnterior = 0;
        for (const item of (data || [])) {
          let dataStr: string | null = null;
          let valorMetrica: number = 0;
          
          // Verificar se é formato array [valor, timestamp] ou [timestamp, valor]
          if (Array.isArray(item)) {
            console.log(`    📋 Item é array: ${JSON.stringify(item)}`);
            if (item.length >= 2) {
              // Tentar detectar qual é timestamp e qual é valor
              const primeiro = item[0];
              const segundo = item[1];
              
              // Se o primeiro for um número grande (timestamp unix em ms), é formato [timestamp, valor]
              if (typeof primeiro === 'number' && primeiro > 1000000000000) {
                dataStr = new Date(primeiro).toISOString().split('T')[0];
                valorMetrica = segundo || 0;
              }
              // Se o segundo for um número grande, é formato [valor, timestamp]
              else if (typeof segundo === 'number' && segundo > 1000000000000) {
                dataStr = new Date(segundo).toISOString().split('T')[0];
                valorMetrica = primeiro || 0;
              }
              // Se o primeiro for string de data
              else if (typeof primeiro === 'string') {
                dataStr = primeiro;
                valorMetrica = segundo || 0;
              }
            }
          } else if (typeof item === 'object' && item !== null) {
            // Formato objeto - tentar múltiplos nomes de campo para data
            const possiveisData = item.date || item.datetime || item.day || item.timestamp || item.time || item.d;
            valorMetrica = item.value ?? item.val ?? item.v ?? item.count ?? 0;
            
            if (possiveisData) {
              // Se for número (timestamp unix)
              if (typeof possiveisData === 'number') {
                // Verificar se é ms ou segundos
                const ts = possiveisData > 1000000000000 ? possiveisData : possiveisData * 1000;
                dataStr = new Date(ts).toISOString().split('T')[0];
              } else {
                dataStr = String(possiveisData);
              }
            }
          }
          
          // Se não encontrou data, logar e pular
          if (!dataStr) {
            console.log(`    ⚠️ Item sem data válida: ${JSON.stringify(item).substring(0, 150)}`);
            continue;
          }
          
          // Converter YYYYMMDD para YYYY-MM-DD se necessário
          if (dataStr.length === 8 && !dataStr.includes('-')) {
            dataStr = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
          }
          
          // Validar formato final da data (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
            console.log(`    ⚠️ Formato de data inválido após conversão: ${dataStr}`);
            continue;
          }
          
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
          metricas[metrica.campo] = valorMetrica;
          
          // Calcular novos seguidores se for métrica de seguidores
          if (metrica.campo === 'seguidores_total') {
            metricas.novos_seguidores = valorAnterior > 0 ? valorMetrica - valorAnterior : 0;
            valorAnterior = valorMetrica;
          }
        }
        
        console.log(`    ✅ ${metrica.nome}: ${data?.length || 0} registros`);
      } else {
        const errorText = await resp.text();
        console.log(`    ⚠️ ${metrica.nome}: não disponível (${resp.status}) - ${errorText}`);
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
        
        // CORREÇÃO: Formato de data YYYYMMDD (sem hífens)
        const initDate = trintaDiasAtras.toISOString().split('T')[0].replace(/-/g, '');
        const endDate = hoje.toISOString().split('T')[0].replace(/-/g, '');
        
        console.log(`  📅 Período: ${initDate} a ${endDate}`);

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
          // CORREÇÃO: URL com query parameters
          const smartlinksUrl = `${METRICOOL_API_BASE}/smartlinks/stats?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
          console.log(`  🔗 URL SmartLinks: ${smartlinksUrl}`);
          const smartlinksResp = await fetch(smartlinksUrl, { headers });
          
          if (smartlinksResp.ok) {
            const smartlinksData = await smartlinksResp.json();
            console.log(`✅ SmartLinks: ${smartlinksData?.length || 0} registros`);

            for (const smartlink of (smartlinksData || [])) {
              for (const stat of (smartlink.stats || [])) {
                // Converter data YYYYMMDD para YYYY-MM-DD se necessário
                let dataStr = stat.date;
                if (dataStr && dataStr.length === 8) {
                  dataStr = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
                }
                
                await supabase
                  .from('smartlink_cliques')
                  .upsert({
                    id_empresa: empresaId,
                    smartlink_id: smartlink.id,
                    smartlink_nome: smartlink.name,
                    smartlink_url: smartlink.url,
                    data: dataStr,
                    cliques: stat.clicks || 0,
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'id_empresa,smartlink_id,data'
                  });
              }
            }
          } else {
            const errorText = await smartlinksResp.text();
            console.log(`ℹ️ SmartLinks não disponível (${smartlinksResp.status}) - ${errorText}`);
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
