import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sanitizeEmail(raw: string): string {
  const md = raw?.match(/\[([^\]]+)\]\(mailto:[^)]+\)/i);
  if (md) return md[1].trim();
  return (raw || '').trim();
}
async function getToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sanitizeEmail(sa.client_email),
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const toSign = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToBinary(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${b64url(new Uint8Array(sig))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!r.ok) throw new Error(`token: ${await r.text()}`);
  return (await r.json()).access_token;
}

const COMMON = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const saJson = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON')!;
    const folderId = Deno.env.get('GOOGLE_DRIVE_IRPF_FOLDER_ID')!;
    const token = await getToken(saJson);

    // 1. Pasta acessível?
    const folderMeta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,driveId,owners(emailAddress),capabilities,trashed&${COMMON}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const folderInfo = folderMeta.ok ? await folderMeta.json() : { error: await folderMeta.text(), status: folderMeta.status };

    // 2. Listar TUDO (sem filtro de mime, sem trashed filter)
    const listAll = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,trashed,createdTime,owners(emailAddress),parents,size)&pageSize=200&${COMMON}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const allData = listAll.ok ? await listAll.json() : { error: await listAll.text(), status: listAll.status };

    const files = allData.files || [];
    const subpastas = files.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
    const pdfs = files.filter((f: any) => f.mimeType === 'application/pdf');
    const outros = files.filter((f: any) =>
      f.mimeType !== 'application/vnd.google-apps.folder' && f.mimeType !== 'application/pdf'
    );

    // 3. Listar PDFs em subpastas (1 nível)
    const pdfsEmSubpastas: any[] = [];
    for (const sub of subpastas.slice(0, 10)) {
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${sub.id}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,createdTime)&pageSize=50&${COMMON}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const d = await r.json();
        pdfsEmSubpastas.push({ subpasta: sub.name, id: sub.id, qtd: d.files?.length || 0, exemplos: (d.files || []).slice(0, 3).map((f: any) => f.name) });
      }
    }

    return new Response(JSON.stringify({
      folder_id: folderId,
      folder_meta: folderInfo,
      total_itens_raiz: files.length,
      pdfs_raiz: { qtd: pdfs.length, exemplos: pdfs.slice(0, 5).map((f: any) => ({ name: f.name, trashed: f.trashed, createdTime: f.createdTime, owner: f.owners?.[0]?.emailAddress })) },
      subpastas: { qtd: subpastas.length, lista: subpastas.map((f: any) => ({ name: f.name, id: f.id })) },
      outros_mime: { qtd: outros.length, lista: outros.slice(0, 10).map((f: any) => ({ name: f.name, mimeType: f.mimeType })) },
      pdfs_em_subpastas: pdfsEmSubpastas,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
