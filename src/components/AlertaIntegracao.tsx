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
      const intMeta = integracoes?.find(i => i.tipo === "META_ADS");
      if (!intMeta) return { ok: true };

      const { data, error } = await supabase.functions.invoke("coletar-criativos-meta");
      
      if (error || !data) return { ok: false, error: "Falha na conexão" };
      
      // Verificar se tem erro de token na resposta
      const hasTokenError = data.resultados?.some((r: any) => 
        r.error?.includes("access token") || r.error?.includes("OAuthException")
      );
      
      return { ok: !hasTokenError, error: hasTokenError ? "Token expirado" : null };
    },
    enabled: !!integracoes?.some(i => i.tipo === "META_ADS"),
    refetchInterval: 30 * 60 * 1000, // Testa a cada 30 minutos
  });

  const { data: statusGoogle } = useQuery({
    queryKey: ["test-google-integration"],
    queryFn: async () => {
      const intGoogle = integracoes?.find(i => i.tipo === "GOOGLE_ADS");
      if (!intGoogle) return { ok: true };

      const { data, error } = await supabase.functions.invoke("coletar-criativos-google");
      
      if (error || !data) return { ok: false, error: "Falha na conexão" };
      
      const hasAuthError = data.resultados?.some((r: any) => 
        r.error?.includes("UNAUTHENTICATED") || r.error?.includes("credentials")
      );
      
      return { ok: !hasAuthError, error: hasAuthError ? "Credenciais inválidas" : null };
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
        {!statusMeta?.ok && (
          <p>• Meta Ads: {statusMeta.error} - Reconecte a integração</p>
        )}
        {!statusGoogle?.ok && (
          <p>• Google Ads: {statusGoogle.error} - Verifique as credenciais</p>
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