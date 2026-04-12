import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_EXECUTION_MS = 55000; // 55s safety limit

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
      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log('[processar-irpf-lote] Próximo do timeout, parando');
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

        // Delete file from storage (não precisa armazenar)
        await supabase.storage.from('irpf-uploads').remove([arquivo.storage_path]);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`[processar-irpf-lote] Erro em ${arquivo.nome_arquivo}:`, errorMsg);

        await supabase
          .from('irpf_importacao_fila')
          .update({ status: 'erro', erro_mensagem: errorMsg })
          .eq('id', arquivo.id);

        erros++;

        // Also delete file from storage on error
        await supabase.storage.from('irpf-uploads').remove([arquivo.storage_path]);
      }

      // Update lote counters after each file
      await supabase.rpc('increment_lote_counters', { 
        lote_id: id_lote, 
        add_processados: arquivo.id === arquivos[arquivos.length - 1]?.id ? processados : 0,
        add_erros: arquivo.id === arquivos[arquivos.length - 1]?.id ? erros : 0,
      }).catch(() => {
        // Fallback: direct update
      });
    }

    // Final update of lote counters
    const { data: currentLote } = await supabase
      .from('irpf_importacao_lote')
      .select('processados, erros')
      .eq('id', id_lote)
      .single();

    const newProcessados = (currentLote?.processados || 0) + processados;
    const newErros = (currentLote?.erros || 0) + erros;

    // Check if there are still pending files
    const { count: pendingCount } = await supabase
      .from('irpf_importacao_fila')
      .select('id', { count: 'exact', head: true })
      .eq('id_lote', id_lote)
      .eq('status', 'pendente');

    const finalStatus = (pendingCount || 0) > 0 ? 'processando' : 'concluido';

    await supabase
      .from('irpf_importacao_lote')
      .update({
        processados: newProcessados,
        erros: newErros,
        status: finalStatus,
      })
      .eq('id', id_lote);

    // If there are still pending files (timeout), re-invoke self
    if (finalStatus === 'processando' && (pendingCount || 0) > 0) {
      console.log(`[processar-irpf-lote] ${pendingCount} pendentes, re-invocando...`);
      // Fire and forget
      supabase.functions.invoke('processar-irpf-lote', {
        body: { id_lote },
      }).catch(err => console.error('[processar-irpf-lote] Erro ao re-invocar:', err));
    }

    console.log(`[processar-irpf-lote] Lote ${id_lote}: ${processados} processados, ${erros} erros, status=${finalStatus}`);

    return new Response(JSON.stringify({
      success: true,
      processados,
      erros,
      status: finalStatus,
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
