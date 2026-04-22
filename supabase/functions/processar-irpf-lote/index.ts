import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TENTATIVAS = 5;
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 min — consider stuck

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

    console.log(`[lote] Invocado para lote ${id_lote}`);

    // ── Check lote status ──
    const { data: lote } = await supabase
      .from('irpf_importacao_lote')
      .select('status, id_empresa')
      .eq('id', id_lote)
      .single();

    if (!lote) {
      return new Response(JSON.stringify({ error: 'Lote não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If lote was cancelled or errored, stop
    if (['cancelado', 'concluido'].includes(lote.status)) {
      console.log(`[lote] ${id_lote} já finalizado (${lote.status}), ignorando`);
      return new Response(JSON.stringify({ success: true, message: `Lote já ${lote.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing if still pending
    if (lote.status === 'pendente') {
      await supabase.from('irpf_importacao_lote').update({ status: 'processando' }).eq('id', id_lote);
    }

    // ── Recover stuck files (processing for > threshold) ──
    const { data: stuckFiles } = await supabase
      .from('irpf_importacao_fila')
      .select('id, tentativas')
      .eq('id_lote', id_lote)
      .eq('status', 'processando')
      .lt('processing_started_at', new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString());

    if (stuckFiles && stuckFiles.length > 0) {
      for (const sf of stuckFiles) {
        if (sf.tentativas >= MAX_TENTATIVAS) {
          await supabase.from('irpf_importacao_fila').update({
            status: 'erro',
            erro_mensagem: `Excedeu ${MAX_TENTATIVAS} tentativas (timeout repetido)`,
          }).eq('id', sf.id);
        } else {
          await supabase.from('irpf_importacao_fila').update({
            status: 'pendente',
            processing_started_at: null,
          }).eq('id', sf.id);
        }
      }
      console.log(`[lote] Recuperados ${stuckFiles.length} arquivo(s) travado(s)`);
    }

    // ── Claim next pending file atomically ──
    const { data: nextFiles } = await supabase
      .from('irpf_importacao_fila')
      .select('id')
      .eq('id_lote', id_lote)
      .eq('status', 'pendente')
      .order('created_at')
      .limit(1);

    if (!nextFiles || nextFiles.length === 0) {
      // No more pending — finalize lote
      await recalcAndFinalize(supabase, id_lote);
      console.log(`[lote] ${id_lote} sem pendentes, finalizado`);
      return new Response(JSON.stringify({ success: true, message: 'Lote finalizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileId = nextFiles[0].id;

    // Atomic claim: update only if still pending
    const { data: claimed, error: claimError } = await supabase
      .from('irpf_importacao_fila')
      .update({
        status: 'processando',
        processing_started_at: new Date().toISOString(),
        tentativas: supabase.rpc ? undefined : undefined, // will increment below
      })
      .eq('id', fileId)
      .eq('status', 'pendente')
      .select('id, nome_arquivo, storage_path, tentativas')
      .single();

    if (claimError || !claimed) {
      // Someone else claimed it — self-chain immediately
      console.log(`[lote] Arquivo ${fileId} já foi reivindicado, re-invocando`);
      await selfInvoke(supabaseUrl, serviceKey, id_lote);
      return new Response(JSON.stringify({ success: true, message: 'Re-invocando' }), {
        status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment tentativas
    await supabase.from('irpf_importacao_fila').update({
      tentativas: (claimed.tentativas || 0) + 1,
    }).eq('id', fileId);

    console.log(`[lote] Processando: ${claimed.nome_arquivo} (tentativa ${(claimed.tentativas || 0) + 1})`);

    // ── Process the file ──
    let sucesso = false;
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('irpf-uploads')
        .download(claimed.storage_path);

      if (downloadError || !fileData) {
        throw new Error(`Erro ao baixar: ${downloadError?.message || 'arquivo não encontrado'}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const pdfBase64 = btoa(binary);

      const processResponse = await fetch(`${supabaseUrl}/functions/v1/processar-irpf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          pdfBase64,
          id_empresa: lote.id_empresa,
          arquivo_origem: claimed.nome_arquivo,
        }),
        signal: AbortSignal.timeout(300000), // 5 min
      });

      if (!processResponse.ok) {
        const status = processResponse.status;
        let errorMsg = `Status ${status}`;
        if (status === 504) {
          errorMsg = 'Timeout no processamento (PDF muito grande ou complexo)';
        } else {
          const body = await processResponse.text().catch(() => '');
          try {
            const parsed = JSON.parse(body);
            errorMsg = parsed?.error || parsed?.message || errorMsg;
          } catch {
            if (body) errorMsg = body.substring(0, 500);
          }
        }
        throw new Error(errorMsg);
      }

      const result = await processResponse.json().catch(() => null);
      if (!result?.success) {
        throw new Error(result?.error || result?.message || 'Resposta inválida');
      }

      // Sucesso → descarta o registro da fila E o PDF do storage
      await supabase.storage.from('irpf-uploads').remove([claimed.storage_path]);
      await supabase.from('irpf_importacao_fila').delete().eq('id', fileId);

      sucesso = true;
      console.log(`[lote] ✅ ${claimed.nome_arquivo} (descartado da fila)`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`[lote] ❌ ${claimed.nome_arquivo}: ${errorMsg}`);

      // Erro → mantém PDF no storage E registro na fila para reprocessar/baixar
      await supabase.from('irpf_importacao_fila').update({
        status: 'erro',
        erro_mensagem: errorMsg,
      }).eq('id', fileId);
      // NÃO remover do storage — usuário pode querer baixar/reprocessar
    }

    // ── Update lote counters from actual fila data ──
    await recalcCounters(supabase, id_lote);

    // ── Self-chain: invoke next iteration ──
    // Re-check if lote was cancelled during processing
    const { data: loteCheck } = await supabase
      .from('irpf_importacao_lote')
      .select('status')
      .eq('id', id_lote)
      .single();

    if (loteCheck?.status && ['cancelado', 'concluido', 'erro'].includes(loteCheck.status)) {
      console.log(`[lote] ${id_lote} foi ${loteCheck.status} durante processamento, parando`);
    } else {
      // Check if there are more pending
      const { count } = await supabase
        .from('irpf_importacao_fila')
        .select('id', { count: 'exact', head: true })
        .eq('id_lote', id_lote)
        .eq('status', 'pendente');

      if ((count || 0) > 0) {
        console.log(`[lote] ${count} pendente(s), auto-invocando próximo`);
        await selfInvoke(supabaseUrl, serviceKey, id_lote);
      } else {
        await recalcAndFinalize(supabase, id_lote);
        console.log(`[lote] ${id_lote} finalizado`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      arquivo: claimed.nome_arquivo,
      resultado: sucesso ? 'sucesso' : 'erro',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[lote] Erro fatal:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** Recalculate lote counters from fila reality */
async function recalcCounters(supabase: any, id_lote: string) {
  const { data: fila } = await supabase
    .from('irpf_importacao_fila')
    .select('status')
    .eq('id_lote', id_lote);

  if (!fila) return;

  const processados = fila.filter((f: any) => f.status === 'sucesso').length;
  const erros = fila.filter((f: any) => f.status === 'erro').length;

  await supabase.from('irpf_importacao_lote').update({ processados, erros }).eq('id', id_lote);
}

/** Recalculate counters and set final status */
async function recalcAndFinalize(supabase: any, id_lote: string) {
  const { data: fila } = await supabase
    .from('irpf_importacao_fila')
    .select('status')
    .eq('id_lote', id_lote);

  if (!fila) return;

  const processados = fila.filter((f: any) => f.status === 'sucesso').length;
  const erros = fila.filter((f: any) => f.status === 'erro').length;
  const pending = fila.filter((f: any) => f.status === 'pendente' || f.status === 'processando').length;

  const finalStatus = pending > 0 ? 'processando' : (erros > 0 && processados === 0 ? 'erro' : 'concluido');

  await supabase.from('irpf_importacao_lote').update({
    status: finalStatus,
    processados,
    erros,
  }).eq('id', id_lote);
}

/** Self-invoke to process next file */
async function selfInvoke(supabaseUrl: string, serviceKey: string, id_lote: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/processar-irpf-lote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ id_lote }),
      signal: AbortSignal.timeout(5000), // just fire, don't wait
    }).catch(() => {}); // ignore response
  } catch {
    console.error(`[lote] Falha ao auto-invocar para lote ${id_lote}`);
  }
}
