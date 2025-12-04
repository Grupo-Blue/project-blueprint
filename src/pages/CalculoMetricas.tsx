import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Play, CheckCircle, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CalculoMetricas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dataSelecionada, setDataSelecionada] = useState<string>(
    format(subDays(new Date(), 1), "yyyy-MM-dd")
  );

  const { data: ultimosCalculos } = useQuery({
    queryKey: ["ultimos-calculos-diarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_metricas_dia")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .order("data", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const calcularMetricasMutation = useMutation({
    mutationFn: async (data?: string) => {
      const { data: result, error } = await supabase.functions.invoke('calcular-metricas-diarias', {
        body: { data },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ultimos-calculos-diarios"] });
      queryClient.invalidateQueries({ queryKey: ["metricas-direcao"] });
      queryClient.invalidateQueries({ queryKey: ["metricas-diarias"] });
      toast({
        title: "Métricas calculadas",
        description: `Processadas ${data.empresas_processadas} empresas para ${data.data_calculada}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao calcular métricas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCalcular = () => {
    calcularMetricasMutation.mutate(dataSelecionada);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Motor de Métricas</h1>
          <p className="text-muted-foreground mt-2">
            Cálculo automático de métricas diárias por empresa
          </p>
        </div>

        {/* Card de Cálculo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calcular Métricas Diárias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Data para cálculo
              </label>
              <Input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
              <p className="text-xs text-muted-foreground">
                Por padrão, calcula métricas do dia anterior. Você pode selecionar qualquer data passada.
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                O que será calculado:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Verba investida por empresa (soma das campanhas)</li>
                <li>• Total de leads gerados no dia</li>
                <li>• Leads pagos (oriundos de campanhas)</li>
                <li>• MQLs, Levantadas, Reuniões e Vendas</li>
                <li>• CPL (Custo por Lead) e CAC (Custo de Aquisição)</li>
                <li>• Ticket médio de vendas</li>
              </ul>
            </div>

            <Button
              onClick={handleCalcular}
              disabled={calcularMetricasMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              {calcularMetricasMutation.isPending ? "Calculando..." : "Calcular Métricas"}
            </Button>
          </CardContent>
        </Card>

        {/* Últimos Cálculos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Últimos Cálculos Realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimosCalculos?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum cálculo realizado ainda
                </p>
              ) : (
                ultimosCalculos?.map((calculo: any) => (
                  <div
                    key={calculo.id_metricas_dia}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{calculo.empresa?.nome}</span>
                        <Badge variant="outline">
                          {format(new Date(calculo.data), "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground ml-7">
                        {calculo.leads_total} leads • R$ {Number(calculo.verba_investida || 0).toLocaleString("pt-BR")} investidos
                        {calculo.cpl && ` • CPL: R$ ${Number(calculo.cpl).toFixed(2)}`}
                        {calculo.vendas > 0 && ` • ${calculo.vendas} vendas`}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(calculo.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <AlertCircle className="h-5 w-5" />
              Automação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Cálculo Manual:</strong> Use o botão acima para calcular métricas de qualquer data.
            </p>
            <p>
              <strong>Automação:</strong> As métricas diárias são calculadas automaticamente todos os dias às 2 AM UTC.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
              <li>Calcula métricas do dia anterior para todas as empresas</li>
              <li>Agrega dados de campanhas, leads e vendas</li>
              <li>Dashboards são atualizados automaticamente</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
