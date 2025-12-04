import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Cell } from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";

interface ROIProfitabilityProps {
  empresaId?: string;
}

export function ROIProfitability({ empresaId }: ROIProfitabilityProps) {
  // Buscar dados de ROI por empresa
  const { data: roiData, isLoading } = useQuery({
    queryKey: ["roi-profitability", empresaId],
    queryFn: async () => {
      // Período de 6 meses
      const dataInicio = startOfMonth(subMonths(new Date(), 5));
      
      // Buscar receita total (vendas realizadas) - MESMO PERÍODO DE 6 MESES
      const { data: vendas, error: vendasError } = await supabase
        .from("lead")
        .select("valor_venda, data_venda, id_empresa, empresa:id_empresa(nome)")
        .eq("venda_realizada", true)
        .not("valor_venda", "is", null)
        .gte("data_venda", dataInicio.toISOString());

      if (vendasError) throw vendasError;

      // Buscar gasto total por empresa (últimos 6 meses)
      const { data: metricas, error: metricasError } = await supabase
        .from("empresa_semana_metricas")
        .select("id_empresa, verba_investida, empresa:id_empresa(nome), semana:id_semana(data_inicio)")
        .gte("semana.data_inicio", dataInicio.toISOString());

      if (metricasError) throw metricasError;

      // Agregar por empresa
      const empresaMap = new Map<string, { nome: string; receita: number; gasto: number; vendas: number }>();

      vendas?.forEach((v: any) => {
        const id = v.id_empresa;
        const nome = v.empresa?.nome || "Desconhecido";
        if (!empresaMap.has(id)) {
          empresaMap.set(id, { nome, receita: 0, gasto: 0, vendas: 0 });
        }
        const empresa = empresaMap.get(id)!;
        empresa.receita += Number(v.valor_venda) || 0;
        empresa.vendas += 1;
      });

      metricas?.forEach((m: any) => {
        const id = m.id_empresa;
        const nome = m.empresa?.nome || "Desconhecido";
        if (!empresaMap.has(id)) {
          empresaMap.set(id, { nome, receita: 0, gasto: 0, vendas: 0 });
        }
        const empresa = empresaMap.get(id)!;
        empresa.gasto += Number(m.verba_investida) || 0;
      });

      // Calcular dados mensais para gráfico
      const mesesData: { mes: string; receita: number; gasto: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(new Date(), i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = endOfMonth(mesData);
        const mesLabel = format(mesData, "MMM/yy", { locale: ptBR });

        let receitaMes = 0;
        let gastoMes = 0;

        vendas?.forEach((v: any) => {
          if (!empresaId || v.id_empresa === empresaId) {
            const dataVenda = v.data_venda ? new Date(v.data_venda) : null;
            if (dataVenda && dataVenda >= mesInicio && dataVenda <= mesFim) {
              receitaMes += Number(v.valor_venda) || 0;
            }
          }
        });

        metricas?.forEach((m: any) => {
          if (!empresaId || m.id_empresa === empresaId) {
            const dataSemana = m.semana?.data_inicio ? new Date(m.semana.data_inicio) : null;
            if (dataSemana && dataSemana >= mesInicio && dataSemana <= mesFim) {
              gastoMes += Number(m.verba_investida) || 0;
            }
          }
        });

        mesesData.push({ mes: mesLabel, receita: receitaMes, gasto: gastoMes });
      }

      // Totais
      let totalReceita = 0;
      let totalGasto = 0;
      let totalVendas = 0;

      empresaMap.forEach((empresa, id) => {
        if (!empresaId || id === empresaId) {
          totalReceita += empresa.receita;
          totalGasto += empresa.gasto;
          totalVendas += empresa.vendas;
        }
      });

      const lucroBruto = totalReceita - totalGasto;
      const roas = totalGasto > 0 ? totalReceita / totalGasto : 0;
      const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0;
      const cac = totalVendas > 0 ? totalGasto / totalVendas : 0;
      const paybackDias = cac > 0 && ticketMedio > 0 ? Math.ceil((cac / ticketMedio) * 30) : 0;

      // Verificar dados incompletos
      const dadosIncompletos = empresaMap.size > 0 && 
        Array.from(empresaMap.values()).some(e => e.receita === 0 && e.gasto > 0);

      return {
        totalReceita,
        totalGasto,
        lucroBruto,
        roas,
        ticketMedio,
        cac,
        paybackDias,
        mesesData,
        empresas: Array.from(empresaMap.entries()).map(([id, data]) => ({ id, ...data })),
        dadosIncompletos
      };
    },
  });

  const chartConfig = {
    receita: { label: "Receita", color: "hsl(var(--chart-1))" },
    gasto: { label: "Gasto", color: "hsl(var(--chart-2))" },
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              ROI e Lucratividade
            </CardTitle>
            <CardDescription>Análise de retorno sobre investimento</CardDescription>
          </div>
          {roiData?.dadosIncompletos && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Dados parciais
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* KPIs de ROI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
            <MetricaComInfo 
              label="Receita Total" 
              info="Soma do valor de todas as vendas realizadas nos últimos 6 meses."
              className="text-sm text-muted-foreground mb-1"
            />
            <div className="text-xl md:text-2xl font-bold text-green-600">
              {formatCurrency(roiData?.totalReceita || 0)}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <MetricaComInfo 
              label="Gasto em Mídia" 
              info="Total investido em anúncios (Meta Ads + Google Ads) nos últimos 6 meses."
              className="text-sm text-muted-foreground mb-1"
            />
            <div className="text-xl md:text-2xl font-bold text-red-600">
              {formatCurrency(roiData?.totalGasto || 0)}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <MetricaComInfo 
              label="Lucro Bruto" 
              info="Receita Total menos Gasto em Mídia. Valor positivo indica lucro, negativo indica prejuízo."
              className="text-sm text-muted-foreground mb-1"
            />
            <div className={`text-xl md:text-2xl font-bold ${(roiData?.lucroBruto || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(roiData?.lucroBruto || 0)}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
            <MetricaComInfo 
              label="ROAS" 
              info="Return On Ad Spend. Quanto retorna em receita para cada R$1 investido. ROAS de 2x significa que cada R$1 gera R$2 em vendas."
              className="text-sm text-muted-foreground mb-1"
            />
            <div className="text-xl md:text-2xl font-bold text-purple-600">
              {(roiData?.roas || 0).toFixed(1)}x
            </div>
          </div>
        </div>

        {/* Métricas secundárias */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <MetricaComInfo 
              label="Ticket Médio" 
              info="Valor médio de cada venda realizada. Calculado dividindo a receita total pelo número de vendas."
              className="text-xs text-muted-foreground justify-center"
            />
            <div className="text-lg font-semibold">{formatCurrency(roiData?.ticketMedio || 0)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <MetricaComInfo 
              label="CAC" 
              info="Custo de Aquisição de Cliente. Quanto custa em média para converter um lead em cliente. Calculado: Gasto Total / Número de Vendas."
              className="text-xs text-muted-foreground justify-center"
            />
            <div className="text-lg font-semibold">{formatCurrency(roiData?.cac || 0)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <MetricaComInfo 
              label="Payback" 
              info="Tempo estimado para recuperar o investimento de aquisição. Quanto menor, mais rápido o retorno."
              className="text-xs text-muted-foreground justify-center"
            />
            <div className="text-lg font-semibold">
              {roiData?.paybackDias || 0} dias
            </div>
          </div>
        </div>

        {/* Gráfico de barras - Receita vs Gasto por mês */}
        <div className="h-64">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData?.mesesData || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gasto" name="Gasto" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Alerta de dados parciais */}
        {roiData?.dadosIncompletos && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Dados incompletos:</strong> Algumas empresas têm gasto registrado mas nenhuma receita. 
              Verifique se as vendas estão sendo sincronizadas corretamente.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
