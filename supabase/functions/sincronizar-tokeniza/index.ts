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

    const resultados: any[] = [];
    const headers = {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    // Buscar dados dos 3 endpoints
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

    console.log("Buscando dados do endpoint readAllForUnit...");
    let readAllForUnitData: any[] = [];
    try {
      const readAllResponse = await fetch(`${baseUrl}/v1/backoffice/readAllForUnit`, {
        method: "GET",
        headers,
      });
      
      if (readAllResponse.ok) {
        const data = await readAllResponse.json();
        readAllForUnitData = Array.isArray(data) ? data : (data.data || data.items || []);
        console.log(`ReadAllForUnit: ${readAllForUnitData.length} registros encontrados`);
      } else {
        const errorText = await readAllResponse.text();
        console.error(`Erro readAllForUnit: ${readAllResponse.status} - ${errorText}`);
      }
    } catch (e) {
      console.error("Erro ao buscar readAllForUnit:", e);
    }

    // Log dos dados recebidos para análise
    if (crowdfundingData.length > 0) {
      console.log("Exemplo crowdfunding:", JSON.stringify(crowdfundingData[0], null, 2));
    }
    if (automaticSalesData.length > 0) {
      console.log("Exemplo automatic-sales:", JSON.stringify(automaticSalesData[0], null, 2));
    }
    if (readAllForUnitData.length > 0) {
      console.log("Exemplo readAllForUnit:", JSON.stringify(readAllForUnitData[0], null, 2));
    }

    // Processar cada integração (empresa)
    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = config.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}`);

      // Combinar dados de todos os endpoints
      const allSales = [...crowdfundingData, ...automaticSalesData, ...readAllForUnitData];
      
      for (const sale of allSales) {
        try {
          // Extrair ID único da venda
          const saleId = sale.id || sale._id || sale.order_id || sale.saleId || sale.investmentId;
          if (!saleId) {
            console.log("Registro sem ID, pulando:", sale);
            continue;
          }

          // Determinar status de pagamento (adaptar conforme estrutura real da API)
          const isPaid = 
            sale.status === "paid" || 
            sale.status === "completed" || 
            sale.status === "confirmed" ||
            sale.paymentStatus === "paid" ||
            sale.payment_status === "paid" ||
            sale.paid === true;
          
          const isCompleted = 
            sale.status === "completed" || 
            sale.status === "delivered" ||
            sale.status === "finished";

          // Extrair valor (adaptar conforme estrutura)
          const valor = parseFloat(
            sale.total || 
            sale.amount || 
            sale.value || 
            sale.investmentAmount ||
            sale.totalAmount ||
            "0"
          );

          // Extrair datas
          const dataCriacao = sale.created_at || sale.createdAt || sale.date || new Date().toISOString();
          const dataVenda = isPaid ? (sale.paid_at || sale.paidAt || sale.updated_at || sale.updatedAt || dataCriacao) : null;

          const leadData = {
            id_empresa: idEmpresa,
            id_lead_externo: String(saleId),
            data_criacao: dataCriacao,
            origem_canal: "OUTRO" as const,
            origem_campanha: sale.utm_source || sale.source || sale.campaign || "tokeniza",
            utm_source: sale.utm_source || sale.utmSource || null,
            utm_medium: sale.utm_medium || sale.utmMedium || null,
            utm_campaign: sale.utm_campaign || sale.utmCampaign || null,
            utm_content: sale.utm_content || sale.utmContent || null,
            is_mql: isPaid,
            levantou_mao: isPaid,
            tem_reuniao: false,
            reuniao_realizada: false,
            venda_realizada: isPaid && isCompleted,
            data_venda: dataVenda,
            valor_venda: isPaid ? valor : null,
            nome_lead: sale.investor?.name || sale.investorName || sale.name || sale.customer?.name || null,
            email: sale.investor?.email || sale.investorEmail || sale.email || sale.customer?.email || null,
          };

          // Inserir ou atualizar lead
          const { data: leadInserido, error: leadError } = await supabase
            .from("lead")
            .upsert(leadData, { 
              onConflict: "id_lead_externo",
              ignoreDuplicates: false 
            })
            .select()
            .single();

          if (leadError) {
            console.error(`Erro ao salvar lead ${saleId}:`, leadError);
            resultados.push({ sale: saleId, status: "error", error: leadError.message });
            continue;
          }

          // Registrar evento de criação
          if (leadInserido) {
            const { error: eventoError } = await supabase
              .from("lead_evento")
              .upsert({
                id_lead: leadInserido.id_lead,
                etapa: isPaid ? "Investimento Confirmado" : "Interesse Registrado",
                data_evento: dataCriacao,
                observacao: `Tokeniza ID: ${saleId} - Valor: R$ ${valor.toFixed(2)}`,
              }, {
                onConflict: "id_lead,etapa"
              });

            if (eventoError) {
              console.error(`Erro ao registrar evento ${saleId}:`, eventoError);
            }
          }

          resultados.push({ sale: saleId, status: "success", valor, isPaid });
        } catch (error) {
          console.error(`Erro ao processar sale:`, error);
          resultados.push({ sale: sale.id, status: "error", error: String(error) });
        }
      }
    }

    const duracao = Date.now() - startTime;
    const erros = resultados.filter(r => r.status === "error");
    const sucessos = resultados.filter(r => r.status === "success");

    // Registrar execução do cronjob
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "sincronizar-tokeniza",
      status: erros.length > 0 && sucessos.length === 0 ? "error" : "success",
      duracao_ms: duracao,
      mensagem_erro: erros.length > 0 ? erros[0].error : null,
      detalhes_execucao: {
        crowdfunding: crowdfundingData.length,
        automaticSales: automaticSalesData.length,
        readAllForUnit: readAllForUnitData.length,
        sucessos: sucessos.length,
        erros: erros.length,
      },
    });

    console.log(`Sincronização Tokeniza concluída em ${duracao}ms: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`);
    
    if (erros.length > 0 && sucessos.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: erros[0].error || "Erro ao sincronizar com Tokeniza",
          resultados 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Sincronização concluída: ${sucessos.length} sucesso(s), ${erros.length} erro(s)`,
        dados: {
          crowdfunding: crowdfundingData.length,
          automaticSales: automaticSalesData.length,
          readAllForUnit: readAllForUnitData.length,
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
