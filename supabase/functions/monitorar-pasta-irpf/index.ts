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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('[monitorar-pasta-irpf] Iniciando monitoramento...');

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

    // Listar arquivos PDF na pasta
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${config.folder_id}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,createdTime)`;
    
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!listResponse.ok) {
      const listError = await listResponse.text();
      console.error('[monitorar-pasta-irpf] Erro ao listar arquivos:', listError);
      throw new Error('Falha ao listar arquivos');
    }

    const { files } = await listResponse.json();
    console.log(`[monitorar-pasta-irpf] Encontrados ${files?.length || 0} PDFs`);

    let processados = 0;
    let erros = 0;

    for (const file of files || []) {
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
            id_empresa: integracao.id_empresa,
            arquivo_origem: `gdrive:${file.name}`,
          },
        });

        if (processError || !processResult?.success) {
          console.error(`[monitorar-pasta-irpf] Erro ao processar ${file.name}:`, processError || processResult?.error);
          erros++;
          continue;
        }

        // Criar/verificar pasta "processados"
        const checkFolderUrl = `https://www.googleapis.com/drive/v3/files?q='${config.folder_id}'+in+parents+and+name='processados'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`;
        const checkFolderResponse = await fetch(checkFolderUrl, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        
        const { files: existingFolders } = await checkFolderResponse.json();
        let processadosFolderId = existingFolders?.[0]?.id;

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

    // Registrar execução
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'monitorar-pasta-irpf',
      status: erros === 0 ? 'sucesso' : 'parcial',
      duracao_ms: duracao,
      detalhes_execucao: {
        arquivos_encontrados: files?.length || 0,
        processados,
        erros,
      },
    });

    console.log(`[monitorar-pasta-irpf] Concluído: ${processados} processados, ${erros} erros`);

    return new Response(JSON.stringify({
      success: true,
      arquivos_encontrados: files?.length || 0,
      processados,
      erros,
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
