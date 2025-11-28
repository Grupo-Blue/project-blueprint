import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MauticContact {
  id: string;
  fields?: {
    all?: {
      email?: string;
      city?: string;
      state?: string;
      [key: string]: any;
    };
  };
  points?: number;
  lastActive?: string;
  dateIdentified?: string;
  tags?: Array<{ tag: string }>;
  utmtags?: Array<{
    utm_campaign?: string;
    utm_content?: string;
    utm_medium?: string;
    utm_source?: string;
    utm_term?: string;
  }>;
  doNotContact?: Array<any>;
}

interface MauticApiResponse {
  total?: number;
  contacts?: {
    [id: string]: MauticContact;
  };
}

interface EnrichedLeadData {
  id_mautic_contact: string | null;
  mautic_score: number | null;
  mautic_page_hits: number | null;
  mautic_last_active: string | null;
  mautic_first_visit: string | null;
  mautic_tags: any[] | null;
  mautic_segments: any[] | null;
  cidade_mautic: string | null;
  estado_mautic: string | null;
  utm_source_mautic: string | null;
  utm_medium_mautic: string | null;
  utm_campaign_mautic: string | null;
  utm_content_mautic: string | null;
  utm_term_mautic: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, id_empresa } = await req.json();

    if (!email || !id_empresa) {
      throw new Error('Email e id_empresa são obrigatórios');
    }

    console.log(`[Mautic] Enriquecendo lead com email: ${email} para empresa: ${id_empresa}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar integração Mautic ativa para a empresa
    const { data: integracoes, error: integracaoError } = await supabase
      .from('integracao')
      .select('config_json')
      .eq('tipo', 'MAUTIC')
      .eq('ativo', true);

    if (integracaoError) {
      throw new Error(`Erro ao buscar integração Mautic: ${integracaoError.message}`);
    }

    if (!integracoes || integracoes.length === 0) {
      console.log('[Mautic] Nenhuma integração Mautic ativa encontrada');
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhuma integração Mautic ativa encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Filtrar integração pela empresa
    const integracaoEmpresa = integracoes.find(i => i.config_json.id_empresa === id_empresa);

    if (!integracaoEmpresa) {
      console.log(`[Mautic] Nenhuma integração Mautic ativa encontrada para empresa ${id_empresa}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhuma integração Mautic configurada para esta empresa' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const config = integracaoEmpresa.config_json;
    const { url_base, login, senha } = config;

    if (!url_base || !login || !senha) {
      throw new Error('Configuração Mautic incompleta (url_base, login ou senha faltando)');
    }

    // Normalizar URL base (remover barra final se existir)
    const normalizedBaseUrl = url_base.endsWith('/') ? url_base.slice(0, -1) : url_base;

    // Fazer requisição à API do Mautic
    const mauticUrl = `${normalizedBaseUrl}/api/contacts?search=email:${encodeURIComponent(email)}`;
    console.log(`[Mautic] Buscando contato em: ${mauticUrl}`);

    const basicAuth = btoa(`${login}:${senha}`);
    const mauticResponse = await fetch(mauticUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!mauticResponse.ok) {
      const errorText = await mauticResponse.text();
      throw new Error(`Erro na API Mautic: ${mauticResponse.status} - ${errorText}`);
    }

    const mauticData: MauticApiResponse = await mauticResponse.json();
    console.log(`[Mautic] Resposta da API - Total de contatos: ${mauticData.total || 0}`);

    // Se não encontrou contato
    if (!mauticData.contacts || Object.keys(mauticData.contacts).length === 0) {
      console.log(`[Mautic] Nenhum contato encontrado para email: ${email}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Contato não encontrado no Mautic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Pegar o primeiro contato encontrado
    const contactId = Object.keys(mauticData.contacts)[0];
    const contact = mauticData.contacts[contactId];

    console.log(`[Mautic] Contato encontrado - ID: ${contactId}, Score: ${contact.points || 0}`);

    // Buscar dados completos do contato (incluindo UTMs)
    const contactDetailUrl = `${normalizedBaseUrl}/api/contacts/${contactId}`;
    console.log(`[Mautic] Buscando dados completos do contato: ${contactDetailUrl}`);
    
    const detailResponse = await fetch(contactDetailUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!detailResponse.ok) {
      const errorText = await detailResponse.text();
      console.error(`[Mautic] Erro ao buscar detalhes do contato: ${detailResponse.status} - ${errorText}`);
      // Continuar com dados básicos se falhar
    } else {
      const detailData = await detailResponse.json();
      const fullContact = detailData.contact;
      
      if (fullContact) {
        // Atualizar com dados completos
        Object.assign(contact, fullContact);
        console.log(`[Mautic] Dados completos obtidos - UTMs disponíveis: ${fullContact.utmtags ? 'Sim' : 'Não'}`);
        
        // Log detalhado dos campos para debug de UTM
        console.log(`[Mautic] Campos do contato:`, JSON.stringify({
          utmtags: fullContact.utmtags,
          fields_all_keys: fullContact.fields?.all ? Object.keys(fullContact.fields.all) : [],
          sample_fields: fullContact.fields?.all ? Object.keys(fullContact.fields.all).slice(0, 10) : []
        }));
      }
    }

    // Extrair dados estruturados
    const enrichedData: EnrichedLeadData = {
      id_mautic_contact: contactId,
      mautic_score: contact.points || 0,
      mautic_page_hits: null, // Mautic não retorna diretamente page hits nesta API
      mautic_last_active: contact.lastActive || null,
      mautic_first_visit: contact.dateIdentified || null,
      mautic_tags: contact.tags ? contact.tags.map(t => t.tag) : null,
      mautic_segments: null, // Segmentos requerem outra chamada de API
      cidade_mautic: contact.fields?.all?.city || null,
      estado_mautic: contact.fields?.all?.state || null,
      utm_source_mautic: null,
      utm_medium_mautic: null,
      utm_campaign_mautic: null,
      utm_content_mautic: null,
      utm_term_mautic: null,
    };

    // Extrair UTMs se disponíveis
    console.log(`[Mautic] Estrutura de utmtags:`, JSON.stringify(contact.utmtags));
    
    if (contact.utmtags && Array.isArray(contact.utmtags) && contact.utmtags.length > 0) {
      const latestUtm = contact.utmtags[0];
      enrichedData.utm_source_mautic = latestUtm.utm_source || null;
      enrichedData.utm_medium_mautic = latestUtm.utm_medium || null;
      enrichedData.utm_campaign_mautic = latestUtm.utm_campaign || null;
      enrichedData.utm_content_mautic = latestUtm.utm_content || null;
      enrichedData.utm_term_mautic = latestUtm.utm_term || null;
      
      console.log(`[Mautic] UTMs extraídos (array):`, {
        source: enrichedData.utm_source_mautic,
        medium: enrichedData.utm_medium_mautic,
        campaign: enrichedData.utm_campaign_mautic,
      });
    } else if (contact.utmtags && typeof contact.utmtags === 'object') {
      // Se utmtags for um objeto e não um array, tentar extrair diretamente
      const utmObj = contact.utmtags as any;
      enrichedData.utm_source_mautic = utmObj.utm_source || utmObj.utmSource || null;
      enrichedData.utm_medium_mautic = utmObj.utm_medium || utmObj.utmMedium || null;
      enrichedData.utm_campaign_mautic = utmObj.utm_campaign || utmObj.utmCampaign || null;
      enrichedData.utm_content_mautic = utmObj.utm_content || utmObj.utmContent || null;
      enrichedData.utm_term_mautic = utmObj.utm_term || utmObj.utmTerm || null;
      
      console.log(`[Mautic] UTMs extraídos (objeto):`, {
        source: enrichedData.utm_source_mautic,
        medium: enrichedData.utm_medium_mautic,
        campaign: enrichedData.utm_campaign_mautic,
      });
    } else {
      console.log(`[Mautic] Nenhum UTM encontrado em utmtags`);
    }

    console.log(`[Mautic] Enriquecimento completo para ${email}:`, {
      score: enrichedData.mautic_score,
      cidade: enrichedData.cidade_mautic,
      utm_source: enrichedData.utm_source_mautic,
      utm_campaign: enrichedData.utm_campaign_mautic,
      utms_encontrados: !!(enrichedData.utm_source_mautic || enrichedData.utm_campaign_mautic),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: enrichedData,
        message: 'Lead enriquecido com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Mautic] Erro ao enriquecer lead:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Erro ao enriquecer lead com dados do Mautic' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
