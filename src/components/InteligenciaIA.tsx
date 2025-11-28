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
      // Buscar a análise mais recente para a empresa
      const { data, error } = await supabase
        .from("analise_inteligencia")
        .select("*")
        .eq("id_empresa", empresaId)
        .order("data_analise", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
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
        ) : data ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Análise gerada em {new Date(data.data_analise).toLocaleDateString("pt-BR")} • 
              Período: {new Date(data.data_inicio_periodo).toLocaleDateString("pt-BR")} - {new Date(data.data_fim_periodo).toLocaleDateString("pt-BR")}
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="text-sm leading-relaxed">
                <ReactMarkdown>
                  {data.analise_texto}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma análise disponível no momento. A próxima análise será gerada automaticamente.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
