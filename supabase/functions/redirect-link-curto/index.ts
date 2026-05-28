import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Encurtador SGT: /redirect-link-curto?c=ABC redireciona para url_destino
// com os UTMs do link_curto concatenados ao destino. Incrementa cliques.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    const codigo = url.searchParams.get("c") || url.pathname.split("/").filter(Boolean).pop();
    if (!codigo) {
      return new Response("Código ausente", { status: 400 });
    }

    const { data: link } = await supabase
      .from("link_curto")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!link) {
      return new Response("Link não encontrado", { status: 404 });
    }

    // Constrói URL destino com UTMs anexados
    let destino: URL;
    try {
      destino = new URL(link.url_destino);
    } catch {
      return new Response("URL destino inválida", { status: 500 });
    }
    const setIfMissing = (key: string, val: string | null | undefined) => {
      if (val && !destino.searchParams.has(key)) destino.searchParams.set(key, val);
    };
    setIfMissing("utm_source", link.utm_source);
    setIfMissing("utm_medium", link.utm_medium);
    setIfMissing("utm_campaign", link.utm_campaign);
    setIfMissing("utm_content", link.utm_content);
    setIfMissing("utm_term", link.utm_term);

    // Incrementa cliques fire-and-forget
    supabase.rpc("noop").then(() => {}).catch(() => {});
    await supabase
      .from("link_curto")
      .update({ cliques: (link.cliques ?? 0) + 1 })
      .eq("id_link_curto", link.id_link_curto);

    return new Response(null, {
      status: 302,
      headers: { Location: destino.toString() },
    });
  } catch (error) {
    return new Response(`Erro: ${String(error)}`, { status: 500 });
  }
});
