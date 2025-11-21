import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Play, CheckCircle, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CalculoMetricas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [semanaSelecionada, setSemanaSelecionada] = useState<string>("");

  const { data: semanas } = useQuery({
    queryKey: ["semanas-calculo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: ultimosCalculos } = useQuery({
    queryKey: ["ultimos-calculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select(`
          *,
          empresa:id_empresa (nome),
          semana:id_semana (numero_semana, ano)
        `)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const calcularMetricasMutation = useMutation({
    mutationFn: async (id_semana?: string) => {
      const { data, error } = await supabase.functions.invoke('calcular-metricas-semanais', {
        body: { id_semana },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ultimos-calculos"] });
      queryClient.invalidateQueries({ queryKey: ["metricas-direcao"] });
      queryClient.invalidateQueries({ queryKey: ["campanhas-metricas"] });
      toast({
        title: "Métricas calculadas",
        description: `Processadas ${data.empresas_processadas} empresas e ${data.campanhas_processadas} campanhas`,
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
    calcularMetricasMutation.mutate(semanaSelecionada || undefined);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Motor de Métricas</h1>
          <p className="text-muted-foreground mt-2">
            Cálculo automático de métricas semanais e funil de conversão
          </p>
        </div>

        {/* Card de Cálculo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calcular Métricas Semanais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Semana (deixe em branco para calcular a semana mais recente)
              </label>
              <Select value={semanaSelecionada} onValueChange={setSemanaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Semana mais recente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semana mais recente</SelectItem>
                  {semanas?.map((s) => (
                    <SelectItem key={s.id_semana} value={s.id_semana}>
                      Semana {s.numero_semana}/{s.ano} ({format(new Date(s.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(s.data_fim), "dd/MM", { locale: ptBR })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                O que será calculado:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Verba investida por empresa e campanha</li>
                <li>• Total de leads gerados</li>
                <li>• CPL (Custo por Lead) e CAC (Custo de Aquisição)</li>
                <li>• Funil completo: MQLs, Levantadas, Reuniões, Vendas</li>
                <li>• Ticket médio de vendas</li>
                <li>• Taxas de conversão em cada etapa</li>
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
                    key={`${calculo.id_empresa}-${calculo.id_semana}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium">{calculo.empresa.nome}</span>
                        <Badge variant="outline">
                          Semana {calculo.semana.numero_semana}/{calculo.semana.ano}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground ml-7">
                        {calculo.leads_total} leads • R$ {calculo.verba_investida.toLocaleString("pt-BR")} investidos
                        {calculo.cpl && ` • CPL: R$ ${calculo.cpl.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(calculo.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
              <strong>Cálculo Manual:</strong> Use o botão acima para calcular métricas de qualquer semana.
            </p>
            <p>
              <strong>Automação (Opcional):</strong> Configure um cron job para executar automaticamente:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
              <li>Toda segunda-feira para calcular a semana anterior</li>
              <li>Diariamente para atualizar métricas da semana atual</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
