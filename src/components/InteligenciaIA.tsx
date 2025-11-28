import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";

interface InteligenciaIAProps {
  empresaId: string;
}

export const InteligenciaIA = ({ empresaId }: InteligenciaIAProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inteligencia-ia", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analise-inteligencia", {
        body: { id_empresa: empresaId }
      });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000 * 60 * 30, // Atualiza a cada 30 minutos
    staleTime: 1000 * 60 * 15, // Considera stale após 15 minutos
    enabled: !!empresaId, // Só executa se houver empresa selecionada
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar análise inteligente: {error instanceof Error ? error.message : "Erro desconhecido"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle>Inteligência de Tráfego</CardTitle>
        </div>
        <CardDescription>
          Análise automática dos últimos 30 dias (até ontem)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Analisando dados...</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="text-sm leading-relaxed">
              <ReactMarkdown>
                {data?.analise || "Nenhuma análise disponível no momento."}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
