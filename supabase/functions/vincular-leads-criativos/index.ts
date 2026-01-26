import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "vincular-leads-criativos";

  try {
    console.log("🔗 Iniciando vinculação retroativa de leads a criativos...");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os criativos com id_anuncio_externo ou id_criativo_externo
    const { data: criativos, error: criativosError } = await supabase
      .from('criativo')
      .select('id_criativo, id_anuncio_externo, id_criativo_externo, descricao');

    if (criativosError) {
      throw new Error(`Erro ao buscar criativos: ${criativosError.message}`);
    }

    console.log(`📦 ${criativos?.length || 0} criativos encontrados`);

    // Criar mapa de IDs externos para id_criativo
    const mapaIds: Record<string, string> = {};
    const mapaDescricao: Record<string, string> = {};

    for (const criativo of criativos || []) {
      // Mapear por id_anuncio_externo (Ad ID)
      if (criativo.id_anuncio_externo) {
        mapaIds[criativo.id_anuncio_externo] = criativo.id_criativo;
      }
      // Mapear por id_criativo_externo (Creative ID)
      if (criativo.id_criativo_externo) {
        mapaIds[criativo.id_criativo_externo] = criativo.id_criativo;
      }
      // Mapear por descrição (para match fuzzy)
      if (criativo.descricao) {
        mapaDescricao[criativo.descricao.toLowerCase().trim()] = criativo.id_criativo;
      }
    }

    console.log(`🗺️ ${Object.keys(mapaIds).length} IDs externos mapeados`);
    console.log(`📝 ${Object.keys(mapaDescricao).length} descrições mapeadas`);

    // Buscar leads com utm_content que não têm id_criativo vinculado
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, utm_content')
      .is('id_criativo', null)
      .not('utm_content', 'is', null)
      .neq('utm_content', '');

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    console.log(`🎯 ${leads?.length || 0} leads sem criativo vinculado com utm_content`);

    let vinculados = 0;
    let vinculadosPorId = 0;
    let vinculadosPorDescricao = 0;
    const erros: string[] = [];

    // Contadores para alertas de placeholders
    const placeholdersNaoResolvidos: { lead_id: string; utm_content: string }[] = [];

    for (const lead of leads || []) {
      const utmContent = lead.utm_content?.trim();
      if (!utmContent) continue;

      // Detectar placeholders não resolvidos e criar alertas
      if (utmContent.includes('{{') && utmContent.includes('}}')) {
        placeholdersNaoResolvidos.push({ lead_id: lead.id_lead, utm_content: utmContent });
        console.log(`⚠️ Lead ${lead.id_lead} tem placeholder não resolvido: ${utmContent}`);
        continue;
      }

      let idCriativoMatch: string | null = null;
      let tipoMatch = '';

      // Extrair ID numérico do utm_content
      // Suporta múltiplos formatos:
      // - "texto_123456789012345" (Meta Ads - ID no final)
      // - "123456789012_texto" (Google Ads - ID no início)
      let utmContentParaMatch = utmContent;
      
      // Primeiro: tentar extrair ID do FINAL (formato "texto_123456789012345")
      const matchFinal = utmContent.match(/_(\d{12,20})$/);
      if (matchFinal) {
        utmContentParaMatch = matchFinal[1];
        console.log(`[utm_content] ID no final: "${utmContent}" → "${utmContentParaMatch}"`);
      }
      // Segundo: tentar extrair ID do INÍCIO (formato "123_texto")
      else if (utmContent.includes('_')) {
        const partes = utmContent.split('_');
        if (/^\d{12,20}$/.test(partes[0])) {
          utmContentParaMatch = partes[0];
          console.log(`[utm_content] ID no início: "${utmContent}" → "${utmContentParaMatch}"`);
        }
      }

      // Tentar match direto por ID (numérico ou UUID)
      if (mapaIds[utmContentParaMatch]) {
        idCriativoMatch = mapaIds[utmContentParaMatch];
        tipoMatch = 'id_direto';
        vinculadosPorId++;
      } else if (utmContentParaMatch !== utmContent && mapaIds[utmContent]) {
        // Fallback: tentar com utm_content original
        idCriativoMatch = mapaIds[utmContent];
        tipoMatch = 'id_direto';
        vinculadosPorId++;
      }

      // Se não encontrou, tentar match por descrição (fuzzy)
      if (!idCriativoMatch) {
        const utmLower = utmContent.toLowerCase().trim();
        
        // Match exato de descrição
        if (mapaDescricao[utmLower]) {
          idCriativoMatch = mapaDescricao[utmLower];
          tipoMatch = 'descricao_exata';
          vinculadosPorDescricao++;
        } else {
          // Match parcial - se utm_content contém parte significativa da descrição
          for (const [descricao, idCriativo] of Object.entries(mapaDescricao)) {
            // Se a descrição contém o utm_content ou vice-versa (mínimo 10 chars)
            if (descricao.length >= 10 && utmLower.length >= 10) {
              if (descricao.includes(utmLower) || utmLower.includes(descricao)) {
                idCriativoMatch = idCriativo;
                tipoMatch = 'descricao_parcial';
                vinculadosPorDescricao++;
                break;
              }
            }
          }
        }
      }

      // Atualizar lead se encontrou match
      if (idCriativoMatch) {
        const { error: updateError } = await supabase
          .from('lead')
          .update({ id_criativo: idCriativoMatch })
          .eq('id_lead', lead.id_lead);

        if (updateError) {
          erros.push(`Lead ${lead.id_lead}: ${updateError.message}`);
        } else {
          vinculados++;
          console.log(`✅ Lead ${lead.id_lead} vinculado ao criativo ${idCriativoMatch} (${tipoMatch})`);
        }
      }
    }

    // Criar alertas para placeholders não resolvidos (agrupa por utm_content único)
    const placeholdersPorUtm: Record<string, string[]> = {};
    for (const p of placeholdersNaoResolvidos) {
      if (!placeholdersPorUtm[p.utm_content]) {
        placeholdersPorUtm[p.utm_content] = [];
      }
      placeholdersPorUtm[p.utm_content].push(p.lead_id);
    }

    for (const [utmPlaceholder, leadIds] of Object.entries(placeholdersPorUtm)) {
      // Verificar se já existe alerta não resolvido para este placeholder
      const { data: alertaExistente } = await supabase
        .from('alerta_utm')
        .select('id_alerta')
        .eq('tipo_discrepancia', 'placeholder_nao_resolvido')
        .eq('url_capturada', utmPlaceholder)
        .eq('resolvido', false)
        .maybeSingle();

      if (!alertaExistente) {
        // Buscar uma campanha para associar o alerta (necessário pela FK)
        const { data: primeiraCampanha } = await supabase
          .from('campanha')
          .select('id_campanha')
          .limit(1)
          .single();

        const { data: primeiroCriativo } = await supabase
          .from('criativo')
          .select('id_criativo')
          .limit(1)
          .single();

        if (primeiraCampanha && primeiroCriativo) {
          await supabase.from('alerta_utm').insert({
            id_campanha: primeiraCampanha.id_campanha,
            id_criativo: primeiroCriativo.id_criativo,
            tipo_discrepancia: 'placeholder_nao_resolvido',
            url_capturada: utmPlaceholder,
            url_esperada: 'ID numérico do anúncio (ex: 120233985273260284)',
            detalhes: { leads_afetados: leadIds.length, sample_leads: leadIds.slice(0, 5) },
            resolvido: false,
          });
          console.log(`🚨 Alerta criado para placeholder: ${utmPlaceholder} (${leadIds.length} leads afetados)`);
        }
      }
    }

    const duracao = Date.now() - startTime;

    // Registrar execução do cronjob
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: nomeCronjob,
      status: erros.length > 0 ? 'parcial' : 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        leads_analisados: leads?.length || 0,
        vinculados_total: vinculados,
        vinculados_por_id: vinculadosPorId,
        vinculados_por_descricao: vinculadosPorDescricao,
        erros: erros.slice(0, 10)
      }
    });

    console.log(`\n📊 RESUMO:`);
    console.log(`   Leads analisados: ${leads?.length || 0}`);
    console.log(`   Vinculados total: ${vinculados}`);
    console.log(`   - Por ID: ${vinculadosPorId}`);
    console.log(`   - Por descrição: ${vinculadosPorDescricao}`);
    console.log(`   Erros: ${erros.length}`);
    console.log(`   Duração: ${duracao}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${vinculados} leads vinculados a criativos`,
        detalhes: {
          leads_analisados: leads?.length || 0,
          vinculados_total: vinculados,
          vinculados_por_id: vinculadosPorId,
          vinculados_por_descricao: vinculadosPorDescricao,
          erros: erros.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na vinculação:', error);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: nomeCronjob,
      status: 'erro',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: errorMessage
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
