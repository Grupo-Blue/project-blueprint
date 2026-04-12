import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_EXECUTION_MS = 50000; // 50s safety limit

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
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

    console.log(`[processar-irpf-lote] Iniciando lote ${id_lote}`);

    // Mark lote as processing
    await supabase
      .from('irpf_importacao_lote')
      .update({ status: 'processando' })
      .eq('id', id_lote);

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

      return new Response(JSON.stringify({ success: true, message: 'Nenhum arquivo pendente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get lote info for id_empresa
    const { data: lote } = await supabase
      .from('irpf_importacao_lote')
      .select('id_empresa')
      .eq('id', id_lote)
      .single();

    const id_empresa = lote?.id_empresa;
    let processados = 0;
    let erros = 0;

    for (const arquivo of arquivos) {
      // Check if lote was cancelled
      const { data: loteCheck } = await supabase
        .from('irpf_importacao_lote')
        .select('status')
        .eq('id', id_lote)
        .single();

      if (loteCheck?.status === 'cancelado') {
        console.log('[processar-irpf-lote] Lote cancelado, parando processamento');
        break;
      }

      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log('[processar-irpf-lote] Próximo do timeout, parando loop');
        break;
      }

      try {
        // Mark file as processing
        await supabase
          .from('irpf_importacao_fila')
          .update({ status: 'processando' })
          .eq('id', arquivo.id);

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

        // Call processar-irpf
        const { data: processResult, error: processError } = await supabase.functions.invoke('processar-irpf', {
          body: {
            pdfBase64,
            id_empresa,
            arquivo_origem: arquivo.nome_arquivo,
          },
        });

        if (processError || !processResult?.success) {
          throw new Error(processError?.message || processResult?.error || 'Erro ao processar');
        }

        // Mark as success
        await supabase
          .from('irpf_importacao_fila')
          .update({
            status: 'sucesso',
            resultado: { nome: processResult.nome, exercicio: processResult.exercicio },
          })
          .eq('id', arquivo.id);

        processados++;

        // Delete file from storage
        await supabase.storage.from('irpf-uploads').remove([arquivo.storage_path]);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`[processar-irpf-lote] Erro em ${arquivo.nome_arquivo}:`, errorMsg);

        await supabase
          .from('irpf_importacao_fila')
          .update({ status: 'erro', erro_mensagem: errorMsg })
          .eq('id', arquivo.id);

        erros++;

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
          processados: (currentLote?.processados || 0) + (processados > 0 ? 1 : 0),
          erros: (currentLote?.erros || 0) + (erros > 0 ? 1 : 0),
        })
        .eq('id', id_lote);

      // Reset per-iteration counters (already flushed to DB)
      processados = 0;
      erros = 0;
    }

    // Check if there are still pending files
    const { count: pendingCount } = await supabase
      .from('irpf_importacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('id_lote', id_lote)
      .eq('status', 'pendente');

    // Re-check lote status before deciding next steps
    const { data: loteFinal } = await supabase
      .from('irpf_importacao_lote')
      .select('status')
      .eq('id', id_lote)
      .single();

    const wasCancelled = loteFinal?.status === 'cancelado';

    const finalStatus = wasCancelled ? 'cancelado' : (pendingCount || 0) > 0 ? 'processando' : 'concluido';

    if (!wasCancelled) {
      await supabase
        .from('irpf_importacao_lote')
        .update({ status: finalStatus })
        .eq('id', id_lote);
    }

    // If there are still pending files and not cancelled, re-invoke via fetch
    if (finalStatus === 'processando' && (pendingCount || 0) > 0) {
      console.log(`[processar-irpf-lote] ${pendingCount} pendentes, re-invocando via fetch...`);
      fetch(`${supabaseUrl}/functions/v1/processar-irpf-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ id_lote }),
      }).catch(err => console.error('[processar-irpf-lote] Erro ao re-invocar:', err));
    }

    console.log(`[processar-irpf-lote] Lote ${id_lote}: status=${finalStatus}, pendentes=${pendingCount || 0}`);

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      pending: pendingCount || 0,
    }), {
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
