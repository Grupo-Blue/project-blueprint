import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateApiKey } from "../_shared/api-key-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-empresa-id, x-arquivo-nome",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_EMPRESA_BLUE = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";

/**
 * Endpoint público (autenticado por API key) para envio de PDFs de IRPF.
 *
 * Aceita 3 formatos:
 *  1. JSON: { pdfBase64: string, id_empresa?: string, arquivo_origem?: string }
 *  2. multipart/form-data: campo "file" (PDF binário) + opcional "id_empresa", "arquivo_origem"
 *  3. application/pdf cru (binário) — id_empresa via header x-empresa-id, nome via x-arquivo-nome
 *
 * Auth: header `x-api-key: sgt_xxx...` (ou Authorization: Bearer sgt_xxx...).
 *       A API key precisa ter a permissão "irpf:upload".
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  // --- Auth via API key ---
  const apiKey = await validateApiKey(req, "irpf:upload");
  if (!apiKey) {
    return json({ error: "API key inválida ou sem permissão 'irpf:upload'" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let pdfBase64: string | null = null;
    let arquivoOrigem = "api-upload.pdf";
    let idEmpresa: string | null = null;

    const contentType = req.headers.get("content-type")?.toLowerCase() || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      pdfBase64 = body.pdfBase64 || body.pdf_base64 || null;
      arquivoOrigem = body.arquivo_origem || body.nome_arquivo || arquivoOrigem;
      idEmpresa = body.id_empresa || null;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return json({ error: "Campo 'file' obrigatório no form-data" }, 400);
      arquivoOrigem = file.name || arquivoOrigem;
      idEmpresa = (form.get("id_empresa") as string) || null;
      const buf = await file.arrayBuffer();
      pdfBase64 = arrayBufferToBase64(buf);
    } else {
      // Binário cru — assumimos PDF
      const buf = await req.arrayBuffer();
      if (!buf || buf.byteLength === 0) return json({ error: "Body vazio" }, 400);
      pdfBase64 = arrayBufferToBase64(buf);
      arquivoOrigem = req.headers.get("x-arquivo-nome") || arquivoOrigem;
      idEmpresa = req.headers.get("x-empresa-id");
    }

    // Resolver empresa: prioridade body > header > empresa da API key > default Tokeniza
    if (!idEmpresa && apiKey.empresa) idEmpresa = apiKey.empresa;
    if (!idEmpresa) idEmpresa = DEFAULT_EMPRESA_BLUE;

    if (!pdfBase64) {
      return json({ error: "PDF não enviado. Use pdfBase64 (JSON), file (form-data) ou body binário." }, 400);
    }

    // Sanity check tamanho (~ base64 1.37x do binário). Limite ~25MB de PDF.
    const approxBytes = (pdfBase64.length * 3) / 4;
    if (approxBytes > 25 * 1024 * 1024) {
      return json({ error: "PDF maior que 25MB. Reduza o arquivo." }, 413);
    }

    console.log(`[irpf-upload-api] key=${apiKey.id} empresa=${idEmpresa} arquivo=${arquivoOrigem} (~${Math.round(approxBytes / 1024)}KB)`);

    // Invoca processador IRPF (síncrono — retorna nome/exercicio quando ok)
    const { data, error } = await supabase.functions.invoke("processar-irpf", {
      body: {
        pdfBase64,
        id_empresa: idEmpresa,
        arquivo_origem: `api:${arquivoOrigem}`,
      },
    });

    if (error || !data?.success) {
      const msg = error?.message || data?.error || "Falha ao processar IRPF";
      console.error(`[irpf-upload-api] erro: ${msg}`);
      return json({ success: false, error: msg }, 422);
    }

    return json({
      success: true,
      arquivo: arquivoOrigem,
      id_empresa: idEmpresa,
      nome: data.nome,
      cpf: data.cpf,
      exercicio: data.exercicio,
      id_declaracao: data.id_declaracao,
    });
  } catch (err: any) {
    console.error("[irpf-upload-api] erro inesperado:", err);
    return json({ success: false, error: err?.message || "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
