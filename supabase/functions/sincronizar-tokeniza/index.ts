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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando sincronização Tokeniza...");

    // Buscar todas as integrações Tokeniza ativas
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

    const resultados = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const apiToken = config.api_token;
      const baseUrl = config.base_url || "https://api.tokeniza.com.br";
      const idEmpresa = config.id_empresa;

      console.log(`Processando integração para empresa ${idEmpresa}`);

      try {
        // Buscar orders da API Tokeniza
        // Usando o endpoint /v1/orders/bo que retorna todos os pedidos (back office)
        const ordersUrl = `${baseUrl}/v1/orders/bo`;
        
        const ordersResponse = await fetch(ordersUrl, {
          method: "GET",
          headers: {
            "x-auth-token": apiToken,
            "Content-Type": "application/json",
          },
        });

        if (!ordersResponse.ok) {
          console.error(`Erro na API Tokeniza: ${ordersResponse.status} - ${await ordersResponse.text()}`);
          continue;
        }

        const ordersData = await ordersResponse.json();
        
        if (!ordersData || !Array.isArray(ordersData)) {
          console.log("Nenhum pedido encontrado ou formato inválido");
          continue;
        }

        // Processar cada order como um lead/venda
        for (const order of ordersData) {
          try {
            // Mapear status do order para campos do lead
            // Assumindo estrutura comum de orders com status de pagamento
            const isPaid = order.payment_status === "paid" || order.status === "paid" || order.paid === true;
            const isCompleted = order.status === "completed" || order.status === "delivered";
            
            const leadData = {
              id_empresa: idEmpresa,
              id_lead_externo: String(order.id || order._id || order.order_id),
              data_criacao: order.created_at || order.createdAt || new Date().toISOString(),
              origem_canal: "OUTRO" as const,
              origem_campanha: order.utm_source || order.source || null,
              // Mapear para funil de vendas
              is_mql: isPaid, // Se pagou, é considerado MQL
              levantou_mao: isPaid,
              tem_reuniao: false, // Tokeniza é e-commerce, não tem reunião
              reuniao_realizada: false,
              venda_realizada: isPaid && isCompleted,
              data_venda: isPaid && isCompleted ? (order.updated_at || order.updatedAt || order.paid_at) : null,
              valor_venda: isPaid ? parseFloat(order.total || order.amount || order.value || "0") : null,
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
              console.error(`Erro ao salvar lead do order ${order.id}:`, leadError);
              continue;
            }

            // Registrar eventos importantes do pedido
            const eventos = [];

            if (order.created_at) {
              eventos.push({
                id_lead: leadInserido.id_lead,
                etapa: "Pedido Criado",
                data_evento: order.created_at,
                observacao: `Order ID: ${order.id}`,
              });
            }

            if (isPaid && order.paid_at) {
              eventos.push({
                id_lead: leadInserido.id_lead,
                etapa: "Pagamento Confirmado",
                data_evento: order.paid_at,
                observacao: `Valor: ${order.total || order.amount}`,
              });
            }

            if (isCompleted && order.delivered_at) {
              eventos.push({
                id_lead: leadInserido.id_lead,
                etapa: "Pedido Entregue",
                data_evento: order.delivered_at,
                observacao: null,
              });
            }

            // Inserir eventos
            for (const evento of eventos) {
              const { error: eventoError } = await supabase
                .from("lead_evento")
                .insert(evento);

              if (eventoError) {
                console.error(`Erro ao registrar evento do order ${order.id}:`, eventoError);
              }
            }

            resultados.push({ order: order.id, status: "success" });
          } catch (error) {
            console.error(`Erro ao processar order ${order.id}:`, error);
            resultados.push({ order: order.id, status: "error", error: String(error) });
          }
        }
      } catch (error) {
        console.error(`Erro ao processar integração ${integracao.id_integracao}:`, error);
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: String(error) });
      }
    }

    console.log("Sincronização Tokeniza concluída");
    return new Response(
      JSON.stringify({ message: "Sincronização concluída", resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
