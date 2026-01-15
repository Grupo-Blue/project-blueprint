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

interface AdsCampaignData {
  campaignId: string;
  campaignName: string;
  data: string;
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  conversionValue: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
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
    console.log("🚀 Iniciando enriquecimento de campanhas via Metricool...");

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
        
        // Formato de data YYYYMMDD (sem hífens)
        const initDate = trintaDiasAtras.toISOString().split('T')[0].replace(/-/g, '');
        const endDate = hoje.toISOString().split('T')[0].replace(/-/g, '');
        
        console.log(`  📅 Período: ${initDate} a ${endDate}`);

        // Headers de autenticação Metricool
        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        // Buscar dados de Google Ads do Metricool
        console.log("  🔍 Buscando dados Google Ads do Metricool...");
        
        // Endpoint para Google Ads campaigns
        const googleAdsUrl = `${METRICOOL_API_BASE}/ads/google/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
        console.log(`  🔗 URL: ${googleAdsUrl}`);
        
        const googleAdsResp = await fetch(googleAdsUrl, { headers });
        
        if (!googleAdsResp.ok) {
          const errorText = await googleAdsResp.text();
          console.log(`  ⚠️ Google Ads não disponível (${googleAdsResp.status}): ${errorText}`);
          
          // Tentar endpoint alternativo
          const altUrl = `${METRICOOL_API_BASE}/ads/campaigns?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}&network=google`;
          console.log(`  🔗 Tentando URL alternativa: ${altUrl}`);
          
          const altResp = await fetch(altUrl, { headers });
          if (!altResp.ok) {
            console.log(`  ⚠️ Endpoint alternativo também falhou (${altResp.status})`);
            resultados.push({
              empresa_id: empresaId,
              status: "no_google_ads_data",
              message: "Dados de Google Ads não disponíveis no Metricool"
            });
            continue;
          }
        }

        const adsData = await googleAdsResp.json();
        console.log(`  ✅ Dados recebidos: ${JSON.stringify(adsData).substring(0, 500)}...`);

        // Processar campanhas do Google Ads
        const campanhasMetricool: AdsCampaignData[] = [];
        
        // A API pode retornar diferentes formatos
        const campaigns = Array.isArray(adsData) ? adsData : adsData.campaigns || adsData.data || [];
        
        for (const campaign of campaigns) {
          // Processar dados por data
          const stats = campaign.stats || campaign.metrics || [campaign];
          
          for (const stat of (Array.isArray(stats) ? stats : [stats])) {
            let dataStr = stat.date || stat.day || stat.datetime;
            
            // Converter YYYYMMDD para YYYY-MM-DD
            if (dataStr && dataStr.length === 8 && !dataStr.includes('-')) {
              dataStr = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
            }
            
            if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
              continue;
            }

            campanhasMetricool.push({
              campaignId: campaign.id || campaign.campaignId || campaign.campaign_id || '',
              campaignName: campaign.name || campaign.campaignName || campaign.campaign_name || '',
              data: dataStr,
              impressions: parseInt(stat.impressions || stat.reach || '0'),
              clicks: parseInt(stat.clicks || '0'),
              spent: parseFloat(stat.spent || stat.cost || stat.spend || '0'),
              conversions: parseInt(stat.conversions || stat.results || '0'),
              conversionValue: parseFloat(stat.conversionValue || stat.conversion_value || stat.revenue || '0'),
              cpc: parseFloat(stat.cpc || '0'),
              cpm: parseFloat(stat.cpm || '0'),
              ctr: parseFloat(stat.ctr || '0'),
              roas: parseFloat(stat.roas || '0'),
            });
          }
        }

        console.log(`  📊 Campanhas encontradas no Metricool: ${campanhasMetricool.length}`);

        if (campanhasMetricool.length === 0) {
          // Tentar buscar métricas agregadas por timeline
          console.log("  🔄 Tentando buscar métricas timeline de Google Ads...");
          
          const metricsToFetch = [
            { nome: 'googleAdsConversions', campo: 'conversions' },
            { nome: 'googleAdsConversionValue', campo: 'conversionValue' },
            { nome: 'googleAdsSpent', campo: 'spent' },
            { nome: 'googleAdsClicks', campo: 'clicks' },
            { nome: 'googleAdsImpressions', campo: 'impressions' },
          ];

          const metricasPorData = new Map<string, Record<string, number>>();

          for (const metrica of metricsToFetch) {
            try {
              const url = `${METRICOOL_API_BASE}/stats/timeline/${metrica.nome}?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
              const resp = await fetch(url, { headers });
              
              if (resp.ok) {
                const data = await resp.json();
                console.log(`    ✅ ${metrica.nome}: ${data?.length || 0} registros`);
                
                for (const item of (data || [])) {
                  let dataStr: string | null = null;
                  let valor: number = 0;
                  
                  if (Array.isArray(item) && item.length >= 2) {
                    const primeiroStr = String(item[0]);
                    const segundoStr = String(item[1]);
                    const primeiroNum = parseFloat(primeiroStr);
                    
                    if (primeiroStr.length >= 13 && primeiroNum > 1000000000000) {
                      dataStr = new Date(primeiroNum).toISOString().split('T')[0];
                      valor = parseFloat(segundoStr) || 0;
                    } else if (primeiroStr.length === 8 && /^\d{8}$/.test(primeiroStr)) {
                      dataStr = `${primeiroStr.substring(0, 4)}-${primeiroStr.substring(4, 6)}-${primeiroStr.substring(6, 8)}`;
                      valor = parseFloat(segundoStr) || 0;
                    }
                  }
                  
                  if (dataStr) {
                    if (!metricasPorData.has(dataStr)) {
                      metricasPorData.set(dataStr, {
                        conversions: 0,
                        conversionValue: 0,
                        spent: 0,
                        clicks: 0,
                        impressions: 0,
                      });
                    }
                    metricasPorData.get(dataStr)![metrica.campo] = valor;
                  }
                }
              }
            } catch (err) {
              console.log(`    ⚠️ Erro ao buscar ${metrica.nome}:`, err);
            }
          }

          // Converter para formato de campanhas (agregado por empresa, não por campanha)
          if (metricasPorData.size > 0) {
            console.log(`  📊 Métricas agregadas encontradas para ${metricasPorData.size} dias`);
            
            // Buscar campanhas Google da empresa para enriquecer
            const { data: contasGoogle } = await supabase
              .from('conta_anuncio')
              .select('id_conta')
              .eq('id_empresa', empresaId)
              .eq('plataforma', 'GOOGLE');
              
            if (contasGoogle && contasGoogle.length > 0) {
              const { data: campanhasGoogle } = await supabase
                .from('campanha')
                .select('id_campanha, nome')
                .in('id_conta', contasGoogle.map(c => c.id_conta))
                .eq('ativa', true);
                
              if (campanhasGoogle && campanhasGoogle.length > 0) {
                // Para métricas agregadas, distribuir proporcionalmente ou aplicar à primeira campanha
                // Por simplicidade, vamos somar tudo em empresa_metricas_dia ao invés de campanha
                console.log(`  📊 ${campanhasGoogle.length} campanhas Google para enriquecer`);
                
                // Salvar métricas agregadas por empresa
                let metricasSalvas = 0;
                for (const [data, metricas] of metricasPorData) {
                  if (metricas.conversions > 0 || metricas.conversionValue > 0) {
                    // Atualizar empresa_metricas_dia com conversões do Metricool
                    const { error } = await supabase
                      .from('empresa_metricas_dia')
                      .upsert({
                        id_empresa: empresaId,
                        data,
                        // Manter métricas existentes, adicionar conversões
                        vendas: metricas.conversions,
                        valor_vendas: metricas.conversionValue,
                        updated_at: new Date().toISOString(),
                      }, {
                        onConflict: 'id_empresa,data',
                      });
                      
                    if (!error) metricasSalvas++;
                  }
                }
                
                resultados.push({
                  empresa_id: empresaId,
                  status: "success",
                  metricas_agregadas: metricasSalvas,
                  tipo: "empresa_metricas",
                });
              }
            }
          }
          
          continue;
        }

        // Se temos dados por campanha, tentar fazer match com nossas campanhas
        const { data: contasGoogle } = await supabase
          .from('conta_anuncio')
          .select('id_conta')
          .eq('id_empresa', empresaId)
          .eq('plataforma', 'GOOGLE');

        if (!contasGoogle || contasGoogle.length === 0) {
          console.log("  ⚠️ Nenhuma conta Google Ads configurada para esta empresa");
          resultados.push({
            empresa_id: empresaId,
            status: "no_google_account",
          });
          continue;
        }

        const { data: campanhasLocais } = await supabase
          .from('campanha')
          .select('id_campanha, id_campanha_externo, nome')
          .in('id_conta', contasGoogle.map(c => c.id_conta));

        if (!campanhasLocais || campanhasLocais.length === 0) {
          console.log("  ⚠️ Nenhuma campanha local encontrada");
          resultados.push({
            empresa_id: empresaId,
            status: "no_campaigns",
          });
          continue;
        }

        console.log(`  📋 ${campanhasLocais.length} campanhas locais para fazer match`);

        // Match e enriquecimento
        let metricasAtualizadas = 0;

        for (const metricoolCamp of campanhasMetricool) {
          // Tentar encontrar campanha local pelo ID externo ou nome
          const campanhaLocal = campanhasLocais.find(c => 
            c.id_campanha_externo === metricoolCamp.campaignId ||
            c.nome?.toLowerCase().trim() === metricoolCamp.campaignName?.toLowerCase().trim()
          );

          if (campanhaLocal && (metricoolCamp.conversions > 0 || metricoolCamp.conversionValue > 0)) {
            // Atualizar métricas com dados do Metricool
            const { error } = await supabase
              .from('campanha_metricas_dia')
              .upsert({
                id_campanha: campanhaLocal.id_campanha,
                data: metricoolCamp.data,
                impressoes: metricoolCamp.impressions,
                cliques: metricoolCamp.clicks,
                verba_investida: metricoolCamp.spent,
                leads: metricoolCamp.conversions, // Usar conversions como leads se não tiver
                conversoes: metricoolCamp.conversions,
                valor_conversao: metricoolCamp.conversionValue,
                fonte_conversoes: 'METRICOOL',
              }, {
                onConflict: 'id_campanha,data',
              });

            if (!error) {
              metricasAtualizadas++;
              console.log(`    ✅ Atualizada: ${metricoolCamp.campaignName} - ${metricoolCamp.data}: ${metricoolCamp.conversions} conversões`);
            } else {
              console.log(`    ⚠️ Erro ao atualizar ${metricoolCamp.campaignName}:`, error.message);
            }
          }
        }

        console.log(`  ✅ ${metricasAtualizadas} métricas atualizadas`);

        resultados.push({
          empresa_id: empresaId,
          status: "success",
          campanhas_metricool: campanhasMetricool.length,
          campanhas_locais: campanhasLocais.length,
          metricas_atualizadas: metricasAtualizadas,
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
      nome_cronjob: 'enriquecer-campanhas-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find(r => r.status === "error")?.error : null,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Enriquecimento concluído em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Enriquecimento de campanhas concluído",
      duracao_ms: duracao,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'enriquecer-campanhas-metricool',
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
