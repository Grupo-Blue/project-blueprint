import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarFalha, registrarSucesso } from "../_shared/saude_integracao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function wpAuthHeader(config: any): string | null {
  if (config.usuario && config.app_password) {
    return "Basic " + btoa(`${config.usuario}:${config.app_password}`);
  }
  if (config.bearer_token) {
    return `Bearer ${config.bearer_token}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const nomeCronjob = "sincronizar-artigos-wordpress";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const integracaoIdFiltro = body.integracao_id;

    let query = supabase
      .from("integracao")
      .select("*, empresa:id_empresa(nome)")
      .eq("tipo", "WORDPRESS")
      .eq("ativo", true);
    if (integracaoIdFiltro) query = query.eq("id_integracao", integracaoIdFiltro);

    const { data: integracoes, error: intError } = await query;
    if (intError) throw intError;
    if (!integracoes?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma integração WordPress ativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados: any[] = [];

    for (const integracao of integracoes) {
      const config = integracao.config_json as any;
      const idEmpresa = integracao.id_empresa;
      const nomeEmpresa = integracao.empresa?.nome;
      const auth = wpAuthHeader(config);

      if (!config.url_base || !auth) {
        resultados.push({
          integracao: integracao.id_integracao,
          status: "error",
          error: "url_base e (usuario+app_password ou bearer_token) são obrigatórios",
        });
        continue;
      }

      try {
        const base = String(config.url_base).replace(/\/$/, "");
        const headers = { Authorization: auth, Accept: "application/json" };
        let page = 1;
        let totalImportados = 0;
        let comErro = 0;
        const perPage = 100;

        while (true) {
          const url = `${base}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish&_embed=author,wp:term`;
          const res = await fetch(url, { headers });
          if (!res.ok) {
            if (res.status === 400 && page > 1) break; // WordPress devolve 400 ao passar do total
            const errText = await res.text().catch(() => "");
            throw new Error(`WP /wp-json -> ${res.status}: ${errText.slice(0, 200)}`);
          }
          const posts = (await res.json()) as any[];
          if (!Array.isArray(posts) || posts.length === 0) break;

          // Bulk upsert por página
          const payload = posts.map((post: any) => {
            const autor =
              post._embedded?.author?.[0]?.name
              || post._embedded?.["author"]?.[0]?.name
              || null;
            const termsArr: any[] = post._embedded?.["wp:term"]?.flat?.() || [];
            const categorias = termsArr.filter((t) => t?.taxonomy === "category").map((t) => t.name);

            return {
              id_empresa: idEmpresa,
              id_externo: String(post.id),
              titulo: post.title?.rendered || `Post #${post.id}`,
              url: post.link,
              slug: post.slug || null,
              data_publicacao: post.date_gmt || post.date || null,
              autor,
              categorias: categorias.length ? categorias : null,
              status: post.status || "publish",
            };
          });

          const { error: bulkErr } = await supabase
            .from("artigo")
            .upsert(payload, { onConflict: "id_empresa,id_externo" });

          if (bulkErr) {
            console.error("Erro bulk upsert artigos:", bulkErr.message);
            comErro += payload.length;
          } else {
            totalImportados += payload.length;
          }

          if (posts.length < perPage) break;
          page++;
          if (page > 200) break; // segurança
        }

        await registrarSucesso({ supabase, idIntegracao: integracao.id_integracao, tipo: "WORDPRESS", nomeEmpresa });

        resultados.push({
          integracao: integracao.id_integracao,
          empresa: idEmpresa,
          status: comErro > 0 && totalImportados === 0 ? "error" : comErro > 0 ? "parcial" : "success",
          artigos_importados: totalImportados,
          erros: comErro,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isAuth = /401|UNAUTHENTICATED|invalid/i.test(errMsg);
        const isPerm = /403|PERMISSION|forbidden/i.test(errMsg);
        await registrarFalha({
          supabase,
          idIntegracao: integracao.id_integracao,
          tipo: "WORDPRESS",
          nomeEmpresa,
          errorKind: isAuth ? "UNAUTHENTICATED" : isPerm ? "PERMISSION" : "OTHER",
          errorMsg: errMsg,
        });
        resultados.push({ integracao: integracao.id_integracao, status: "error", error: errMsg });
      }
    }

    const erros = resultados.filter((r) => r.status === "error");
    const sucessos = resultados.filter((r) => r.status === "success" || r.status === "parcial");

    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: erros.length > 0 && sucessos.length === 0 ? "erro" : erros.length > 0 ? "parcial" : "sucesso",
      duracao_ms: Date.now() - startTime,
      detalhes_execucao: { resultados },
    });

    return new Response(
      JSON.stringify({ message: `${sucessos.length} integrações sincronizadas`, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
