import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const MAX_EXECUTION_MS = 50000;
const ID_EMPRESA_BLUE = '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db';

// ===== Service Account JWT -> Access Token =====
function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessTokenFromServiceAccount(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${headerB64}.${payloadB64}`;

  const keyBytes = pemToBinary(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(toSign));
  const signature = base64UrlEncode(new Uint8Array(sigBuffer));
  const jwt = `${toSign}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Falha ao obter access token (Service Account): ${err}`);
  }
  const { access_token } = await resp.json();
  return access_token;
}

// Service Accounts precisam de supportsAllDrives quando a pasta está em Shared Drive ou compartilhada
const DRIVE_COMMON_QS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let customBatchSize = BATCH_SIZE;
    try {
      const body = await req.json();
      if (body?.batch_size && typeof body.batch_size === 'number') {
        customBatchSize = Math.min(body.batch_size, 10);
      }
    } catch { /* sem body */ }

    const saJson = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    const folderId = Deno.env.get('GOOGLE_DRIVE_IRPF_FOLDER_ID');
    if (!saJson || !folderId) {
      throw new Error('Secrets GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_IRPF_FOLDER_ID não configurados');
    }

    console.log(`[monitorar-pasta-irpf] Iniciando (batch_size=${customBatchSize}, folder=${folderId})`);

    const accessToken = await getAccessTokenFromServiceAccount(saJson);

    // Listar PDFs
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,createdTime),nextPageToken&pageSize=${customBatchSize}&orderBy=createdTime&${DRIVE_COMMON_QS}`;
    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!listResponse.ok) {
      const listError = await listResponse.text();
      console.error('[monitorar-pasta-irpf] Erro ao listar:', listError);
      throw new Error(`Falha ao listar arquivos: ${listError}`);
    }

    const listData = await listResponse.json();
    const files = listData.files || [];
    const hasMore = !!listData.nextPageToken;

    let totalPendentes = files.length;
    if (hasMore) {
      const countUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id)&pageSize=1000&${DRIVE_COMMON_QS}`;
      const countResponse = await fetch(countUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (countResponse.ok) {
        const countData = await countResponse.json();
        totalPendentes = countData.files?.length || files.length;
      }
    }

    console.log(`[monitorar-pasta-irpf] ${files.length} PDFs neste lote, ${totalPendentes} total pendentes`);

    // Garantir pasta "processados"
    let processadosFolderId: string | null = null;
    const checkFolderUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name='processados'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&${DRIVE_COMMON_QS}`;
    const checkFolderResponse = await fetch(checkFolderUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const checkData = await checkFolderResponse.json();
    processadosFolderId = checkData.files?.[0]?.id || null;

    if (!processadosFolderId) {
      const createFolderResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${DRIVE_COMMON_QS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'processados',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        }),
      });
      const newFolder = await createFolderResponse.json();
      processadosFolderId = newFolder.id;
    }

    let processados = 0;
    let erros = 0;

    for (const file of files) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log('[monitorar-pasta-irpf] Próximo do timeout, parando lote');
        break;
      }

      try {
        console.log(`[monitorar-pasta-irpf] Processando: ${file.name}`);

        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&${DRIVE_COMMON_QS}`;
        const downloadResponse = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!downloadResponse.ok) {
          console.error(`[monitorar-pasta-irpf] Erro ao baixar ${file.name}: ${await downloadResponse.text()}`);
          erros++;
          continue;
        }

        const pdfBuffer = await downloadResponse.arrayBuffer();
        // Conversão segura para base64 (evita stack overflow em arquivos grandes)
        const bytes = new Uint8Array(pdfBuffer);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const pdfBase64 = btoa(binary);

        const { data: processResult, error: processError } = await supabase.functions.invoke('processar-irpf', {
          body: {
            pdfBase64,
            id_empresa: ID_EMPRESA_BLUE,
            arquivo_origem: `gdrive:${file.name}`,
          },
        });

        if (processError || !processResult?.success) {
          console.error(`[monitorar-pasta-irpf] Erro ao processar ${file.name}:`, processError || processResult?.error);
          erros++;
          continue;
        }

        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${processadosFolderId}&removeParents=${folderId}&${DRIVE_COMMON_QS}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
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
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
