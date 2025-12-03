import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("Iniciando sincronização Tokeniza...");

    // Buscar token da API do ambiente
    const apiToken = Deno.env.get("TOKENIZA_API_TOKEN");
    if (!apiToken) {
      throw new Error("TOKENIZA_API_TOKEN não configurado");
    }

    const baseUrl = "https://plataforma.tokeniza.com.br/api";

    // Buscar todas as integrações Tokeniza ativas para identificar empresas
    const { data: integracoes, error: intError } = await supabase
      .from("integracao")
      .select("*")
      .eq("tipo", "TOKENIZA")
      .eq("ativo", true);

    if (intError) throw intError;

    if (!integracoes || integracoes.length === 0) {
      console.log("Nenhuma integração Tokeniza ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados = {
      investimentos: { success: 0, error: 0, errors: [] as string[] },
      vendas: { success: 0, error: 0, errors: [] as string[] },
      leads: { success: 0, error: 0, errors: [] as string[] },
    };

    const headers = {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    // Buscar dados dos endpoints
    console.log("Buscando dados do endpoint crowdfunding...");
    let crowdfundingData: any[] = [];
    try {
      const crowdfundingResponse = await fetch(`${baseUrl}/v1/backoffice/crowdfunding`, {
        method: "GET",
        headers,
      });
      
      if (crowdfundingResponse.ok) {
        const data = await crowdfundingResponse.json();
        crowdfundingData = Array.isArray(data) ? data : (data.data || data.items || []);
        console.log(`Crowdfunding: ${crowdfundingData.length} registros encontrados`);
      } else {
        const errorText = await crowdfundingResponse.text();
        console.error(`Erro crowdfunding: ${crowdfundingResponse.status} - ${errorText}`);
      }
    } catch (e) {
      console.error("Erro ao buscar crowdfunding:", e);
    }

    console.log("Buscando dados do endpoint automatic-sales...");
    let automaticSalesData: any[] = [];
    try {
      const automaticSalesResponse = await fetch(`${baseUrl}/v1/backoffice/automatic-sales`, {
        method: "GET",
        headers,
      });
      
      if (automaticSalesResponse.ok) {
        const data = await automaticSalesResponse.json();
        automaticSalesData = Array.isArray(data) ? data : (data.data || data.items || []);
        console.log(`Automatic Sales: ${automaticSalesData.length} registros encontrados`);
      } else {
        const errorText = await automaticSalesResponse.text();
        console.error(`Erro automatic-sales: ${automaticSalesResponse.status} - ${errorText}`);
      }
    } catch (e) {
      console.error("Erro ao buscar automatic-sales:", e);
    }

    // Processar cada integração (empresa)
    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = config.id_empresa;

      if (!idEmpresa) {
        console.error("Integração sem id_empresa configurado:", integracao.id_integracao);
        continue;
      }

      console.log(`Processando integração para empresa ${idEmpresa}`);

      // ========== SALVAR INVESTIMENTOS (CROWDFUNDING) ==========
      for (const inv of crowdfundingData) {
        try {
          const idExterno = inv.id;
          if (!idExterno) continue;

          const investimentoData = {
            id_externo: idExterno,
            id_empresa: idEmpresa,
            project_id: inv.project_id || null,
            user_id_tokeniza: inv.user_id || null,
            deposit_id: inv.deposit_id || null,
            amount: parseFloat(inv.amount || "0"),
            usd_amount: inv.usd_amount ? parseFloat(inv.usd_amount) : null,
            status: inv.status || "UNKNOWN",
            was_paid: inv.was_paid === true,
            fin_operation: inv.fin_operation === true,
            created_nft: inv.created_nft || null,
            bank_of_brazil_entry_hash: inv.bank_of_brazil_entry_hash || null,
            data_criacao: inv.created_at || new Date().toISOString(),
            data_atualizacao: inv.last_update || null,
          };

          const { error } = await supabase
            .from("tokeniza_investimento")
            .upsert(investimentoData, { onConflict: "id_externo" });

          if (error) {
            console.error(`Erro ao salvar investimento ${idExterno}:`, error);
            resultados.investimentos.error++;
            resultados.investimentos.errors.push(error.message);
          } else {
            resultados.investimentos.success++;
          }
        } catch (e) {
          console.error("Erro ao processar investimento:", e);
          resultados.investimentos.error++;
        }
      }

      // ========== SALVAR VENDAS AUTOMÁTICAS ==========
      for (const venda of automaticSalesData) {
        try {
          const idExterno = venda.id;
          if (!idExterno) continue;

          const vendaData = {
            id_externo: idExterno,
            id_empresa: idEmpresa,
            user_id_tokeniza: venda.userId || null,
            user_email: venda.userEmail || null,
            user_wallet_id: venda.userWalletId || null,
            external_id: venda.external_id || null,
            unit_of_money: venda.unit_of_money || null,
            unit_purchased: venda.unit_purchased || null,
            store_id: venda.storeId || null,
            status: venda.status || "UNKNOWN",
            transaction_id: venda.transactionId || null,
            payment_method: venda.paymentMethod || null,
            total_amount: parseFloat(venda.totalAmount || "0"),
            tokens_amount: venda.tokensAmount ? parseFloat(venda.tokensAmount) : null,
            tax_amount: venda.tax_amount ? parseFloat(venda.tax_amount) : null,
            shipping_amount: parseFloat(venda.shippingAmount || "0"),
            quantity: parseInt(venda.quantity || "0"),
            is_token_buy: venda.isTokenBuy === true,
            is_ticket_buy: venda.isTicketBuy === true,
            is_nft_buy: venda.isNftBuy === true,
            was_paid: venda.wasPaid === true,
            has_cashback: venda.has_cashback,
            asset_id: venda.assetId || null,
            nft_id: venda.nftId || null,
            package_id: venda.packageId || null,
            address_id: venda.address_id || null,
            indication_reward_status: venda.indication_reward_status || null,
            items: venda.items || [],
            data_criacao: venda.createdAt || new Date().toISOString(),
            data_expiracao: venda.expirationDate || null,
            data_atualizacao: venda.updatedAt || null,
          };

          const { error } = await supabase
            .from("tokeniza_venda")
            .upsert(vendaData, { onConflict: "id_externo" });

          if (error) {
            console.error(`Erro ao salvar venda ${idExterno}:`, error);
            resultados.vendas.error++;
            resultados.vendas.errors.push(error.message);
          } else {
            resultados.vendas.success++;

            // Se a venda foi paga e tem email, criar/atualizar lead
            if (venda.wasPaid && venda.userEmail) {
              const isPaid = venda.status === "finished" || venda.status === "completed";
              
              const leadData = {
                id_empresa: idEmpresa,
                id_lead_externo: `tokeniza_venda_${idExterno}`,
                data_criacao: venda.createdAt || new Date().toISOString(),
                origem_canal: "OUTRO" as const,
                origem_campanha: "tokeniza",
                email: venda.userEmail,
                nome_lead: null,
                is_mql: true,
                levantou_mao: true,
                tem_reuniao: false,
                reuniao_realizada: false,
                venda_realizada: isPaid,
                data_venda: isPaid ? (venda.updatedAt || venda.createdAt) : null,
                valor_venda: isPaid ? parseFloat(venda.totalAmount || "0") : null,
              };

              const { error: leadError } = await supabase
                .from("lead")
                .upsert(leadData, { onConflict: "id_lead_externo" });

              if (leadError) {
                console.error(`Erro ao criar lead para venda ${idExterno}:`, leadError);
                resultados.leads.error++;
              } else {
                resultados.leads.success++;
              }
            }
          }
        } catch (e) {
          console.error("Erro ao processar venda:", e);
          resultados.vendas.error++;
        }
      }

      // ========== CRIAR LEADS PARA INVESTIMENTOS PAGOS ==========
      for (const inv of crowdfundingData) {
        try {
          const idExterno = inv.id;
          if (!idExterno) continue;

          const isPaid = inv.status === "FINISHED" || inv.status === "PAID" || inv.was_paid === true;
          
          if (isPaid) {
            const leadData = {
              id_empresa: idEmpresa,
              id_lead_externo: `tokeniza_inv_${idExterno}`,
              data_criacao: inv.created_at || new Date().toISOString(),
              origem_canal: "OUTRO" as const,
              origem_campanha: "tokeniza_crowdfunding",
              is_mql: true,
              levantou_mao: true,
              tem_reuniao: false,
              reuniao_realizada: false,
              venda_realizada: true,
              data_venda: inv.last_update || inv.created_at,
              valor_venda: parseFloat(inv.amount || "0"),
            };

            const { error: leadError } = await supabase
              .from("lead")
              .upsert(leadData, { onConflict: "id_lead_externo" });

            if (leadError) {
              console.error(`Erro ao criar lead para investimento ${idExterno}:`, leadError);
              resultados.leads.error++;
            } else {
              resultados.leads.success++;
            }
          }
        } catch (e) {
          console.error("Erro ao criar lead de investimento:", e);
          resultados.leads.error++;
        }
      }
    }

    const duracao = Date.now() - startTime;
    const totalErrors = resultados.investimentos.error + resultados.vendas.error + resultados.leads.error;
    const totalSuccess = resultados.investimentos.success + resultados.vendas.success + resultados.leads.success;

    // Registrar execução do cronjob
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "sincronizar-tokeniza",
      status: totalErrors > 0 && totalSuccess === 0 ? "error" : "success",
      duracao_ms: duracao,
      mensagem_erro: totalErrors > 0 ? [...resultados.investimentos.errors, ...resultados.vendas.errors].slice(0, 3).join("; ") : null,
      detalhes_execucao: {
        crowdfunding_encontrados: crowdfundingData.length,
        automatic_sales_encontrados: automaticSalesData.length,
        investimentos_salvos: resultados.investimentos.success,
        investimentos_erros: resultados.investimentos.error,
        vendas_salvas: resultados.vendas.success,
        vendas_erros: resultados.vendas.error,
        leads_criados: resultados.leads.success,
        leads_erros: resultados.leads.error,
      },
    });

    console.log(`Sincronização Tokeniza concluída em ${duracao}ms`);
    console.log(`Investimentos: ${resultados.investimentos.success} sucesso, ${resultados.investimentos.error} erros`);
    console.log(`Vendas: ${resultados.vendas.success} sucesso, ${resultados.vendas.error} erros`);
    console.log(`Leads: ${resultados.leads.success} sucesso, ${resultados.leads.error} erros`);
    
    if (totalErrors > 0 && totalSuccess === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Erro ao sincronizar com Tokeniza",
          resultados 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Sincronização concluída`,
        dados: {
          crowdfunding: crowdfundingData.length,
          automaticSales: automaticSalesData.length,
        },
        resultados 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const duracao = Date.now() - startTime;
    console.error("Erro na função:", error);

    // Registrar erro
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "sincronizar-tokeniza",
      status: "error",
      duracao_ms: duracao,
      mensagem_erro: String(error),
    });

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
