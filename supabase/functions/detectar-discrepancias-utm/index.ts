import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Criativo {
  id_criativo: string;
  id_campanha: string;
  id_criativo_externo: string;
  url_esperada: string | null;
  url_final: string | null;
  ativo: boolean;
  campanha: {
    url_esperada: string | null;
    nome: string;
    ativa: boolean;
  };
}

interface Discrepancia {
  id_criativo: string;
  id_campanha: string;
  tipo: string;
  url_esperada: string | null;
  url_capturada: string | null;
  detalhes: Record<string, any>;
}

function extrairUTMs(url: string): Record<string, string> {
  const utms: Record<string, string> = {};
  try {
    const urlObj = new URL(url);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
      const value = urlObj.searchParams.get(param);
      if (value) utms[param] = value;
    });
  } catch {
    // URL inválida
  }
  return utms;
}

function extrairDominio(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function temPlaceholdersNaoResolvidos(url: string): boolean {
  return /\{\{[^}]+\}\}/.test(url);
}

function isEngagementAd(urlFinal: string | null): boolean {
  if (!urlFinal) return true;
  const lower = urlFinal.toLowerCase();
  return lower.includes('facebook.com') || 
         lower.includes('instagram.com') || 
         lower.includes('fb.com') ||
         lower.includes('fb.me');
}

