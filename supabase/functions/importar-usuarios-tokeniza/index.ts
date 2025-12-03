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

  const startTime = Date.now();
  
  try {
    const { csvData } = await req.json();
    
    if (!csvData || !Array.isArray(csvData)) {
      throw new Error('csvData deve ser um array de objetos');
    }

    console.log(`[importar-usuarios-tokeniza] Iniciando importação de ${csvData.length} usuários`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Processar em lotes
    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      
      const records = batch.map((row: any) => ({
        user_id_tokeniza: row.id,
        email: row.email || null,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        phone: row.phone || null,
        cpf: row.cpf || null,
        cnpj: row.cnpj || null,
        data_cadastro: row.when ? new Date(row.when).toISOString() : null,
      })).filter((r: any) => r.user_id_tokeniza);

      const { data, error } = await supabase
        .from('tokeniza_usuario')
        .upsert(records, { 
          onConflict: 'user_id_tokeniza',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`[importar-usuarios-tokeniza] Erro no lote ${i / BATCH_SIZE + 1}:`, error);
        totalErrors += batch.length;
      } else {
        totalInserted += records.length;
      }

      console.log(`[importar-usuarios-tokeniza] Lote ${i / BATCH_SIZE + 1} processado: ${records.length} registros`);
    }

    const duration = Date.now() - startTime;
    console.log(`[importar-usuarios-tokeniza] Concluído em ${duration}ms - ${totalInserted} inseridos, ${totalErrors} erros`);

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'importar-usuarios-tokeniza',
      status: totalErrors === 0 ? 'sucesso' : 'parcial',
      duracao_ms: duration,
      detalhes_execucao: {
        total_recebido: csvData.length,
        total_inserido: totalInserted,
        total_erros: totalErrors
      }
    });

    return new Response(JSON.stringify({
      success: true,
      totalRecebido: csvData.length,
      totalInserido: totalInserted,
      totalErros: totalErrors,
      duracaoMs: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[importar-usuarios-tokeniza] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
