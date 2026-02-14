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

// Endpoints de posts por rede social
const POSTS_ENDPOINTS: Record<string, { endpoint: string; rede: string }[]> = {
  instagram: [
    { endpoint: 'stats/instagram/posts', rede: 'INSTAGRAM' },
    { endpoint: 'stats/instagram/reels', rede: 'INSTAGRAM' },
    { endpoint: 'stats/instagram/stories', rede: 'INSTAGRAM' },
  ],
  facebook: [
    { endpoint: 'stats/facebook/posts', rede: 'FACEBOOK' },
  ],
  linkedin: [
    { endpoint: 'stats/linkedin/posts', rede: 'LINKEDIN' },
  ],
  tiktok: [
    { endpoint: 'stats/tiktok/posts', rede: 'TIKTOK' },
  ],
  youtube: [
    { endpoint: 'stats/youtube/videos', rede: 'YOUTUBE' },
  ],
  twitter: [
    { endpoint: 'stats/twitter/tweets', rede: 'TWITTER' },
  ],
};

// Endpoints de demographics
const DEMOGRAPHICS_ENDPOINTS = [
  { endpoint: 'stats/gender', tipo: 'GENDER' },
  { endpoint: 'stats/age', tipo: 'AGE' },
  { endpoint: 'stats/country', tipo: 'COUNTRY' },
  { endpoint: 'stats/city', tipo: 'CITY' },
];

