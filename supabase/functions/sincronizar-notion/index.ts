import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        // Query no database do Notion
        const notionResponse = await fetch(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiToken}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              page_size: 100,
            }),
          }
        );

        if (!notionResponse.ok) {
          const errorText = await notionResponse.text();
          throw new Error(`Erro Notion API: ${notionResponse.status} - ${errorText}`);
        }

        const notionData = await notionResponse.json();
        console.log(`Encontrados ${notionData.results.length} registros no Notion`);

        let clientesSyncados = 0;
        let leadsAtualizados = 0;

        for (const page of notionData.results) {
          const props = page.properties;

          // Extrair campos do Notion
          const nome = props["Nome do Cliente"]?.title?.[0]?.plain_text || "";
          const cpfCnpj = props["CPF/CNPJ"]?.rich_text?.[0]?.plain_text || null;
          const telefone = props["Telefone"]?.phone_number || null;
          const dataNascimento = props["Data de Nascimento"]?.date?.start || null;
          const email = props["E-mail Principal"]?.email || null;
          const emailSecundario = props["E-mail Secundário"]?.email || null;
          
          // Determinar status baseado no checkbox "Cliente Inativo?"
          const clienteInativo = props["Cliente Inativo?"]?.checkbox || false;
          const statusCliente = clienteInativo ? "ex_cliente" : "cliente";

          // Extrair produtos (multi-select)
          const produtos = props["Produto"]?.multi_select?.map((p: any) => p.name) || [];
          
          // Extrair anos fiscais (multi-select convertido para números)
          const anosFiscais = props["Ano Fiscal"]?.multi_select?.map((a: any) => {
            const ano = parseInt(a.name);
            return isNaN(ano) ? null : ano;
          }).filter((a: number | null) => a !== null) || [];

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
          if (email || emailSecundario) {
            const emailsMatch = [email, emailSecundario].filter(Boolean);
            
            const { data: leadsMatch, error: leadsError } = await supabaseClient
              .from("lead")
              .select("id_lead")
              .in("email", emailsMatch);

            if (!leadsError && leadsMatch && leadsMatch.length > 0) {
              // Atualizar leads encontrados
              for (const lead of leadsMatch) {
                const { error: updateError } = await supabaseClient
                  .from("lead")
                  .update({
                    id_cliente_notion: clienteData.id_cliente,
                    cliente_status: statusCliente,
                  })
                  .eq("id_lead", lead.id_lead);

                if (!updateError) {
                  leadsAtualizados++;
                }
              }
            }
          }
        }

        resultados.push({
          integracao_id: integracao.id_integracao,
          status: "success",
          clientes_syncados: clientesSyncados,
          leads_atualizados: leadsAtualizados,
        });

        console.log(`✅ Sincronização concluída: ${clientesSyncados} clientes, ${leadsAtualizados} leads atualizados`);

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
