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

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      throw new Error('id_empresa é obrigatório');
    }

    console.log(`[Sync Emails] Iniciando sincronização de emails para empresa: ${id_empresa}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar integração Pipedrive da empresa
    const { data: integracoes, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'PIPEDRIVE')
      .eq('ativo', true);

    if (intError) {
      throw new Error(`Erro ao buscar integração: ${intError.message}`);
    }

    const integracao = integracoes?.find((i: any) => i.config_json.id_empresa === id_empresa);

    if (!integracao) {
      throw new Error('Nenhuma integração Pipedrive ativa encontrada para esta empresa');
    }

    const config = integracao.config_json as any;
    const domain = config.domain.replace('.pipedrive.com', '');
    const apiToken = config.api_token;

    console.log(`[Sync Emails] Integração encontrada - Domain: ${domain}`);

    // Buscar todos os leads da empresa que não têm email mas têm id_lead_externo (person_id do Pipedrive)
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, id_lead_externo, nome_lead')
      .eq('id_empresa', id_empresa)
      .is('email', null)
      .not('id_lead_externo', 'is', null);

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead sem email encontrado',
          processados: 0,
          atualizados: 0,
          erros: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[Sync Emails] ${leads.length} leads sem email encontrados`);

    let processados = 0;
    let atualizados = 0;
    let erros = 0;

    // Para cada lead, buscar o deal no Pipedrive e extrair o person_id, depois buscar o email
    for (const lead of leads) {
      try {
        const dealId = lead.id_lead_externo;
        console.log(`[Sync Emails] Processando lead ${lead.nome_lead} - Deal ID: ${dealId}`);

        // Buscar deal no Pipedrive
        const dealUrl = `https://${domain}.pipedrive.com/api/v1/deals/${dealId}?api_token=${apiToken}`;
        const dealResponse = await fetch(dealUrl);

        if (!dealResponse.ok) {
          console.error(`[Sync Emails] Erro ao buscar deal ${dealId}: ${dealResponse.status}`);
          erros++;
          processados++;
          continue;
        }

        const dealData = await dealResponse.json();

        if (!dealData.success || !dealData.data || !dealData.data.person_id) {
          console.log(`[Sync Emails] Deal ${dealId} não tem person_id associado`);
          processados++;
          continue;
        }

        const personId = dealData.data.person_id;
        console.log(`[Sync Emails] Person ID encontrado: ${personId}`);

        // Buscar dados da pessoa via API do Pipedrive
        const personUrl = `https://${domain}.pipedrive.com/api/v1/persons/${personId}?api_token=${apiToken}`;
        const personResponse = await fetch(personUrl);

        if (!personResponse.ok) {
          console.error(`[Sync Emails] Erro ao buscar person ${personId}: ${personResponse.status}`);
          erros++;
          processados++;
          continue;
        }

        const personData = await personResponse.json();

        if (!personData.success || !personData.data) {
          console.log(`[Sync Emails] Dados da pessoa ${personId} não encontrados`);
          processados++;
          continue;
        }

        let personEmail = null;
        const emails = personData.data.email;

        if (emails) {
          if (Array.isArray(emails) && emails.length > 0) {
            personEmail = emails[0].value;
          } else if (typeof emails === 'string') {
            personEmail = emails;
          }
        }

        if (personEmail) {
          console.log(`[Sync Emails] ✓ Email encontrado: ${personEmail}`);

          // Atualizar lead com o email
          const { error: updateError } = await supabase
            .from('lead')
            .update({ email: personEmail })
            .eq('id_lead', lead.id_lead);

          if (updateError) {
            console.error(`[Sync Emails] Erro ao atualizar lead ${lead.id_lead}:`, updateError);
            erros++;
          } else {
            atualizados++;
          }
        } else {
          console.log(`[Sync Emails] ⚠ Pessoa ${personId} não tem email no Pipedrive`);
        }

        processados++;

      } catch (error) {
        console.error(`[Sync Emails] Erro ao processar lead ${lead.id_lead}:`, error);
        erros++;
        processados++;
      }
    }

    console.log(`[Sync Emails] Sincronização concluída - ${processados} processados, ${atualizados} atualizados, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização de emails concluída`,
        processados,
        atualizados,
        erros,
        total_leads: leads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Sync Emails] Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Erro ao sincronizar emails do Pipedrive' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
