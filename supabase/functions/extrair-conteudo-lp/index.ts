import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extrair texto limpo do HTML
function extractText(html: string, selector: string): string | null {
  const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    // Remover tags internas e limpar
    const text = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) matches.push(text);
  }
  return matches.length > 0 ? matches[0] : null;
}

function extractAllTexts(html: string, selector: string): string[] {
  const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && text.length > 2) results.push(text);
  }
  return results;
}

function extractCTAs(html: string): string[] {
  const ctas: string[] = [];
  
  // Buttons
  const buttonRegex = /<button[^>]*>([^<]+)<\/button>/gi;
  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 2) ctas.push(text);
  }

  // Links com classes de botão
  const linkBtnRegex = /<a[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([^<]+)<\/a>/gi;
  while ((match = linkBtnRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 2) ctas.push(text);
  }

  // Input submit
  const submitRegex = /<input[^>]*type="submit"[^>]*value="([^"]+)"[^>]*>/gi;
  while ((match = submitRegex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 2) ctas.push(text);
  }

  return [...new Set(ctas)];
}

function extractMetaDescription(html: string): string | null {
  const regex = /<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i;
  const match = regex.exec(html);
  return match ? match[1].trim() : null;
}

function extractFirstParagraph(html: string): string | null {
  // Buscar primeiro parágrafo significativo
  const paragraphs = extractAllTexts(html, 'p');
  for (const p of paragraphs) {
    if (p.length > 50) return p;
  }
  return paragraphs[0] || null;
}

// Mapeamento de domínios por empresa
const getDomainByEmpresa = (empresaId: string): string => {
  const domains: Record<string, string> = {
    '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db': 'https://blueconsult.com.br',
    '61b5ffeb-fbbc-47c1-8ced-152bb647ed20': 'https://tokeniza.com.br',
  };
  return domains[empresaId] || '';
};

const getFullUrl = (url: string, idEmpresa: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const domain = getDomainByEmpresa(idEmpresa);
  if (domain) {
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { id_empresa, urls } = await req.json();

    if (!id_empresa) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'id_empresa é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se não passar URLs, buscar das métricas
    let urlsToProcess = urls;
    if (!urlsToProcess || urlsToProcess.length === 0) {
      const { data: metricas } = await supabase
        .from('landingpage_metricas')
        .select('url')
        .eq('id_empresa', id_empresa)
        .order('sessoes', { ascending: false })
        .limit(50);

      urlsToProcess = [...new Set(metricas?.map(m => m.url) || [])];
    }

    if (urlsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Nenhuma URL encontrada para processar' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processando ${urlsToProcess.length} URLs para empresa ${id_empresa}`);

    const resultados = [];

    for (const url of urlsToProcess) {
      try {
        // Construir URL completa
        const fullUrl = getFullUrl(url, id_empresa);
        console.log(`Fetching: ${fullUrl}`);
        
        // Fetch da página
        const response = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SGT-Bot/1.0)'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Extrair conteúdo
        const conteudo = {
          id_empresa,
          url,
          titulo_h1: extractText(html, 'h1'),
          subtitulos_h2: extractAllTexts(html, 'h2').slice(0, 10),
          ctas: extractCTAs(html).slice(0, 10),
          primeiro_paragrafo: extractFirstParagraph(html),
          meta_description: extractMetaDescription(html),
          palavras_chave: [] as string[],
          ultima_extracao: new Date().toISOString()
        };

        // Extrair palavras-chave do meta keywords se existir
        const keywordsMatch = /<meta[^>]*name="keywords"[^>]*content="([^"]+)"[^>]*>/i.exec(html);
        if (keywordsMatch) {
          conteudo.palavras_chave = keywordsMatch[1].split(',').map(k => k.trim()).filter(Boolean);
        }

        // Upsert
        const { error: upsertError } = await supabase
          .from('landingpage_conteudo')
          .upsert(conteudo, { 
            onConflict: 'id_empresa,url',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          throw upsertError;
        }

        resultados.push({
          url,
          status: 'success',
          h1: conteudo.titulo_h1,
          h2_count: conteudo.subtitulos_h2.length,
          ctas_count: conteudo.ctas.length
        });

        console.log(`✓ Extraído: ${url}`);

      } catch (error: any) {
        console.error(`Erro ao processar ${url}:`, error.message);
        resultados.push({
          url,
          status: 'error',
          error: error.message
        });
      }

      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processadas: resultados.filter(r => r.status === 'success').length,
      erros: resultados.filter(r => r.status === 'error').length,
      resultados
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
