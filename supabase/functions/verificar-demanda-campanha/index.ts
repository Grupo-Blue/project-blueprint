import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { id_demanda } = await req.json();

    if (!id_demanda) {
      return new Response(
        JSON.stringify({ error: 'id_demanda é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verificar-demanda] Verificando demanda ${id_demanda}`);

    // Buscar demanda
    const { data: demanda, error: demandaError } = await supabase
      .from('demanda_campanha')
      .select(`
        *,
        empresa:id_empresa (
          id_empresa,
          nome
        )
      `)
      .eq('id_demanda', id_demanda)
      .single();

    if (demandaError || !demanda) {
      console.error('[verificar-demanda] Demanda não encontrada:', demandaError);
      return new Response(
        JSON.stringify({ error: 'Demanda não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (demanda.status !== 'EXECUTADA') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Demanda não está no status EXECUTADA' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!demanda.id_campanha_criada) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'ID da campanha criada não foi informado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verificar-demanda] Verificando campanha ${demanda.id_campanha_criada} na plataforma ${demanda.plataforma}`);

    let campanhaEncontrada = false;
    let resultadoVerificacao = '';

    // Verificar se a campanha existe no banco local
    const { data: campanhaLocal } = await supabase
      .from('campanha')
      .select('id_campanha, nome, ativa')
      .eq('id_campanha_externo', demanda.id_campanha_criada)
      .maybeSingle();

    if (campanhaLocal) {
      campanhaEncontrada = true;
      resultadoVerificacao = `Campanha "${campanhaLocal.nome}" encontrada no sistema. Status: ${campanhaLocal.ativa ? 'Ativa' : 'Inativa'}`;
      console.log(`[verificar-demanda] ${resultadoVerificacao}`);
    } else {
      // Verificar via API da plataforma
      if (demanda.plataforma === 'META') {
        // Buscar integração Meta
        const { data: integracao } = await supabase
          .from('integracao')
          .select('config_json')
          .eq('tipo', 'META_ADS')
          .eq('ativo', true)
          .maybeSingle();

        if (integracao?.config_json) {
          const config = integracao.config_json as any;
          const accessToken = config.access_token;

          if (accessToken) {
            try {
              const metaResponse = await fetch(
                `https://graph.facebook.com/v22.0/${demanda.id_campanha_criada}?fields=id,name,status&access_token=${accessToken}`
              );

              if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                campanhaEncontrada = true;
                resultadoVerificacao = `Campanha Meta "${metaData.name}" encontrada. Status: ${metaData.status}`;
                console.log(`[verificar-demanda] ${resultadoVerificacao}`);
              } else {
                resultadoVerificacao = 'Campanha não encontrada na API do Meta Ads';
              }
            } catch (apiError) {
              console.error('[verificar-demanda] Erro ao verificar Meta:', apiError);
              resultadoVerificacao = 'Erro ao verificar campanha na API do Meta Ads';
            }
          }
        }
      } else if (demanda.plataforma === 'GOOGLE') {
        // Buscar integração Google
        const { data: integracao } = await supabase
          .from('integracao')
          .select('config_json')
          .eq('tipo', 'GOOGLE_ADS')
          .eq('ativo', true)
          .maybeSingle();

        if (integracao?.config_json) {
          // Para Google Ads, verificação simplificada via banco local
          resultadoVerificacao = 'Verificação Google Ads: aguardando próxima sincronização de campanhas';
        }
      }

      if (!resultadoVerificacao) {
        resultadoVerificacao = 'Não foi possível verificar a campanha. Aguardando próxima sincronização.';
      }
    }

    // Atualizar demanda com resultado
    const updateData: any = {
      data_verificacao: new Date().toISOString(),
      resultado_verificacao: resultadoVerificacao,
    };

    if (campanhaEncontrada) {
      updateData.status = 'VERIFICADA';
      updateData.verificada = true;
    }

    const { error: updateError } = await supabase
      .from('demanda_campanha')
      .update(updateData)
      .eq('id_demanda', id_demanda);

    if (updateError) {
      console.error('[verificar-demanda] Erro ao atualizar demanda:', updateError);
      throw updateError;
    }

    console.log(`[verificar-demanda] Demanda ${id_demanda} ${campanhaEncontrada ? 'VERIFICADA' : 'pendente de verificação'}`);

    return new Response(
      JSON.stringify({
        success: true,
        verificada: campanhaEncontrada,
        resultado: resultadoVerificacao
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[verificar-demanda] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
