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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { id_lote } = await req.json();
    if (!id_lote) {
      return new Response(JSON.stringify({ error: 'id_lote é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[processar-irpf-lote] Iniciando lote ${id_lote} com waitUntil`);

    // Mark lote as processing
    await supabase
      .from('irpf_importacao_lote')
      .update({ status: 'processando' })
      .eq('id', id_lote);

    // Kick off background processing — survives beyond the HTTP response
    EdgeRuntime.waitUntil(processarLoteEmBackground(supabaseUrl, serviceKey, id_lote));

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento iniciado em segundo plano',
      id_lote,
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[processar-irpf-lote] Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processarLoteEmBackground(supabaseUrl: string, serviceKey: string, id_lote: string) {
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch pending files
    const { data: arquivos, error: fetchError } = await supabase
      .from('irpf_importacao_fila')
      .select('*')
      .eq('id_lote', id_lote)
      .eq('status', 'pendente')
      .order('created_at');

    if (fetchError) throw fetchError;
    if (!arquivos || arquivos.length === 0) {
      await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'concluido' })
        .eq('id', id_lote);
      console.log(`[processar-irpf-lote] Lote ${id_lote}: nenhum pendente, concluído`);
      return;
    }

    // Get lote info for id_empresa
    const { data: lote } = await supabase
      .from('irpf_importacao_lote')
      .select('id_empresa')
      .eq('id', id_lote)
      .single();

    const id_empresa = lote?.id_empresa;

    for (const arquivo of arquivos) {
      // Check if lote was manually stopped
      const { data: loteCheck } = await supabase
        .from('irpf_importacao_lote')
        .select('status')
        .eq('id', id_lote)
        .single();

      if (loteCheck?.status && !['pendente', 'processando'].includes(loteCheck.status)) {
        console.log(`[processar-irpf-lote] Lote ${id_lote} interrompido com status ${loteCheck.status}`);
        break;
      }

      // Re-check file status (avoid double processing)
      const { data: filaCheck } = await supabase
        .from('irpf_importacao_fila')
        .select('status')
        .eq('id', arquivo.id)
        .single();

      if (filaCheck?.status !== 'pendente') {
        console.log(`[processar-irpf-lote] Arquivo ${arquivo.id} ignorado com status ${filaCheck?.status}`);
        continue;
      }

      // Mark file as processing
      await supabase
        .from('irpf_importacao_fila')
        .update({ status: 'processando' })
        .eq('id', arquivo.id);

      let sucesso = false;
      try {
        // Download from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('irpf-uploads')
          .download(arquivo.storage_path);

        if (downloadError || !fileData) {
          throw new Error(`Erro ao baixar arquivo: ${downloadError?.message || 'arquivo não encontrado'}`);
        }

        // Convert to base64
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const pdfBase64 = btoa(binary);

        // Call processar-irpf with 5min timeout per file
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/processar-irpf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            pdfBase64,
            id_empresa,
            arquivo_origem: arquivo.nome_arquivo,
          }),
          signal: AbortSignal.timeout(300000), // 5 min per file
        });

        // Handle non-OK responses
        if (!processResponse.ok) {
          const statusCode = processResponse.status;
          let errorMsg = `Status ${statusCode}`;
          if (statusCode === 504) {
            errorMsg = 'Timeout no processamento (PDF muito grande ou complexo)';
          } else {
            const errorBody = await processResponse.text().catch(() => '');
            try {
              const parsed = JSON.parse(errorBody);
              errorMsg = parsed?.error || parsed?.message || errorMsg;
            } catch {
              if (errorBody) errorMsg = errorBody.substring(0, 500);
            }
          }
          throw new Error(errorMsg);
        }

        const processResult = await processResponse.json().catch(() => null);

        if (!processResult?.success) {
          const errorMsg = processResult?.error || processResult?.message || 'Resposta inválida do processamento';
          throw new Error(errorMsg);
        }

        // Mark as success
        await supabase
          .from('irpf_importacao_fila')
          .update({
            status: 'sucesso',
            resultado: { nome: processResult.nome, exercicio: processResult.exercicio },
          })
          .eq('id', arquivo.id);

        sucesso = true;
        console.log(`[processar-irpf-lote] ✅ ${arquivo.nome_arquivo} processado`);

        // Delete file from storage
        await supabase.storage.from('irpf-uploads').remove([arquivo.storage_path]);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`[processar-irpf-lote] ❌ ${arquivo.nome_arquivo}: ${errorMsg}`);

        await supabase
          .from('irpf_importacao_fila')
          .update({ status: 'erro', erro_mensagem: errorMsg })
          .eq('id', arquivo.id);

        // Delete file from storage on error too
        await supabase.storage.from('irpf-uploads').remove([arquivo.storage_path]);
      }

      // Update lote counters after EACH file
      const { data: currentLote } = await supabase
        .from('irpf_importacao_lote')
        .select('processados, erros')
        .eq('id', id_lote)
        .single();

      await supabase
        .from('irpf_importacao_lote')
        .update({
          processados: (currentLote?.processados || 0) + (sucesso ? 1 : 0),
          erros: (currentLote?.erros || 0) + (sucesso ? 0 : 1),
        })
        .eq('id', id_lote);
    }

    // Check final state
    const { count: pendingCount } = await supabase
      .from('irpf_importacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('id_lote', id_lote)
      .eq('status', 'pendente');

    const { data: loteFinal } = await supabase
      .from('irpf_importacao_lote')
      .select('status')
      .eq('id', id_lote)
      .single();

    const hasLockedFinalStatus = !!loteFinal?.status && !['pendente', 'processando'].includes(loteFinal.status);

    if (!hasLockedFinalStatus) {
      const finalStatus = (pendingCount || 0) > 0 ? 'processando' : 'concluido';
      await supabase
        .from('irpf_importacao_lote')
        .update({ status: finalStatus })
        .eq('id', id_lote);
      console.log(`[processar-irpf-lote] Lote ${id_lote}: status=${finalStatus}, pendentes=${pendingCount || 0}`);
    }

  } catch (error) {
    console.error('[processar-irpf-lote] Erro no background:', error);
    // Try to mark lote as error
    try {
      await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'erro' })
        .eq('id', id_lote);
    } catch { /* best effort */ }
  }
}
