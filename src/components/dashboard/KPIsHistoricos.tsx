import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Wallet } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";

interface KPIsHistoricosProps {
  empresaId: string;
}

export function KPIsHistoricos({ empresaId }: KPIsHistoricosProps) {
  const [periodo, setPeriodo] = useState<"comparacao" | "6meses">("comparacao");

  const { data: metricasHistoricas, isLoading } = useQuery({
    queryKey: ["kpis-historicos", empresaId, periodo],
    queryFn: async () => {
      const mesesAtras = periodo === "6meses" ? 6 : 2;
      const dataInicio = startOfMonth(subMonths(new Date(), mesesAtras - 1));
      const dataFim = new Date();

      const { data, error } = await supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("id_empresa", empresaId)
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .lte("data", format(dataFim, "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh a cada 10 minutos
  });

  // Agrupar dados por semana para visualização mais clara
  const dadosAgrupados = (() => {
    if (!metricasHistoricas || metricasHistoricas.length === 0) return [];

    const porSemana: Record<string, any> = {};
    
    metricasHistoricas.forEach((m) => {
      const data = new Date(m.data);
      // Agrupar por semana ISO
      const semanaKey = format(data, "yyyy-'W'ww");
      const semanaLabel = `S${format(data, "ww")}`;
      
      if (!porSemana[semanaKey]) {
        porSemana[semanaKey] = {
          semana: semanaLabel,
          mes: format(data, "MMM", { locale: ptBR }),
          leads: 0,
          verba: 0,
          vendas: 0,
          dias: 0,
        };
      }
      
      porSemana[semanaKey].leads += m.leads_total || 0;
      porSemana[semanaKey].verba += Number(m.verba_investida) || 0;
      porSemana[semanaKey].vendas += m.vendas || 0;
      porSemana[semanaKey].dias++;
    });

    return Object.values(porSemana).map((s: any) => ({
      ...s,
      cpl: s.leads > 0 ? s.verba / s.leads : 0,
      conversao: s.leads > 0 ? (s.vendas / s.leads) * 100 : 0,
    }));
  })();

  // Calcular totais e variações por mês
  const mesAtual = new Date().getMonth();
  const mesAnterior = mesAtual - 1;

  const dadosMesAtual = metricasHistoricas?.filter((m) => 
    new Date(m.data).getMonth() === mesAtual
  ) || [];

  const dadosMesAnterior = metricasHistoricas?.filter((m) => 
    new Date(m.data).getMonth() === mesAnterior
  ) || [];

  const calcularTotalDia = (dados: any[], campo: string) => 
    dados.reduce((acc, d) => acc + (Number(d[campo]) || 0), 0);

  const leadsAtual = calcularTotalDia(dadosMesAtual, "leads_total");
  const leadsAnterior = calcularTotalDia(dadosMesAnterior, "leads_total");
  const variacaoLeads = leadsAnterior > 0 ? ((leadsAtual - leadsAnterior) / leadsAnterior) * 100 : 0;

  const verbaAtual = calcularTotalDia(dadosMesAtual, "verba_investida");
  const verbaAnterior = calcularTotalDia(dadosMesAnterior, "verba_investida");
  const variacaoVerba = verbaAnterior > 0 ? ((verbaAtual - verbaAnterior) / verbaAnterior) * 100 : 0;

  const vendasAtual = calcularTotalDia(dadosMesAtual, "vendas");
  const vendasAnterior = calcularTotalDia(dadosMesAnterior, "vendas");

  const cplAtual = leadsAtual > 0 ? verbaAtual / leadsAtual : 0;
  const cplAnterior = leadsAnterior > 0 ? verbaAnterior / leadsAnterior : 0;
  const variacaoCpl = cplAnterior > 0 ? ((cplAtual - cplAnterior) / cplAnterior) * 100 : 0;

  const conversaoAtual = leadsAtual > 0 ? (vendasAtual / leadsAtual) * 100 : 0;
  const conversaoAnterior = leadsAnterior > 0 ? (vendasAnterior / leadsAnterior) * 100 : 0;
  const variacaoConversao = conversaoAnterior > 0 ? ((conversaoAtual - conversaoAnterior) / conversaoAnterior) * 100 : 0;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const chartConfig = {
    leads: { label: "Leads", color: "hsl(var(--primary))" },
    cpl: { label: "CPL", color: "hsl(var(--destructive))" },
    conversao: { label: "Conversão", color: "hsl(142 76% 36%)" },
    verba: { label: "Verba", color: "hsl(262 83% 58%)" },
  };

  const MiniKPICard = ({ 
    titulo, 
    valor, 
    variacao, 
    icon: Icon,
    dados,
    dataKey,
    formatValue,
    invertVariacao = false,
    info,
  }: {
    titulo: string;
    valor: string | number;
    variacao: number;
    icon: any;
    dados: any[];
    dataKey: string;
    formatValue?: (v: number) => string;
    invertVariacao?: boolean;
    info: string;
  }) => {
    const isPositivo = invertVariacao ? variacao < 0 : variacao > 0;
    
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            <MetricaComInfo label={titulo} info={info} />
          </CardTitle>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold truncate">{valor}</div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs flex-wrap">
            {variacao !== 0 && (
              <>
                {isPositivo ? (
                  <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                )}
                <span className={isPositivo ? "text-green-500" : "text-red-500"}>
                  {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
                </span>
                <span className="text-muted-foreground hidden sm:inline">vs mês anterior</span>
              </>
            )}
          </div>
          
          {dados.length > 0 && (
            <div className="mt-2 sm:mt-3 h-12 sm:h-16">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dados}>
                    <Line
                      type="monotone"
                      dataKey={dataKey}
                      stroke={chartConfig[dataKey as keyof typeof chartConfig]?.color || "hsl(var(--primary))"}
                      strokeWidth={2}
                      dot={false}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent 
                        formatter={(value) => formatValue ? formatValue(Number(value)) : value}
                      />} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base sm:text-lg font-semibold">📊 Métricas Históricas</h3>
        <ToggleGroup type="single" value={periodo} onValueChange={(v) => v && setPeriodo(v as any)} className="justify-start sm:justify-end">
          <ToggleGroupItem value="comparacao" size="sm" className="text-xs sm:text-sm">Mês vs Anterior</ToggleGroupItem>
          <ToggleGroupItem value="6meses" size="sm" className="text-xs sm:text-sm">Últimos 6 meses</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <MiniKPICard
          titulo="Leads"
          valor={leadsAtual}
          variacao={variacaoLeads}
          icon={Users}
          dados={dadosAgrupados}
          dataKey="leads"
          info="Total de leads gerados no período selecionado."
        />
        <MiniKPICard
          titulo="CPL Médio"
          valor={formatCurrency(cplAtual)}
          variacao={variacaoCpl}
          icon={DollarSign}
          dados={dadosAgrupados}
          dataKey="cpl"
          formatValue={(v) => formatCurrency(v)}
          invertVariacao={true}
          info="Custo Por Lead médio. Quanto menor, melhor. Calculado: Verba / Leads."
        />
        <MiniKPICard
          titulo="Conversão"
          valor={`${conversaoAtual.toFixed(1)}%`}
          variacao={variacaoConversao}
          icon={Target}
          dados={dadosAgrupados}
          dataKey="conversao"
          formatValue={(v) => `${v.toFixed(1)}%`}
          info="Taxa de conversão de leads em vendas. Quanto maior, melhor."
        />
        <MiniKPICard
          titulo="Verba Investida"
          valor={formatCurrency(verbaAtual)}
          variacao={variacaoVerba}
          icon={Wallet}
          dados={dadosAgrupados}
          dataKey="verba"
          formatValue={(v) => formatCurrency(v)}
          info="Total investido em mídia paga (Meta + Google Ads) no período."
        />
      </div>
    </div>
  );
}
