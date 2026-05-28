// Utilitários para gerir saúde de integrações (auto-disable + alerta).
// Usado pelas funções de coleta quando detectam invalid_grant / code 190 / falhas críticas.

import type { ValidacaoResultado } from "./validar.ts";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export type RegistrarSaudeOpts = {
  supabase: any;
  idIntegracao: string;
  tipo: string;
  nomeEmpresa?: string;
};

// Marca integração como saudável (limpa último erro, atualiza ultima_validacao).
export async function registrarSucesso(opts: RegistrarSaudeOpts) {
  const { supabase, idIntegracao } = opts;
  await supabase
    .from("integracao")
    .update({
      ultimo_erro: null,
      ultima_validacao: new Date().toISOString(),
    })
    .eq("id_integracao", idIntegracao);
}

// Marca integração com erro. Se for TOKEN_EXPIRED, desativa e dispara alerta.
export async function registrarFalha(opts: RegistrarSaudeOpts & {
  errorKind: ValidacaoResultado["errorKind"];
  errorMsg: string;
}) {
  const { supabase, idIntegracao, tipo, nomeEmpresa, errorKind, errorMsg } = opts;
  const agora = new Date().toISOString();

  // Buscar estado anterior para detectar transição (saudável → erro)
  const { data: anterior } = await supabase
    .from("integracao")
    .select("ativo, ultimo_erro")
    .eq("id_integracao", idIntegracao)
    .single();

  const desativar = errorKind === "TOKEN_EXPIRED" || errorKind === "UNAUTHENTICATED";
  const update: Record<string, any> = {
    ultimo_erro: `[${errorKind ?? "OTHER"}] ${errorMsg}`.slice(0, 1000),
    ultima_validacao: agora,
  };
  if (desativar) update.ativo = false;

  await supabase
    .from("integracao")
    .update(update)
    .eq("id_integracao", idIntegracao);

  // Disparar alerta APENAS na transição (não a cada coleta seguinte que vai falhar igual)
  const transicaoCritica = desativar && anterior?.ativo === true;
  if (transicaoCritica) {
    await tentarEnviarAlerta({ tipo, nomeEmpresa, errorKind, errorMsg });
  }
}

async function tentarEnviarAlerta(opts: {
  tipo: string;
  nomeEmpresa?: string;
  errorKind: ValidacaoResultado["errorKind"];
  errorMsg: string;
}) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const alertEmailTo = Deno.env.get("ALERT_EMAIL_TO");
  if (!brevoApiKey || !alertEmailTo) {
    console.warn("[saude_integracao] BREVO_API_KEY ou ALERT_EMAIL_TO ausentes — alerta não enviado");
    return;
  }

  const toEmails = alertEmailTo.split(",").map((e) => ({ email: e.trim() }));
  const empresaLabel = opts.nomeEmpresa ? ` (${opts.nomeEmpresa})` : "";
  const subject = `[SGT] Integração ${opts.tipo}${empresaLabel} foi desativada — ${opts.errorKind ?? "ERRO"}`;
  const html = `
    <h2>Integração desativada automaticamente</h2>
    <p><strong>Tipo:</strong> ${opts.tipo}</p>
    ${opts.nomeEmpresa ? `<p><strong>Empresa:</strong> ${opts.nomeEmpresa}</p>` : ""}
    <p><strong>Motivo:</strong> ${opts.errorKind ?? "OTHER"}</p>
    <p><strong>Mensagem:</strong> ${opts.errorMsg}</p>
    <p>A coleta automática parou para esta integração. Renove as credenciais na tela de Integrações para reativar.</p>
  `;

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "SGT Alertas", email: "noreply@grupoblue.com.br" },
        to: toEmails,
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("[saude_integracao] Brevo respondeu", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[saude_integracao] Falha ao enviar alerta:", err);
  }
}
