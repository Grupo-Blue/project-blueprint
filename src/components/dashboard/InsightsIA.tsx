import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

export const InsightsIA = () => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const { empresaSelecionada } = useEmpresa();
  const { toast } = useToast();

  const gerarInsights = async () => {
    if (!empresaSelecionada || empresaSelecionada === "todas") {
      toast({ title: "Selecione uma empresa específica", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-insights-comerciais", {
        body: { id_empresa: empresaSelecionada },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      setInsights(data.insights);
      setPeriodo(data.periodo);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar insights", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insights IA Semanal
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={gerarInsights}
          disabled={loading || !empresaSelecionada || empresaSelecionada === "todas"}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analisando..." : "Gerar Insights"}
        </Button>
      </CardHeader>
      <CardContent>
        {!insights && !loading && (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Clique em "Gerar Insights" para uma análise IA dos últimos 7 dias</p>
            {(!empresaSelecionada || empresaSelecionada === "todas") && (
              <p className="text-xs mt-1 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" /> Selecione uma empresa específica
              </p>
            )}
          </div>
        )}
        {loading && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Analisando métricas com IA...</p>
          </div>
        )}
        {insights && !loading && (
          <div className="space-y-2">
            {periodo && (
              <p className="text-xs text-muted-foreground mb-3">
                Período: {periodo.inicio} a {periodo.fim}
              </p>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
