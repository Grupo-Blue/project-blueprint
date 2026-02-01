import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('[GA4] Erro ao obter access token:', JSON.stringify(data));
    
    // Detectar erro de escopo insuficiente
    if (data.error === 'invalid_grant' || data.error_description?.includes('expired')) {
      throw new Error('REFRESH_TOKEN_EXPIRED: O Refresh Token expirou. Gere um novo token no OAuth Playground.');
    }
    
    throw new Error(`Erro ao obter access token: ${data.error_description || data.error || 'Erro desconhecido'}`);
  }
  
  return data.access_token;
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
    const { id_empresa, dias = 30 } = await req.json().catch(() => ({}));

    // Buscar integração GA4
    let query = supabase.from('integracao')
      .select('*')
      .eq('tipo', 'GA4')
      .eq('ativo', true);

    if (id_empresa) {
      query = query.eq('id_empresa', id_empresa);
    }

    const { data: integracoes, error: intError } = await query;

    if (intError) throw intError;
    if (!integracoes || integracoes.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Nenhuma integração GA4 ativa encontrada' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const empresaId = integracao.id_empresa;

      try {
        // Obter access token
        const accessToken = await getAccessToken(
          config.client_id,
          config.client_secret,
          config.refresh_token
        );

        // Calcular datas
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1); // Ontem
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dias);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        // Fazer requisição ao GA4 Data API
        const gaResponse = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${config.property_id}:runReport`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dateRanges: [{
                startDate: formatDate(startDate),
                endDate: formatDate(endDate)
              }],
              dimensions: [
                { name: 'landingPage' },
                { name: 'date' }
              ],
              metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
                { name: 'conversions' },
                { name: 'screenPageViews' }
              ],
              dimensionFilter: {
                filter: {
                  fieldName: 'landingPage',
                  stringFilter: {
                    matchType: 'BEGINS_WITH',
                    value: '/'
                  }
                }
              },
              orderBys: [
                { dimension: { dimensionName: 'date' }, desc: true }
              ],
              limit: 10000
            })
          }
        );

        if (!gaResponse.ok) {
          const errorData = await gaResponse.json().catch(() => ({}));
          console.error('[GA4] Erro na API:', JSON.stringify(errorData));
          
          // Detectar erro de escopo insuficiente
          if (errorData.error?.status === 'PERMISSION_DENIED' || 
              errorData.error?.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            throw new Error('SCOPE_INSUFFICIENT: O Refresh Token não possui o escopo analytics.readonly. Gere um novo token com o escopo https://www.googleapis.com/auth/analytics.readonly no OAuth Playground.');
          }
          
          throw new Error(`GA4 API error: ${errorData.error?.message || 'Erro desconhecido'}`);
        }

        const gaData = await gaResponse.json();
        const rows = gaData.rows || [];

        console.log(`GA4: ${rows.length} linhas encontradas para empresa ${empresaId}`);

        // Processar e inserir métricas
        let insertedCount = 0;
        for (const row of rows) {
          const landingPage = row.dimensionValues[0].value;
          const dateStr = row.dimensionValues[1].value; // YYYYMMDD
          const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;

          // Construir URL completa
          const fullUrl = config.site_url 
            ? `${config.site_url.replace(/\/$/, '')}${landingPage}`
            : landingPage;

          const metricas = {
            id_empresa: empresaId,
            url: fullUrl,
            data: formattedDate,
            sessoes: parseInt(row.metricValues[0].value) || 0,
            usuarios: parseInt(row.metricValues[1].value) || 0,
            bounce_rate: parseFloat(row.metricValues[2].value) || null,
            tempo_medio_segundos: parseFloat(row.metricValues[3].value) || null,
            conversoes: parseInt(row.metricValues[4].value) || 0,
            pageviews: parseInt(row.metricValues[5].value) || 0,
            taxa_conversao: null as number | null
          };

          // Calcular taxa de conversão
          if (metricas.sessoes > 0) {
            metricas.taxa_conversao = (metricas.conversoes / metricas.sessoes) * 100;
          }

          // Upsert
          const { error: upsertError } = await supabase
            .from('landingpage_metricas')
            .upsert(metricas, { 
              onConflict: 'id_empresa,url,data',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`Erro ao inserir métrica: ${upsertError.message}`);
          } else {
            insertedCount++;
          }
        }

        resultados.push({
          empresa: empresaId,
          status: 'success',
          metricas_inseridas: insertedCount,
          linhas_processadas: rows.length
        });

      } catch (error: any) {
        console.error(`Erro ao processar GA4 para empresa ${empresaId}:`, error);
        resultados.push({
          empresa: empresaId,
          status: 'error',
          error: error.message
        });
      }
    }

    // Log de execução
    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-metricas-ga4',
      status: resultados.every(r => r.status === 'success') ? 'sucesso' : 'parcial',
      duracao_ms: duracao,
      detalhes_execucao: { resultados }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      resultados,
      duracao_ms: duracao
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro geral:', error);

    // Log de erro
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-metricas-ga4',
      status: 'erro',
      mensagem_erro: error.message,
      duracao_ms: Date.now() - startTime
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