function parsePostData(item: any, rede: string, endpointPath: string): {
  post_id_externo: string;
  tipo: string;
  data_publicacao: string | null;
  texto: string | null;
  url_midia: string | null;
  url_post: string | null;
  likes: number;
  comentarios: number;
  compartilhamentos: number;
  salvos: number;
  alcance: number;
  impressoes: number;
  cliques_link: number;
  visitas_perfil: number;
  engajamento_total: number;
  taxa_engajamento: number;
} | null {
  try {
    // Determinar tipo baseado no endpoint
    let tipo = 'IMAGE';
    if (endpointPath.includes('reels')) tipo = 'REEL';
    else if (endpointPath.includes('stories')) tipo = 'STORY';
    else if (endpointPath.includes('videos')) tipo = 'VIDEO';
    else if (endpointPath.includes('tweets')) tipo = 'TEXT';
    else if (item.type || item.mediaType) {
      const t = (item.type || item.mediaType || '').toUpperCase();
      if (t.includes('VIDEO')) tipo = 'VIDEO';
      else if (t.includes('CAROUSEL') || t.includes('ALBUM') || t.includes('SIDECAR')) tipo = 'CAROUSEL';
      else if (t.includes('REEL')) tipo = 'REEL';
      else if (t.includes('STORY')) tipo = 'STORY';
    }

    // Extrair ID do post
    const postId = item.id || item.postId || item.post_id || item.externalId || String(Math.random());
    
    // Extrair data de publicação
    let dataPub: string | null = null;
    const rawDate = item.date || item.publishDate || item.createdTime || item.timestamp || item.created_time;
    if (rawDate) {
      if (typeof rawDate === 'number') {
        dataPub = new Date(rawDate > 1e12 ? rawDate : rawDate * 1000).toISOString();
      } else {
        dataPub = new Date(rawDate).toISOString();
      }
    }

    // Extrair URL de mídia (crucial para previews)
    const urlMidia = item.image || item.imageUrl || item.thumbnailUrl || item.thumbnail || 
                     item.mediaUrl || item.media_url || item.picture || item.fullPicture || 
                     item.videoThumbnail || item.cover || null;

    // Extrair URL do post original
    const urlPost = item.link || item.url || item.permalink || item.postUrl || null;

    // Extrair texto/legenda
    const texto = item.text || item.caption || item.message || item.description || item.title || null;

    // Extrair métricas
    const likes = item.likes || item.likeCount || item.reactions || item.favoriteCount || 0;
    const comentarios = item.comments || item.commentCount || item.replies || 0;
    const compartilhamentos = item.shares || item.shareCount || item.retweets || item.reposts || 0;
    const salvos = item.saved || item.savedCount || item.bookmarks || 0;
    const alcance = item.reach || item.reachCount || 0;
    const impressoes = item.impressions || item.impressionCount || item.views || item.viewCount || 0;
    const cliquesLink = item.clicks || item.linkClicks || item.urlClicks || 0;
    const visitasPerfil = item.profileVisits || item.profileViews || 0;
    const engajamentoTotal = likes + comentarios + compartilhamentos + salvos;
    const taxaEngajamento = item.engagementRate || item.engagement_rate || 
      (alcance > 0 ? (engajamentoTotal / alcance) * 100 : 0);

    return {
      post_id_externo: String(postId),
      tipo,
      data_publicacao: dataPub,
      texto: texto ? String(texto).substring(0, 5000) : null,
      url_midia: urlMidia,
      url_post: urlPost,
      likes,
      comentarios,
      compartilhamentos,
      salvos,
      alcance,
      impressoes,
      cliques_link: cliquesLink,
      visitas_perfil: visitasPerfil,
      engajamento_total: engajamentoTotal,
      taxa_engajamento: Math.min(taxaEngajamento, 100),
    };
  } catch (e) {
    console.error(`  ⚠️ Erro ao parsear post:`, e);
    return null;
  }
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
    console.log("🚀 Iniciando coleta de conteúdo Metricool (Posts + Demographics + Competitors)...");

    // Buscar integrações Metricool ativas
    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'METRICOOL')
      .eq('ativo', true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
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
      const empresaId = integracao.id_empresa;

      console.log(`\n📊 Processando empresa ${empresaId}...`);

      try {
        // Período: últimos 90 dias para posts
        const hoje = new Date();
        const noventaDiasAtras = new Date();
        noventaDiasAtras.setDate(hoje.getDate() - 90);
        const initDate = noventaDiasAtras.toISOString().split('T')[0].replace(/-/g, '');
        const endDate = hoje.toISOString().split('T')[0].replace(/-/g, '');

        const headers = {
          'X-Mc-Auth': config.user_token,
          'Content-Type': 'application/json',
        };

        let totalPostsSalvos = 0;
        let totalDemographics = 0;
        const redesComPosts: string[] = [];

        // ========== FASE 1: Posts Orgânicos ==========
        console.log("\n📝 FASE 1: Coletando posts orgânicos...");

        for (const [plataforma, endpoints] of Object.entries(POSTS_ENDPOINTS)) {
          for (const { endpoint, rede } of endpoints) {
            try {
              const url = `${METRICOOL_API_BASE}/${endpoint}?blogId=${config.blog_id}&userId=${config.user_id}&start=${initDate}&end=${endDate}`;
              console.log(`  🔗 ${rede} (${endpoint})...`);
              
              const resp = await fetch(url, { headers });

              if (!resp.ok) {
                console.log(`  ⚠️ ${endpoint}: ${resp.status}`);
                continue;
              }

              const data = await resp.json();
              const posts = Array.isArray(data) ? data : (data.posts || data.data || data.items || []);

              if (posts.length > 0) {
                console.log(`  📋 ${endpoint}: ${posts.length} posts encontrados`);
                // Log first post structure for debugging
                console.log(`  📋 Estrutura primeiro post: ${JSON.stringify(posts[0]).substring(0, 300)}`);
              }

              for (const item of posts) {
                const parsed = parsePostData(item, rede, endpoint);
                if (!parsed) continue;

                const { error: upsertError } = await supabase
                  .from('social_posts')
                  .upsert({
                    id_empresa: empresaId,
                    rede_social: rede,
                    ...parsed,
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'id_empresa,rede_social,post_id_externo'
                  });

                if (upsertError) {
                  console.error(`  ⚠️ Erro upsert post: ${upsertError.message}`);
                } else {
                  totalPostsSalvos++;
                }
              }

              if (posts.length > 0 && !redesComPosts.includes(rede)) {
                redesComPosts.push(rede);
              }
            } catch (endpointError) {
              console.error(`  ❌ Erro ${endpoint}:`, endpointError);
            }
          }
        }

        console.log(`  ✅ Total posts salvos: ${totalPostsSalvos}`);

        // ========== FASE 2: Demographics ==========
        console.log("\n👥 FASE 2: Coletando demographics...");
        const dataColeta = hoje.toISOString().split('T')[0];

        for (const { endpoint, tipo } of DEMOGRAPHICS_ENDPOINTS) {
          try {
            const url = `${METRICOOL_API_BASE}/${endpoint}?blogId=${config.blog_id}&userId=${config.user_id}`;
            console.log(`  🔗 ${tipo}...`);

            const resp = await fetch(url, { headers });

            if (!resp.ok) {
              console.log(`  ⚠️ ${tipo}: ${resp.status}`);
              continue;
            }

            const data = await resp.json();
            
            // API pode retornar dados por rede ou dados agregados
            // Tentar processar em múltiplos formatos
            const processarDemographics = (items: any[], redeSocial: string) => {
              for (const item of items) {
                const label = item.label || item.name || item.key || item.value || String(item);
                const valor = item.value || item.count || item.total || 0;
                const percentual = item.percentage || item.percent || item.pct || 0;

                if (!label) continue;

                supabase
                  .from('social_audiencia_demografica')
                  .upsert({
                    id_empresa: empresaId,
                    rede_social: redeSocial,
                    data_coleta: dataColeta,
                    tipo,
                    label: String(label),
                    valor: typeof valor === 'number' ? valor : parseFloat(valor) || 0,
                    percentual: typeof percentual === 'number' ? percentual : parseFloat(percentual) || 0,
                  }, {
                    onConflict: 'id_empresa,rede_social,data_coleta,tipo,label'
                  })
                  .then(({ error }) => {
                    if (error) console.error(`  ⚠️ Erro upsert demographic: ${error.message}`);
                    else totalDemographics++;
                  });
              }
            };

            if (Array.isArray(data)) {
              // Array direto - assumir Instagram como padrão
              processarDemographics(data, 'INSTAGRAM');
            } else if (typeof data === 'object') {
              // Objeto com redes como chaves
              for (const [key, value] of Object.entries(data)) {
                const rede = key.toUpperCase();
                if (Array.isArray(value)) {
                  processarDemographics(value, rede);
                } else if (typeof value === 'object' && value !== null) {
                  // Pode ser { male: 45, female: 55 } etc.
                  const items = Object.entries(value).map(([k, v]) => ({
                    label: k,
                    value: v,
                    percentage: 0,
                  }));
                  processarDemographics(items, rede);
                }
              }
            }

            console.log(`  ✅ ${tipo}: dados processados`);
          } catch (demoError) {
            console.error(`  ❌ Erro ${tipo}:`, demoError);
          }
        }

        // ========== FASE 3: Competitors ==========
        console.log("\n🏆 FASE 3: Coletando dados de concorrentes...");
        
        try {
          const competitorsUrl = `${METRICOOL_API_BASE}/competitors?blogId=${config.blog_id}&userId=${config.user_id}`;
          const competitorsResp = await fetch(competitorsUrl, { headers });

          if (competitorsResp.ok) {
            const competitorsData = await competitorsResp.json();
            const competitors = Array.isArray(competitorsData) ? competitorsData : 
              (competitorsData.competitors || competitorsData.data || []);

            console.log(`  📋 ${competitors.length} concorrentes encontrados`);

            for (const comp of competitors) {
              const nome = comp.name || comp.username || comp.handle || 'Unknown';
              const username = comp.username || comp.handle || comp.screenName || null;
              const rede = (comp.network || comp.platform || comp.socialNetwork || 'INSTAGRAM').toUpperCase();

              const { error } = await supabase
                .from('social_concorrentes_metricool')
                .upsert({
                  id_empresa: empresaId,
                  rede_social: rede,
                  nome_concorrente: nome,
                  username_concorrente: username,
                  data: dataColeta,
                  seguidores: comp.followers || comp.followerCount || 0,
                  posts_total: comp.posts || comp.postCount || comp.totalPosts || 0,
                  engajamento_medio: comp.engagement || comp.engagementRate || comp.avgEngagement || 0,
                }, {
                  onConflict: 'id_empresa,rede_social,nome_concorrente,data'
                });

              if (error) {
                console.error(`  ⚠️ Erro upsert concorrente: ${error.message}`);
              }
            }

            console.log(`  ✅ Concorrentes processados`);
          } else {
            console.log(`  ⚠️ Competitors: ${competitorsResp.status}`);
          }
        } catch (compError) {
          console.error(`  ❌ Erro competitors:`, compError);
        }

        resultados.push({
          empresa_id: empresaId,
          status: "success",
          posts_salvos: totalPostsSalvos,
          redes_com_posts: redesComPosts,
          demographics_salvos: totalDemographics,
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
      nome_cronjob: 'coletar-conteudo-metricool',
      status: temErro ? 'error' : 'success',
      duracao_ms: duracao,
      mensagem_erro: temErro ? resultados.find(r => r.status === "error")?.error : null,
      detalhes_execucao: { resultados },
    });

    console.log(`\n✅ Coleta de conteúdo Metricool concluída em ${duracao}ms`);

    return new Response(JSON.stringify({
      message: "Coleta de conteúdo Metricool concluída",
      duracao_ms: duracao,
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);
    
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'coletar-conteudo-metricool',
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
