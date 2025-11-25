import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AlertaIntegracao = () => {
  const navigate = useNavigate();

  const { data: integracoes } = useQuery({
    queryKey: ["integracoes-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracao")
        .select("*")
        .eq("ativo", true);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Revalida a cada 5 minutos
  });

  // Testar integrações chamando edge functions
  const { data: statusMeta } = useQuery({
    queryKey: ["test-meta-integration"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("coletar-criativos-meta");
      
      if (error || !data) return { ok: true, empresasComErro: [] };
      
      // Buscar empresas para mapear nomes
      const { data: empresas } = await supabase
        .from("empresa")
        .select("id_empresa, nome");
      
      // Buscar integrações para mapear id_empresa
      const { data: integracoes } = await supabase
        .from("integracao")
        .select("id_integracao, config_json")
        .eq("tipo", "META_ADS")
        .eq("ativo", true);
      
      // Analisar resultados por integração e mapear para empresas
      const empresasComErro: Array<{ nome: string; erro: string }> = [];
      
      data.resultados?.forEach((r: any) => {
        if (r.error && (r.error.includes("access token") || r.error.includes("OAuthException"))) {
          // Encontrar a integração pelo id
          const integracao = integracoes?.find(i => i.id_integracao === r.integracao);
          if (integracao) {
            const idEmpresa = (integracao.config_json as any).id_empresa;
            const empresa = empresas?.find(e => e.id_empresa === idEmpresa);
            if (empresa && !empresasComErro.find(e => e.nome === empresa.nome)) {
              empresasComErro.push({
                nome: empresa.nome,
                erro: r.error
              });
            }
          }
        }
      });
      
      return { 
        ok: empresasComErro.length === 0, 
        empresasComErro 
      };
    },
    enabled: !!integracoes?.some(i => i.tipo === "META_ADS"),
    refetchInterval: 30 * 60 * 1000, // Testa a cada 30 minutos
  });

  const { data: statusGoogle } = useQuery({
    queryKey: ["test-google-integration"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("coletar-criativos-google");
      
      if (error || !data) return { ok: true, empresasComErro: [] };
      
      // Buscar empresas para mapear nomes
      const { data: empresas } = await supabase
        .from("empresa")
        .select("id_empresa, nome");
      
      // Buscar integrações para mapear id_empresa
      const { data: integracoes } = await supabase
        .from("integracao")
        .select("id_integracao, config_json")
        .eq("tipo", "GOOGLE_ADS")
        .eq("ativo", true);
      
      // Analisar resultados por integração e mapear para empresas
      const empresasComErro: Array<{ nome: string; erro: string }> = [];
      
      data.resultados?.forEach((r: any) => {
        if (r.error && (r.error.includes("UNAUTHENTICATED") || r.error.includes("credentials"))) {
          // Encontrar a integração pelo id
          const integracao = integracoes?.find(i => i.id_integracao === r.integracao);
          if (integracao) {
            const idEmpresa = (integracao.config_json as any).id_empresa;
            const empresa = empresas?.find(e => e.id_empresa === idEmpresa);
            if (empresa && !empresasComErro.find(e => e.nome === empresa.nome)) {
              empresasComErro.push({
                nome: empresa.nome,
                erro: r.error
              });
            }
          }
        }
      });
      
      return { 
        ok: empresasComErro.length === 0, 
        empresasComErro 
      };
    },
    enabled: !!integracoes?.some(i => i.tipo === "GOOGLE_ADS"),
    refetchInterval: 30 * 60 * 1000,
  });

  const temProblemas = !statusMeta?.ok || !statusGoogle?.ok;

  if (!temProblemas) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Problemas com Integrações Detectados</AlertTitle>
      <AlertDescription className="space-y-2">
        {statusMeta && !statusMeta.ok && statusMeta.empresasComErro && (
          <>
            <p className="font-semibold">Meta Ads - Token Expirado:</p>
            {statusMeta.empresasComErro.map((empresa: any, idx: number) => (
              <p key={idx} className="ml-4">
                • {empresa.nome}: {empresa.erro.includes("OAuthException") ? "Access Token inválido ou expirado" : empresa.erro}
              </p>
            ))}
          </>
        )}
        {statusGoogle && !statusGoogle.ok && statusGoogle.empresasComErro && (
          <>
            <p className="font-semibold">Google Ads - Credenciais Inválidas:</p>
            {statusGoogle.empresasComErro.map((empresa: any, idx: number) => (
              <p key={idx} className="ml-4">
                • {empresa.nome}: {empresa.erro}
              </p>
            ))}
          </>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2"
          onClick={() => navigate("/integracoes")}
        >
          Ir para Integrações <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};