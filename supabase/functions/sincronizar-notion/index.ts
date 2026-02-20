import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizarTelefone(tel: string | null): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Iniciando sincronização com Notion...");

    // Buscar integrações Notion ativas
    const { data: integracoes, error: intError } = await supabaseClient
      .from("integracao")
      .select("*")
      .eq("tipo", "NOTION")
      .eq("ativo", true);

    if (intError) throw intError;
    if (!integracoes || integracoes.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma integração Notion ativa encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = [];

    for (const integracao of integracoes) {
      console.log(`Processando integração: ${integracao.id_integracao}`);
      
      const config = integracao.config_json as any;
      const apiToken = config.api_token;
      const databaseId = config.database_id || "1d52e840ab4f80eeac8ad56aed5b5b6e";

      try {
        let hasMore = true;
        let startCursor: string | undefined = undefined;
        let totalPages = 0;
        let clientesSyncados = 0;
        let leadsAtualizados = 0;

        while (hasMore) {
          totalPages++;
          console.log(`Buscando página ${totalPages} do Notion... (cursor: ${startCursor || 'início'})`);

          const bodyPayload: any = { page_size: 100 };
          if (startCursor) bodyPayload.start_cursor = startCursor;

          const notionResponse = await fetch(
            `https://api.notion.com/v1/databases/${databaseId}/query`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(bodyPayload),
            }
          );

          if (!notionResponse.ok) {
            const errorText = await notionResponse.text();
            throw new Error(`Erro Notion API: ${notionResponse.status} - ${errorText}`);
          }

          const notionData = await notionResponse.json();
          console.log(`Página ${totalPages}: ${notionData.results.length} registros`);

          for (const page of notionData.results) {
            const props = page.properties;

            // Extrair campos principais
            const nome = props["Nome do Cliente"]?.title?.[0]?.plain_text || "";
            const cpfCnpj = props["CPF/CNPJ"]?.rich_text?.[0]?.plain_text || null;
            const telefone = props["Telefone"]?.phone_number || null;
            const dataNascimento = props["Data de Nascimento"]?.date?.start || null;
            const email = props["E-mail Principal"]?.email || null;
            const emailSecundario = props["E-mail Secundário"]?.email || null;
            
            // Status - nome correto do campo no Notion (i minúsculo)
            const clienteInativo = props["Cliente inativo?"]?.checkbox || props["Cliente Inativo?"]?.checkbox || false;
            const statusCliente = clienteInativo ? "ex_cliente" : "cliente";

            // Multi-selects
            const produtos = props["Produto"]?.multi_select?.map((p: any) => p.name) || [];
            const anosFiscais = props["Ano Fiscal"]?.multi_select?.map((a: any) => {
              const ano = parseInt(a.name);
              return isNaN(ano) ? null : ano;
            }).filter((a: number | null) => a !== null) || [];

            // Campos extras
            const cidade = props["Cidade"]?.rich_text?.[0]?.plain_text || null;
            const cep = props["CEP"]?.rich_text?.[0]?.plain_text || null;
            const endereco = props["Endereço"]?.rich_text?.[0]?.plain_text || null;
            const perfilCliente = props["Perfil do cliente"]?.select?.name || null;
            const motivoCancelamento = props["Motivo de Cancelamento"]?.select?.name || null;
            const dataCancelamento = props["Data de Cancelamento"]?.date?.start || null;
            const tag = props["Tag"]?.select?.name || null;
            const urlGoogleDrive = props["URL Google Drive"]?.url || null;
            const vencimentoProcuracao = props["Vencimento Procuração"]?.date?.start || null;
            const apuracaoB3 = props["Apuração B3"]?.select?.name || props["Apuração B3"]?.checkbox !== undefined ? (props["Apuração B3"]?.checkbox ? "Sim" : "Não") : null;
            const telefoneSecundario = props["Telefone 1"]?.phone_number || null;

            // Upsert em cliente_notion
            const { data: clienteData, error: clienteError } = await supabaseClient
              .from("cliente_notion")
              .upsert(
                {
                  id_notion: page.id,
                  nome,
                  cpf_cnpj: cpfCnpj,
                  telefone,
                  data_nascimento: dataNascimento,
                  email,
                  email_secundario: emailSecundario,
                  status_cliente: statusCliente,
                  produtos_contratados: produtos,
                  anos_fiscais: anosFiscais,
                  last_edited_time: page.last_edited_time,
                  cidade,
                  cep,
                  endereco,
                  perfil_cliente: perfilCliente,
                  motivo_cancelamento: motivoCancelamento,
                  data_cancelamento: dataCancelamento,
                  tag,
                  url_google_drive: urlGoogleDrive,
                  vencimento_procuracao: vencimentoProcuracao,
                  apuracao_b3: apuracaoB3,
                  telefone_secundario: telefoneSecundario,
                },
                { onConflict: "id_notion" }
              )
              .select()
              .single();

            if (clienteError) {
              console.error(`Erro ao upsert cliente ${nome}:`, clienteError);
              continue;
            }

            clientesSyncados++;

            // Match com leads por email (principal e secundário)
            const emailsMatch = [email, emailSecundario].filter(Boolean) as string[];
            
            if (emailsMatch.length > 0) {
              const { data: leadsMatch, error: leadsError } = await supabaseClient
                .from("lead")
                .select("id_lead")
                .in("email", emailsMatch);

              if (!leadsError && leadsMatch && leadsMatch.length > 0) {
                for (const lead of leadsMatch) {
                  const { error: updateError } = await supabaseClient
                    .from("lead")
                    .update({
                      id_cliente_notion: clienteData.id_cliente,
                      cliente_status: statusCliente,
                    })
                    .eq("id_lead", lead.id_lead);

                  if (!updateError) leadsAtualizados++;
                }
              }
            }

            // Match por telefone
            const telefonesNorm = [normalizarTelefone(telefone), normalizarTelefone(telefoneSecundario)].filter(Boolean) as string[];
            
            if (telefonesNorm.length > 0) {
              const { data: leadsPhone, error: phoneError } = await supabaseClient
                .from("lead")
                .select("id_lead")
                .is("id_cliente_notion", null)
                .in("telefone", telefonesNorm);

              if (!phoneError && leadsPhone && leadsPhone.length > 0) {
                for (const lead of leadsPhone) {
                  const { error: updateError } = await supabaseClient
                    .from("lead")
                    .update({
                      id_cliente_notion: clienteData.id_cliente,
                      cliente_status: statusCliente,
                    })
                    .eq("id_lead", lead.id_lead);

                  if (!updateError) leadsAtualizados++;
                }
              }
            }
          }

          // Paginação
          hasMore = notionData.has_more === true;
          startCursor = notionData.next_cursor || undefined;
        }

        resultados.push({
          integracao_id: integracao.id_integracao,
          status: "success",
          paginas_processadas: totalPages,
          clientes_syncados: clientesSyncados,
          leads_atualizados: leadsAtualizados,
        });

        console.log(`✅ Sincronização concluída: ${totalPages} páginas, ${clientesSyncados} clientes, ${leadsAtualizados} leads atualizados`);

      } catch (error: any) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({
          integracao_id: integracao.id_integracao,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Sincronização Notion concluída",
        resultados,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
