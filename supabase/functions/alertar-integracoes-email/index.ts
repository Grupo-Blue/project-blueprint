import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface IntegracaoStatus {
  tipo: string;
  configurada: boolean;
  funcionando: boolean | null;
  ultimaExecucao: string | null;
  erro: string | null;
}

interface EmpresaRelatorio {
  nome: string;
  id: string;
  integracoes: IntegracaoStatus[];
}

const TIPOS_INTEGRACAO = ["META_ADS", "GOOGLE_ADS", "PIPEDRIVE", "TOKENIZA", "MAUTIC", "NOTION", "METRICOOL", "CHATWOOT", "GA4", "STAPE"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[alertar-integracoes-email] Iniciando verificação...");

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const alertEmailTo = Deno.env.get("ALERT_EMAIL_TO");

    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY não configurada");
    }
    if (!alertEmailTo) {
      throw new Error("ALERT_EMAIL_TO não configurado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar todas as empresas
    const { data: empresas, error: empresasError } = await supabase
      .from("empresa")
      .select("id_empresa, nome")
      .order("nome");

    if (empresasError) throw empresasError;

    // Buscar todas as integrações configuradas
    const { data: integracoes, error: integracoesError } = await supabase
      .from("integracao")
      .select("*")
      .eq("ativo", true);

    if (integracoesError) throw integracoesError;

    // Buscar últimas execuções de cronjobs relevantes (últimas 24h)
    const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: execucoes, error: execucoesError } = await supabase
      .from("cronjob_execucao")
      .select("*")
      .gte("data_execucao", ontemISO)
      .order("data_execucao", { ascending: false });

    if (execucoesError) throw execucoesError;

    // Mapear integrações por empresa (usando nova coluna id_empresa)
    const integracoesPorEmpresa = new Map<string, any[]>();
    for (const integ of integracoes || []) {
      const empresaId = integ.id_empresa;
      if (empresaId) {
        if (!integracoesPorEmpresa.has(empresaId)) {
          integracoesPorEmpresa.set(empresaId, []);
        }
        integracoesPorEmpresa.get(empresaId)!.push(integ);
      }
    }

    // Mapear últimas execuções por cronjob
    const ultimasExecucoes = new Map<string, any>();
    for (const exec of execucoes || []) {
      if (!ultimasExecucoes.has(exec.nome_cronjob)) {
        ultimasExecucoes.set(exec.nome_cronjob, exec);
      }
    }

    // Montar relatório por empresa
    const relatorio: EmpresaRelatorio[] = [];
    const empresasComProblemas: EmpresaRelatorio[] = [];

    for (const empresa of empresas || []) {
      const integsEmpresa = integracoesPorEmpresa.get(empresa.id_empresa) || [];
      const statusIntegracoes: IntegracaoStatus[] = [];

      for (const tipo of TIPOS_INTEGRACAO) {
        const integ = integsEmpresa.find((i) => i.tipo === tipo);
        
        if (integ) {
          // Verificar se a integração está funcionando baseado nos cronjobs
          const cronjobMap: Record<string, string> = {
            "META_ADS": "coletar-metricas-meta",
            "GOOGLE_ADS": "coletar-metricas-google",
            "PIPEDRIVE": "sincronizar-pipedrive",
            "TOKENIZA": "sincronizar-tokeniza",
            "MAUTIC": "enriquecer-lead-mautic",
            "NOTION": "sincronizar-notion",
            "METRICOOL": "sincronizar-metricool",
            "CHATWOOT": "chatwoot-webhook",
            "GA4": "coletar-metricas-ga4",
            "STAPE": "stape-webhook",
          };
          const cronjobNome = cronjobMap[tipo] || "";

          const ultimaExec = ultimasExecucoes.get(cronjobNome);
          const funcionando = ultimaExec?.status === "sucesso";
          const erro = ultimaExec?.status === "erro" ? ultimaExec.mensagem_erro : null;

          statusIntegracoes.push({
            tipo,
            configurada: true,
            funcionando,
            ultimaExecucao: ultimaExec?.data_execucao || null,
            erro,
          });

          // Se configurada mas não funcionando, marcar como problema
          if (!funcionando && ultimaExec?.status === "erro") {
            // Será adicionado às empresas com problemas
          }
        } else {
          statusIntegracoes.push({
            tipo,
            configurada: false,
            funcionando: null,
            ultimaExecucao: null,
            erro: null,
          });
        }
      }

      const empresaRelatorio: EmpresaRelatorio = {
        nome: empresa.nome,
        id: empresa.id_empresa,
        integracoes: statusIntegracoes,
      };

      relatorio.push(empresaRelatorio);

      // Verificar se tem problemas (integração configurada mas com erro)
      const temProblemas = statusIntegracoes.some(
        (i) => i.configurada && i.funcionando === false && i.erro
      );
      if (temProblemas) {
        empresasComProblemas.push(empresaRelatorio);
      }
    }

    // Gerar HTML do email
    const html = gerarHtmlEmail(empresasComProblemas, relatorio);

    // Enviar email via Brevo
    const toEmails = alertEmailTo.split(",").map((e) => ({ email: e.trim() }));
    
    const emailResponse = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "SGT Alertas",
          email: "noreply@grupoblue.com.br",
        },
        to: toEmails,
        subject: `[SGT] Relatório de Integrações - ${new Date().toLocaleDateString("pt-BR")}`,
        htmlContent: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Erro ao enviar email via Brevo: ${emailResponse.status} - ${errorData}`);
    }

    const emailResult = await emailResponse.json();
    console.log("[alertar-integracoes-email] Email enviado via Brevo:", emailResult);

    // Registrar execução
    const duracao = Date.now() - startTime;
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "alertar-integracoes-email",
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        empresas_total: empresas?.length || 0,
        empresas_com_problemas: empresasComProblemas.length,
        email_enviado_para: alertEmailTo,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        empresas_verificadas: empresas?.length || 0,
        empresas_com_problemas: empresasComProblemas.length,
        email_enviado: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[alertar-integracoes-email] Erro:", error);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "alertar-integracoes-email",
      status: "erro",
      mensagem_erro: error.message,
      duracao_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function gerarHtmlEmail(
  empresasComProblemas: EmpresaRelatorio[],
  todasEmpresas: EmpresaRelatorio[]
): string {
  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tipoLabel: Record<string, string> = {
    META_ADS: "Meta Ads",
    GOOGLE_ADS: "Google Ads",
    PIPEDRIVE: "Pipedrive",
    TOKENIZA: "Tokeniza",
    MAUTIC: "Mautic",
    NOTION: "Notion",
    METRICOOL: "Metricool",
    CHATWOOT: "Chatwoot",
    GA4: "GA4",
    STAPE: "Stape",
  };

  // Seção de problemas só aparece se houver problemas
  let problemasHtml = "";
  if (empresasComProblemas.length > 0) {
    problemasHtml = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h2 style="color: #dc2626; margin: 0 0 16px 0; font-size: 18px;">
          ⚠️ ${empresasComProblemas.length} Empresa(s) com Integrações com Problema
        </h2>
        ${empresasComProblemas
          .map(
            (empresa) => `
          <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
            <strong style="color: #1f2937;">${empresa.nome}</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              ${empresa.integracoes
                .filter((i) => i.configurada && i.funcionando === false)
                .map(
                  (i) => `
                <li style="color: #dc2626;">
                  ${tipoLabel[i.tipo] || i.tipo}: ${i.erro || "Erro desconhecido"}
                  ${i.ultimaExecucao ? `<br><small style="color: #6b7280;">Última execução: ${new Date(i.ultimaExecucao).toLocaleString("pt-BR")}</small>` : ""}
                </li>
              `
                )
                .join("")}
            </ul>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // Tabela de todas as empresas
  const tabelaEmpresas = `
    <h2 style="color: #1f2937; margin: 24px 0 16px 0; font-size: 18px;">
      📊 Status de Todas as Empresas
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="text-align: left; padding: 12px; border: 1px solid #e5e7eb;">Empresa</th>
          ${TIPOS_INTEGRACAO.map(
            (tipo) =>
              `<th style="text-align: center; padding: 12px; border: 1px solid #e5e7eb;">${tipoLabel[tipo]}</th>`
          ).join("")}
        </tr>
      </thead>
      <tbody>
        ${todasEmpresas
          .map(
            (empresa) => `
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 500;">${empresa.nome}</td>
            ${TIPOS_INTEGRACAO.map((tipo) => {
              const integ = empresa.integracoes.find((i) => i.tipo === tipo);
              if (!integ || !integ.configurada) {
                return `<td style="text-align: center; padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; color: #9ca3af;">—</td>`;
              }
              if (integ.funcionando) {
                return `<td style="text-align: center; padding: 12px; border: 1px solid #e5e7eb; background-color: #f0fdf4; color: #16a34a;">✅</td>`;
              }
              return `<td style="text-align: center; padding: 12px; border: 1px solid #e5e7eb; background-color: #fef2f2; color: #dc2626;">❌</td>`;
            }).join("")}
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">
      Legenda: ✅ Funcionando | ❌ Com erro | — Não configurada
    </p>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; color: white;">
          <h1 style="margin: 0; font-size: 24px;">📡 Relatório de Integrações SGT</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">${dataHoje}</p>
        </div>
        
        <div style="padding: 24px;">
          ${problemasHtml}
          ${tabelaEmpresas}
        </div>
        
        <div style="background-color: #f3f4f6; padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">Este é um email automático do Sistema de Gestão de Tráfego (SGT)</p>
          <p style="margin: 4px 0 0 0;">Blue Consult • ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
