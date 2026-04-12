import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5; // Processar 5 arquivos por invocação para evitar timeout
const MAX_EXECUTION_MS = 50000; // 50s safety limit (edge function timeout ~60s)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Aceitar batch_size customizado via body
    let customBatchSize = BATCH_SIZE;
    try {
      const body = await req.json();
      if (body?.batch_size && typeof body.batch_size === 'number') {
        customBatchSize = Math.min(body.batch_size, 10); // Max 10 por segurança
      }
    } catch { /* sem body, usar default */ }

    console.log(`[monitorar-pasta-irpf] Iniciando (batch_size=${customBatchSize})...`);

    // Buscar configuração de integração Google Drive
    const { data: integracao, error: intError } = await supabase
      .from('integracao')
      .select('*')
      .eq('tipo', 'GOOGLE_DRIVE')
      .eq('ativo', true)
      .single();

    if (intError || !integracao) {
      console.log('[monitorar-pasta-irpf] Integração Google Drive não configurada');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Integração Google Drive não configurada' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = integracao.config_json as {
      client_id: string;
      client_secret: string;
      refresh_token: string;
      folder_id: string;
      id_empresa: string;
    };

    // Obter access token via refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        refresh_token: config.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('[monitorar-pasta-irpf] Erro ao obter access token:', tokenError);
      throw new Error('Falha na autenticação Google Drive');
    }

    const { access_token } = await tokenResponse.json();

    // Listar PDFs com paginação - pegar apenas batch_size arquivos
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${config.folder_id}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,createdTime),nextPageToken&pageSize=${customBatchSize}&orderBy=createdTime`;
    
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!listResponse.ok) {
      const listError = await listResponse.text();
      console.error('[monitorar-pasta-irpf] Erro ao listar arquivos:', listError);
      throw new Error('Falha ao listar arquivos');
    }

    const listData = await listResponse.json();
    const files = listData.files || [];
    const hasMore = !!listData.nextPageToken;

    // Contar total de PDFs na pasta (query separada, sem baixar)
    let totalPendentes = files.length;
    if (hasMore) {
      const countUrl = `https://www.googleapis.com/drive/v3/files?q='${config.folder_id}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id)&pageSize=1000`;
      const countResponse = await fetch(countUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (countResponse.ok) {
        const countData = await countResponse.json();
        totalPendentes = countData.files?.length || files.length;
      }
    }

    console.log(`[monitorar-pasta-irpf] ${files.length} PDFs neste lote, ${totalPendentes} total pendentes`);

    let processados = 0;
    let erros = 0;

    // Garantir pasta "processados" existe (uma vez por invocação)
    let processadosFolderId: string | null = null;
    const checkFolderUrl = `https://www.googleapis.com/drive/v3/files?q='${config.folder_id}'+in+parents+and+name='processados'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`;
    const checkFolderResponse = await fetch(checkFolderUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { files: existingFolders } = await checkFolderResponse.json();
    processadosFolderId = existingFolders?.[0]?.id || null;

    if (!processadosFolderId) {
      const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'processados',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [config.folder_id],
        }),
      });
      const newFolder = await createFolderResponse.json();
      processadosFolderId = newFolder.id;
    }

    for (const file of files) {
      // Verificar se estamos próximos do timeout
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log('[monitorar-pasta-irpf] Próximo do timeout, parando lote');
        break;
      }

      try {
        console.log(`[monitorar-pasta-irpf] Processando: ${file.name}`);

        // Download do arquivo
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const downloadResponse = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!downloadResponse.ok) {
          console.error(`[monitorar-pasta-irpf] Erro ao baixar ${file.name}`);
          erros++;
          continue;
        }

        const pdfBuffer = await downloadResponse.arrayBuffer();
        const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

        // Processar via edge function
        const { data: processResult, error: processError } = await supabase.functions.invoke('processar-irpf', {
          body: {
            pdfBase64,
            id_empresa: config.id_empresa,
            arquivo_origem: `gdrive:${file.name}`,
          },
        });

        if (processError || !processResult?.success) {
          console.error(`[monitorar-pasta-irpf] Erro ao processar ${file.name}:`, processError || processResult?.error);
          erros++;
          continue;
        }

        // Mover arquivo para pasta "processados"
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${processadosFolderId}&removeParents=${config.folder_id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${access_token}` },
        });

        processados++;
        console.log(`[monitorar-pasta-irpf] ${file.name} processado e movido`);
      } catch (fileError) {
        console.error(`[monitorar-pasta-irpf] Erro no arquivo ${file.name}:`, fileError);
        erros++;
      }
    }

    const duracao = Date.now() - startTime;
    const restantes = totalPendentes - processados;

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'monitorar-pasta-irpf',
      status: erros === 0 ? 'sucesso' : 'parcial',
      duracao_ms: duracao,
      detalhes_execucao: {
        arquivos_neste_lote: files.length,
        total_pendentes: totalPendentes,
        processados,
        erros,
        restantes,
        has_more: restantes > 0,
      },
    });

    console.log(`[monitorar-pasta-irpf] Lote concluído: ${processados} processados, ${erros} erros, ${restantes} restantes`);

    return new Response(JSON.stringify({
      success: true,
      arquivos_neste_lote: files.length,
      total_pendentes: totalPendentes,
      processados,
      erros,
      restantes,
      has_more: restantes > 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[monitorar-pasta-irpf] Erro:', error);

    const duracao = Date.now() - startTime;
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'monitorar-pasta-irpf',
      status: 'erro',
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : 'Erro desconhecido',
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
