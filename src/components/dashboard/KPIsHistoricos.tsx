import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Wallet } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

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

      const { data: semanas, error: semanasError } = await supabase
        .from("semana")
        .select("id_semana, data_inicio, numero_semana, ano")
        .gte("data_inicio", dataInicio.toISOString())
        .order("data_inicio", { ascending: true });

      if (semanasError) throw semanasError;
      if (!semanas || semanas.length === 0) return [];

      const { data: metricas, error } = await supabase
        .from("empresa_semana_metricas")
        .select("*, semana!inner(data_inicio, numero_semana, ano)")
        .eq("id_empresa", empresaId)
        .in("id_semana", semanas.map(s => s.id_semana))
        .order("semana(data_inicio)", { ascending: true });

      if (error) throw error;
      return metricas || [];
    },
    enabled: !!empresaId,
  });

  // Processar dados para os gráficos
  const dadosProcessados = metricasHistoricas?.map((m: any) => ({
    semana: `S${m.semana.numero_semana}`,
    leads: m.leads_total,
    cpl: m.cpl || (m.leads_total > 0 ? m.verba_investida / m.leads_total : 0),
    conversao: m.leads_total > 0 ? (m.vendas / m.leads_total) * 100 : 0,
    verba: m.verba_investida,
    mes: format(new Date(m.semana.data_inicio), "MMM", { locale: ptBR }),
  })) || [];

  // Calcular totais e variações
  const mesAtual = new Date().getMonth();
  const mesAnterior = mesAtual - 1;

  const dadosMesAtual = dadosProcessados.filter((d: any) => {
    const dataItem = metricasHistoricas?.find((m: any) => `S${m.semana.numero_semana}` === d.semana);
    if (!dataItem) return false;
    return new Date(dataItem.semana.data_inicio).getMonth() === mesAtual;
  });

  const dadosMesAnterior = dadosProcessados.filter((d: any) => {
    const dataItem = metricasHistoricas?.find((m: any) => `S${m.semana.numero_semana}` === d.semana);
    if (!dataItem) return false;
    return new Date(dataItem.semana.data_inicio).getMonth() === mesAnterior;
  });

  const calcularTotal = (dados: any[], campo: string) => 
    dados.reduce((acc, d) => acc + (d[campo] || 0), 0);

  const calcularMedia = (dados: any[], campo: string) => {
    const total = calcularTotal(dados, campo);
    return dados.length > 0 ? total / dados.length : 0;
  };

  const leadsAtual = calcularTotal(dadosMesAtual, "leads");
  const leadsAnterior = calcularTotal(dadosMesAnterior, "leads");
  const variacaoLeads = leadsAnterior > 0 ? ((leadsAtual - leadsAnterior) / leadsAnterior) * 100 : 0;

  const cplAtual = calcularMedia(dadosMesAtual, "cpl");
  const cplAnterior = calcularMedia(dadosMesAnterior, "cpl");
  const variacaoCpl = cplAnterior > 0 ? ((cplAtual - cplAnterior) / cplAnterior) * 100 : 0;

  const conversaoAtual = calcularMedia(dadosMesAtual, "conversao");
  const conversaoAnterior = calcularMedia(dadosMesAnterior, "conversao");
  const variacaoConversao = conversaoAnterior > 0 ? ((conversaoAtual - conversaoAnterior) / conversaoAnterior) * 100 : 0;

  const verbaAtual = calcularTotal(dadosMesAtual, "verba");
  const verbaAnterior = calcularTotal(dadosMesAnterior, "verba");
  const variacaoVerba = verbaAnterior > 0 ? ((verbaAtual - verbaAnterior) / verbaAnterior) * 100 : 0;

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
  }: {
    titulo: string;
    valor: string | number;
    variacao: number;
    icon: any;
    dados: any[];
    dataKey: string;
    formatValue?: (v: number) => string;
    invertVariacao?: boolean;
  }) => {
    const isPositivo = invertVariacao ? variacao < 0 : variacao > 0;
    
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{valor}</div>
          <div className="flex items-center gap-1 text-xs">
            {variacao !== 0 && (
              <>
                {isPositivo ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={isPositivo ? "text-green-500" : "text-red-500"}>
                  {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs mês anterior</span>
              </>
            )}
          </div>
          
          {dados.length > 0 && (
            <div className="mt-3 h-16">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📊 Métricas Históricas</h3>
        <ToggleGroup type="single" value={periodo} onValueChange={(v) => v && setPeriodo(v as any)}>
          <ToggleGroupItem value="comparacao" size="sm">Mês vs Anterior</ToggleGroupItem>
          <ToggleGroupItem value="6meses" size="sm">Últimos 6 meses</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKPICard
          titulo="Leads"
          valor={leadsAtual}
          variacao={variacaoLeads}
          icon={Users}
          dados={dadosProcessados}
          dataKey="leads"
        />
        <MiniKPICard
          titulo="CPL Médio"
          valor={formatCurrency(cplAtual)}
          variacao={variacaoCpl}
          icon={DollarSign}
          dados={dadosProcessados}
          dataKey="cpl"
          formatValue={(v) => formatCurrency(v)}
          invertVariacao={true}
        />
        <MiniKPICard
          titulo="Conversão"
          valor={`${conversaoAtual.toFixed(1)}%`}
          variacao={variacaoConversao}
          icon={Target}
          dados={dadosProcessados}
          dataKey="conversao"
          formatValue={(v) => `${v.toFixed(1)}%`}
        />
        <MiniKPICard
          titulo="Verba Investida"
          valor={formatCurrency(verbaAtual)}
          variacao={variacaoVerba}
          icon={Wallet}
          dados={dadosProcessados}
          dataKey="verba"
          formatValue={(v) => formatCurrency(v)}
        />
      </div>
    </div>
  );
}