function detectarDiscrepancias(criativo: Criativo): Discrepancia[] {
  const discrepancias: Discrepancia[] = [];
  const urlEsperada = criativo.url_esperada || criativo.campanha?.url_esperada;
  const urlCapturada = criativo.url_final;

  // Se não tem URL esperada configurada
  if (!urlEsperada) {
    return discrepancias; // Não pode validar sem URL esperada
  }

  // Se é anúncio de engajamento (sem URL de destino), não valida
  if (isEngagementAd(urlCapturada)) {
    return discrepancias;
  }

  // Se não tem URL capturada
  if (!urlCapturada) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'SEM_URL_CAPTURADA',
      url_esperada: urlEsperada,
      url_capturada: null,
      detalhes: { mensagem: 'URL de destino não foi capturada do anúncio' }
    });
    return discrepancias;
  }

  // Verificar placeholders não resolvidos
  if (temPlaceholdersNaoResolvidos(urlCapturada)) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'PLACEHOLDERS_NAO_RESOLVIDOS',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: { mensagem: 'URL contém placeholders dinâmicos não resolvidos ({{...}})' }
    });
  }

  // Comparar domínios (landing page)
  const dominioEsperado = extrairDominio(urlEsperada);
  const dominioCapturado = extrairDominio(urlCapturada);
  
  if (dominioEsperado && dominioCapturado && dominioEsperado !== dominioCapturado) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'LANDING_PAGE_DIVERGENTE',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: {
        dominioEsperado,
        dominioCapturado,
        mensagem: `Landing page diferente: esperado "${dominioEsperado}", capturado "${dominioCapturado}"`
      }
    });
  }

  // Comparar UTMs
  const utmsEsperados = extrairUTMs(urlEsperada);
  const utmsCapturados = extrairUTMs(urlCapturada);

  // UTM_SOURCE
  if (utmsEsperados.utm_source && utmsCapturados.utm_source && 
      utmsEsperados.utm_source.toLowerCase() !== utmsCapturados.utm_source.toLowerCase()) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'UTM_SOURCE_DIVERGENTE',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: {
        esperado: utmsEsperados.utm_source,
        capturado: utmsCapturados.utm_source,
        mensagem: `utm_source divergente`
      }
    });
  }

  // UTM_MEDIUM
  if (utmsEsperados.utm_medium && utmsCapturados.utm_medium && 
      utmsEsperados.utm_medium.toLowerCase() !== utmsCapturados.utm_medium.toLowerCase()) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'UTM_MEDIUM_DIVERGENTE',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: {
        esperado: utmsEsperados.utm_medium,
        capturado: utmsCapturados.utm_medium,
        mensagem: `utm_medium divergente`
      }
    });
  }

  // UTM_CAMPAIGN
  if (utmsEsperados.utm_campaign && utmsCapturados.utm_campaign && 
      utmsEsperados.utm_campaign.toLowerCase() !== utmsCapturados.utm_campaign.toLowerCase()) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'UTM_CAMPAIGN_DIVERGENTE',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: {
        esperado: utmsEsperados.utm_campaign,
        capturado: utmsCapturados.utm_campaign,
        mensagem: `utm_campaign divergente`
      }
    });
  }

  // UTM_CONTENT - só valida se não tiver placeholders
  if (utmsEsperados.utm_content && utmsCapturados.utm_content && 
      !utmsCapturados.utm_content.includes('{{') &&
      utmsEsperados.utm_content !== utmsCapturados.utm_content) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'UTM_CONTENT_DIVERGENTE',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: {
        esperado: utmsEsperados.utm_content,
        capturado: utmsCapturados.utm_content,
        mensagem: `utm_content divergente`
      }
    });
  }

  // URL capturada sem UTMs
  if (Object.keys(utmsCapturados).length === 0 && Object.keys(utmsEsperados).length > 0) {
    discrepancias.push({
      id_criativo: criativo.id_criativo,
      id_campanha: criativo.id_campanha,
      tipo: 'SEM_UTMS_NA_URL',
      url_esperada: urlEsperada,
      url_capturada: urlCapturada,
      detalhes: { mensagem: 'URL capturada não contém parâmetros UTM' }
    });
  }

  return discrepancias;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[detectar-discrepancias-utm] Iniciando detecção...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar criativos de campanhas ativas com url_esperada (do criativo ou campanha)
    const { data: criativos, error: criativosError } = await supabase
      .from('criativo')
      .select(`
        id_criativo,
        id_campanha,
        id_criativo_externo,
        url_esperada,
        url_final,
        ativo,
        campanha!inner (
          url_esperada,
          nome,
          ativa
        )
      `)
      .eq('ativo', true)
      .eq('campanha.ativa', true);

    if (criativosError) {
      console.error('[detectar-discrepancias-utm] Erro ao buscar criativos:', criativosError);
      throw criativosError;
    }

    console.log(`[detectar-discrepancias-utm] ${criativos?.length || 0} criativos ativos encontrados`);

    const todasDiscrepancias: Discrepancia[] = [];
    const criativosComUrlEsperada = criativos?.filter(c => 
      c.url_esperada || (c.campanha as any)?.url_esperada
    ) || [];

    console.log(`[detectar-discrepancias-utm] ${criativosComUrlEsperada.length} criativos com URL esperada configurada`);

    for (const criativo of criativosComUrlEsperada) {
      const discrepancias = detectarDiscrepancias(criativo as unknown as Criativo);
      todasDiscrepancias.push(...discrepancias);
    }

    console.log(`[detectar-discrepancias-utm] ${todasDiscrepancias.length} discrepâncias detectadas`);

    // Marcar alertas antigos como resolvidos se não aparecerem mais
    const criativosComDiscrepancia = [...new Set(todasDiscrepancias.map(d => d.id_criativo))];
    
    if (criativosComUrlEsperada.length > 0) {
      // Buscar alertas ativos atuais
      const { data: alertasAtivos } = await supabase
        .from('alerta_utm')
        .select('id_alerta, id_criativo, tipo_discrepancia')
        .eq('resolvido', false);

      // Resolver alertas que não existem mais
      for (const alerta of alertasAtivos || []) {
        const aindaExiste = todasDiscrepancias.some(
          d => d.id_criativo === alerta.id_criativo && d.tipo === alerta.tipo_discrepancia
        );
        
        if (!aindaExiste) {
          await supabase
            .from('alerta_utm')
            .update({ resolvido: true, data_resolucao: new Date().toISOString() })
            .eq('id_alerta', alerta.id_alerta);
          
          console.log(`[detectar-discrepancias-utm] Alerta resolvido: ${alerta.tipo_discrepancia}`);
        }
      }
    }

    // Inserir novos alertas (upsert com constraint único)
    let novosAlertas = 0;
    for (const discrepancia of todasDiscrepancias) {
      const { error: insertError } = await supabase
        .from('alerta_utm')
        .upsert({
          id_criativo: discrepancia.id_criativo,
          id_campanha: discrepancia.id_campanha,
          tipo_discrepancia: discrepancia.tipo,
          url_esperada: discrepancia.url_esperada,
          url_capturada: discrepancia.url_capturada,
          detalhes: discrepancia.detalhes,
          resolvido: false
        }, {
          onConflict: 'id_criativo,tipo_discrepancia',
          ignoreDuplicates: true
        });

      if (!insertError) {
        novosAlertas++;
      }
    }

    // Registrar execução no cronjob_execucao
    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'detectar-discrepancias-utm',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        criativos_analisados: criativosComUrlEsperada.length,
        discrepancias_encontradas: todasDiscrepancias.length,
        novos_alertas: novosAlertas
      }
    });

    console.log(`[detectar-discrepancias-utm] Concluído em ${duracao}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        criativos_analisados: criativosComUrlEsperada.length,
        discrepancias_encontradas: todasDiscrepancias.length,
        duracao_ms: duracao
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[detectar-discrepancias-utm] Erro:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'detectar-discrepancias-utm',
      status: 'erro',
      mensagem_erro: error.message,
      duracao_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
