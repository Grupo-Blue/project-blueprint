import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato E.164 brasileiro (+55DDNNNNNNNNN)
// Trata todos os formatos: com/sem +55, com/sem espaços, com/sem 9º dígito
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Remove prefixo 55 se existir para trabalhar só com DDD+número
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }
  
  // Agora temos DDD + número (10 ou 11 dígitos)
  if (digits.length === 10) {
    // Formato sem 9º dígito: 6198626334 → adiciona o 9 após DDD
    const ddd = digits.substring(0, 2);
    const numero = digits.substring(2);
    digits = `${ddd}9${numero}`;
  }
  
  // Validação final: deve ter 11 dígitos (DDD + 9 + 8 dígitos)
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  
  // Se ainda não normalizou, log e retorna null para evitar dados incorretos
  console.warn(`[normalizePhone] Telefone inválido: ${phone} → ${digits} (${digits.length} dígitos)`);
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      throw new Error('id_empresa é obrigatório');
    }

    console.log(`[Sync Telefones] Iniciando sincronização de telefones para empresa: ${id_empresa}`);

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

    console.log(`[Sync Telefones] Integração encontrada - Domain: ${domain}`);

    // Buscar todos os leads da empresa que não têm telefone mas têm id_lead_externo (deal ID do Pipedrive)
    // Ignorar leads Tokeniza que têm id_lead_externo no formato 'tokeniza_*'
    const { data: leads, error: leadsError } = await supabase
      .from('lead')
      .select('id_lead, id_lead_externo, nome_lead')
      .eq('id_empresa', id_empresa)
      .is('telefone', null)
      .not('id_lead_externo', 'is', null)
      .not('id_lead_externo', 'ilike', 'tokeniza_%');

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead sem telefone encontrado',
          processados: 0,
          atualizados: 0,
          erros: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[Sync Telefones] ${leads.length} leads sem telefone encontrados`);

    let processados = 0;
    let atualizados = 0;
    let erros = 0;

    // Para cada lead, buscar o deal no Pipedrive e extrair o person_id, depois buscar o telefone
    for (const lead of leads) {
      try {
        const dealId = lead.id_lead_externo;
        console.log(`[Sync Telefones] Processando lead ${lead.nome_lead} - Deal ID: ${dealId}`);

        // Buscar deal no Pipedrive
        const dealUrl = `https://${domain}.pipedrive.com/api/v1/deals/${dealId}?api_token=${apiToken}`;
        const dealResponse = await fetch(dealUrl);

        if (!dealResponse.ok) {
          console.error(`[Sync Telefones] Erro ao buscar deal ${dealId}: ${dealResponse.status}`);
          erros++;
          processados++;
          continue;
        }

        const dealData = await dealResponse.json();

        if (!dealData.success || !dealData.data) {
          console.log(`[Sync Telefones] Deal ${dealId} não retornou dados válidos`);
          processados++;
          continue;
        }

        // Extrair person_id corretamente
        let personId = null;
        if (dealData.data.person_id) {
          // person_id pode vir como objeto {value: 123} ou como número direto
          if (typeof dealData.data.person_id === 'object' && dealData.data.person_id.value) {
            personId = dealData.data.person_id.value;
          } else if (typeof dealData.data.person_id === 'number') {
            personId = dealData.data.person_id;
          } else if (typeof dealData.data.person_id === 'string') {
            personId = parseInt(dealData.data.person_id);
          }
        }

        if (!personId) {
          console.log(`[Sync Telefones] Deal ${dealId} não tem person_id válido associado`);
          processados++;
          continue;
        }

        console.log(`[Sync Telefones] Person ID encontrado: ${personId}`);

        // Buscar dados da pessoa via API do Pipedrive
        const personUrl = `https://${domain}.pipedrive.com/api/v1/persons/${personId}?api_token=${apiToken}`;
        const personResponse = await fetch(personUrl);

        if (!personResponse.ok) {
          console.error(`[Sync Telefones] Erro ao buscar person ${personId}: ${personResponse.status}`);
          erros++;
          processados++;
          continue;
        }

        const personData = await personResponse.json();

        if (!personData.success || !personData.data) {
          console.log(`[Sync Telefones] Dados da pessoa ${personId} não encontrados`);
          processados++;
          continue;
        }

        let personPhone = null;
        const phones = personData.data.phone;

        if (phones) {
          if (Array.isArray(phones) && phones.length > 0) {
            personPhone = normalizePhone(phones[0].value);
          } else if (typeof phones === 'string') {
            personPhone = normalizePhone(phones);
          }
        }

        if (personPhone) {
          console.log(`[Sync Telefones] ✓ Telefone encontrado: ${personPhone}`);

          // Atualizar lead com o telefone
          const { error: updateError } = await supabase
            .from('lead')
            .update({ telefone: personPhone })
            .eq('id_lead', lead.id_lead);

          if (updateError) {
            console.error(`[Sync Telefones] Erro ao atualizar lead ${lead.id_lead}:`, updateError);
            erros++;
          } else {
            atualizados++;
          }
        } else {
          console.log(`[Sync Telefones] ⚠ Pessoa ${personId} não tem telefone no Pipedrive`);
        }

        processados++;

        // Rate limiting - pequena pausa para não sobrecarregar API
        if (processados % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`[Sync Telefones] Erro ao processar lead ${lead.id_lead}:`, error);
        erros++;
        processados++;
      }
    }

    console.log(`[Sync Telefones] Sincronização concluída - ${processados} processados, ${atualizados} atualizados, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização de telefones concluída`,
        processados,
        atualizados,
        erros,
        total_leads: leads.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Sync Telefones] Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Erro ao sincronizar telefones do Pipedrive' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
