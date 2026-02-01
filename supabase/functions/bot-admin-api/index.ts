import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar API Key
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("BOT_ADMIN_API_KEY");

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error("API Key inválida ou ausente");
      return new Response(
        JSON.stringify({ error: "Não autorizado - API Key inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client admin com service role para acesso total
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, params } = body;

    console.log(`Bot Admin API - Ação: ${action}`);

    let result: any = null;

    switch (action) {
      // ===== EMPRESAS =====
      case "listar_empresas": {
        const { data, error } = await supabaseAdmin
          .from("empresa")
          .select("*")
          .order("nome");
        if (error) throw error;
        result = data;
        break;
      }

      case "buscar_empresa": {
        const { id_empresa } = params;
        const { data, error } = await supabaseAdmin
          .from("empresa")
          .select("*")
          .eq("id_empresa", id_empresa)
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      // ===== LEADS =====
      case "listar_leads": {
        const { id_empresa, limit = 100, offset = 0, filtros } = params || {};
        let query = supabaseAdmin.from("lead").select("*", { count: "exact" });
        
        if (id_empresa) query = query.eq("id_empresa", id_empresa);
        if (filtros?.data_inicio) query = query.gte("data_criacao", filtros.data_inicio);
        if (filtros?.data_fim) query = query.lte("data_criacao", filtros.data_fim);
        if (filtros?.status) query = query.eq("status", filtros.status);
        
        const { data, error, count } = await query
          .order("data_criacao", { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (error) throw error;
        result = { leads: data, total: count };
        break;
      }

      case "buscar_lead": {
        const { id_lead, email, telefone } = params;
        let query = supabaseAdmin.from("lead").select("*");
        
        if (id_lead) query = query.eq("id_lead", id_lead);
        else if (email) query = query.eq("email", email);
        else if (telefone) query = query.eq("telefone", telefone);
        else throw new Error("Informe id_lead, email ou telefone");
        
        const { data, error } = await query;
        if (error) throw error;
        result = data;
        break;
      }

      case "atualizar_lead": {
        const { id_lead, dados } = params;
        const { data, error } = await supabaseAdmin
          .from("lead")
          .update(dados)
          .eq("id_lead", id_lead)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      // ===== CAMPANHAS =====
      case "listar_campanhas": {
        const { id_empresa, ativas_apenas } = params || {};
        let query = supabaseAdmin
          .from("campanha")
          .select(`
            *,
            conta_anuncio (
              id_conta,
              nome,
              plataforma,
              id_empresa,
              empresa:id_empresa (nome)
            )
          `);
        
        if (id_empresa) {
          query = query.eq("conta_anuncio.id_empresa", id_empresa);
        }
        if (ativas_apenas) {
          query = query.eq("ativa", true);
        }
        
        const { data, error } = await query.order("nome");
        if (error) throw error;
        result = data;
        break;
      }

      // ===== MÉTRICAS =====
      case "metricas_empresa_periodo": {
        const { id_empresa, data_inicio, data_fim } = params;
        const { data, error } = await supabaseAdmin
          .from("empresa_metricas_dia")
          .select("*")
          .eq("id_empresa", id_empresa)
          .gte("data", data_inicio)
          .lte("data", data_fim)
          .order("data");
        if (error) throw error;
        result = data;
        break;
      }

      case "metricas_campanha_periodo": {
        const { id_campanha, data_inicio, data_fim } = params;
        const { data, error } = await supabaseAdmin
          .from("campanha_metricas_dia")
          .select("*")
          .eq("id_campanha", id_campanha)
          .gte("data", data_inicio)
          .lte("data", data_fim)
          .order("data");
        if (error) throw error;
        result = data;
        break;
      }

      // ===== ALERTAS =====
      case "listar_alertas": {
        const { id_empresa, resolvido, limit = 50 } = params || {};
        let query = supabaseAdmin.from("alerta_automatico").select("*");
        
        if (id_empresa) query = query.eq("id_empresa", id_empresa);
        if (resolvido !== undefined) query = query.eq("resolvido", resolvido);
        
        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        result = data;
        break;
      }

      case "resolver_alerta": {
        const { id_alerta } = params;
        const { data, error } = await supabaseAdmin
          .from("alerta_automatico")
          .update({ 
            resolvido: true, 
            resolvido_em: new Date().toISOString(),
            resolvido_por: "bot-admin"
          })
          .eq("id_alerta", id_alerta)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      // ===== INTEGRAÇÕES =====
      case "listar_integracoes": {
        const { id_empresa, tipo } = params || {};
        let query = supabaseAdmin.from("integracao").select("*");
        
        if (id_empresa) query = query.eq("id_empresa", id_empresa);
        if (tipo) query = query.eq("tipo", tipo);
        
        const { data, error } = await query.order("created_at");
        if (error) throw error;
        result = data;
        break;
      }

      // ===== USUÁRIOS (Admin only) =====
      case "listar_usuarios": {
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .order("nome");
        if (profilesError) throw profilesError;

        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) throw authError;

        const emailMap: Record<string, string> = {};
        for (const u of authUsers.users) {
          emailMap[u.id] = u.email || "";
        }

        result = profiles.map((p: any) => ({
          ...p,
          email: emailMap[p.id] || null
        }));
        break;
      }

      // ===== PIPEDRIVE =====
      case "listar_pipedrive_deals": {
        const { id_empresa, limit = 100 } = params || {};
        let query = supabaseAdmin.from("pipedrive_deal").select("*");
        
        if (id_empresa) query = query.eq("id_empresa", id_empresa);
        
        const { data, error } = await query
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        result = data;
        break;
      }

      // ===== QUERY GENÉRICA (use com cuidado) =====
      case "query": {
        const { table, select = "*", filters, order, limit = 100 } = params;
        let query = supabaseAdmin.from(table).select(select);
        
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
          }
        }
        if (order) {
          query = query.order(order.column, { ascending: order.ascending ?? true });
        }
        
        const { data, error } = await query.limit(limit);
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: "Ação não reconhecida", 
            acoes_disponiveis: [
              "listar_empresas", "buscar_empresa",
              "listar_leads", "buscar_lead", "atualizar_lead",
              "listar_campanhas",
              "metricas_empresa_periodo", "metricas_campanha_periodo",
              "listar_alertas", "resolver_alerta",
              "listar_integracoes",
              "listar_usuarios",
              "listar_pipedrive_deals",
              "query"
            ]
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro na Bot Admin API:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
