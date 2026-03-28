import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação via x-api-key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('SGT_WEBHOOK_SECRET');

    if (!apiKey || apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Método não permitido. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { lead, empresa } = body;

    if (!lead || !empresa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: "lead" (objeto) e "empresa" ("BLUE" ou "TOKENIZA")' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const BLUE_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";
    const TOKENIZA_ID = "61b5ffeb-fbbc-47c1-8ced-152bb647ed20";

    const empresaMap: Record<string, string> = { BLUE: BLUE_ID, TOKENIZA: TOKENIZA_ID };
    const id_empresa = empresaMap[empresa.toUpperCase()];

    if (!id_empresa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa inválida. Use "BLUE" ou "TOKENIZA".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação mínima
    if (!lead.nome_lead && !lead.email && !lead.telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos nome_lead, email ou telefone.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Deduplicação: verificar se já existe lead com mesmo email ou telefone
    let leadExistente = null;

    if (lead.email) {
      const { data } = await supabase
        .from('lead')
        .select('id_lead, nome_lead, email')
        .eq('id_empresa', id_empresa)
        .ilike('email', lead.email)
        .or('merged.is.null,merged.eq.false')
        .limit(1);
      if (data && data.length > 0) leadExistente = data[0];
    }

    if (!leadExistente && lead.telefone) {
      const digits = lead.telefone.replace(/\D/g, '');
      if (digits.length >= 10) {
        const { data } = await supabase
          .from('lead')
          .select('id_lead, nome_lead, email')
          .eq('id_empresa', id_empresa)
          .or(`telefone.eq.${digits},telefone.eq.+55${digits}`)
          .or('merged.is.null,merged.eq.false')
          .limit(1);
        if (data && data.length > 0) leadExistente = data[0];
      }
    }

    // Se já existe, atualizar campos não-nulos
    if (leadExistente) {
      const updateFields: Record<string, unknown> = {};
      const camposAtualizaveis = [
        'nome_lead', 'telefone', 'organizacao', 'origem_canal', 'origem_tipo',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'score_temperatura', 'proprietario_nome', 'cidade_mautic', 'estado_mautic',
        'linkedin_cargo', 'linkedin_empresa', 'linkedin_setor', 'linkedin_senioridade',
        'cpf', 'observacoes',
      ];

      for (const campo of camposAtualizaveis) {
        if (lead[campo] !== undefined && lead[campo] !== null && lead[campo] !== '') {
          updateFields[campo] = lead[campo];
        }
      }

      if (Object.keys(updateFields).length > 0) {
        await supabase
          .from('lead')
          .update(updateFields)
          .eq('id_lead', leadExistente.id_lead);
      }

      console.log(`[criar-lead-api] Lead existente atualizado: ${leadExistente.id_lead}`);

      return new Response(
        JSON.stringify({
          success: true,
          acao: 'atualizado',
          id_lead: leadExistente.id_lead,
          mensagem: `Lead já existia (${leadExistente.email || leadExistente.nome_lead}). Dados atualizados.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar lead novo
    const novoLead: Record<string, unknown> = {
      id_empresa,
      nome_lead: lead.nome_lead || lead.nome || 'Sem nome',
      email: lead.email || null,
      telefone: lead.telefone || null,
      organizacao: lead.organizacao || null,
      origem_canal: lead.origem_canal || lead.canal || 'API',
      origem_tipo: lead.origem_tipo || 'INBOUND',
      stage_atual: lead.stage_atual || 'lead',
      utm_source: lead.utm_source || null,
      utm_medium: lead.utm_medium || null,
      utm_campaign: lead.utm_campaign || null,
      utm_content: lead.utm_content || null,
      utm_term: lead.utm_term || null,
      score_temperatura: lead.score_temperatura || null,
      proprietario_nome: lead.proprietario_nome || null,
      cidade_mautic: lead.cidade_mautic || null,
      estado_mautic: lead.estado_mautic || null,
      linkedin_cargo: lead.linkedin_cargo || null,
      linkedin_empresa: lead.linkedin_empresa || null,
      cpf: lead.cpf || null,
      observacoes: lead.observacoes || null,
      data_criacao: lead.data_criacao || new Date().toISOString(),
    };

    const { data: criado, error } = await supabase
      .from('lead')
      .insert(novoLead)
      .select('id_lead, nome_lead, email')
      .single();

    if (error) {
      console.error('[criar-lead-api] Erro ao inserir:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[criar-lead-api] Lead criado: ${criado.id_lead} - ${criado.nome_lead}`);

    // Feed Identity Graph
    const identifiers: { type: string; value: string }[] = [];
    if (lead.email) identifiers.push({ type: 'email', value: lead.email });
    if (lead.telefone) identifiers.push({ type: 'phone', value: lead.telefone });
    if (lead.cpf) identifiers.push({ type: 'cpf', value: lead.cpf });
    if (identifiers.length > 0) {
      try {
        await supabase.functions.invoke('resolver-identidade', {
          body: { id_empresa, identifiers, source: 'criar-lead-api' },
        });
      } catch (igErr) {
        console.warn('[criar-lead-api] Identity Graph erro não-crítico:', igErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        acao: 'criado',
        id_lead: criado.id_lead,
        mensagem: `Lead "${criado.nome_lead}" criado com sucesso.`,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[criar-lead-api] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
