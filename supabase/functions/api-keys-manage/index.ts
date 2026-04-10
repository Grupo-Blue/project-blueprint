import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashApiKey } from "../_shared/api-key-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require authenticated admin user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { name, empresa, permissions, expires_at } = body;
        if (!name) throw new Error("name is required");

        // Generate a random API key
        const rawKey = `sgt_${crypto.randomUUID().replace(/-/g, "")}`;
        const keyHash = await hashApiKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);

        const { data, error } = await supabaseAdmin.from("api_keys").insert({
          key_hash: keyHash,
          key_prefix: keyPrefix,
          name,
          empresa: empresa || null,
          permissions: permissions || ["read", "write"],
          is_active: true,
          expires_at: expires_at || null,
          created_by: user.id,
        }).select("id, key_prefix, name, empresa, permissions, is_active, created_at").single();

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          api_key: rawKey,
          details: data,
          warning: "Save this key now. It cannot be retrieved later.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const { data, error } = await supabaseAdmin.from("api_keys")
          .select("id, key_prefix, name, empresa, permissions, is_active, expires_at, last_used_at, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "revoke": {
        const { id } = body;
        if (!id) throw new Error("id is required");
        const { error } = await supabaseAdmin.from("api_keys")
          .update({ is_active: false })
          .eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Key revoked" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action. Use: create, list, revoke" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
