import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { subMonths, startOfMonth } from "date-fns";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(262 83% 58%)",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(var(--destructive))",
];

export function DistribuicaoEmpresa() {
  const { data: distribuicao, isLoading } = useQuery({
    queryKey: ["distribuicao-empresa"],
    queryFn: async () => {
      const dataInicio = startOfMonth(subMonths(new Date(), 5));

      const { data: semanas, error: semanasError } = await supabase
        .from("semana")
        .select("id_semana")
        .gte("data_inicio", dataInicio.toISOString());

      if (semanasError) throw semanasError;
      if (!semanas || semanas.length === 0) return [];

      const { data: metricas, error } = await supabase
        .from("empresa_semana_metricas")
        .select("id_empresa, verba_investida, vendas, empresa!inner(nome)")
        .in("id_semana", semanas.map(s => s.id_semana));

      if (error) throw error;

      // Agrupar por empresa
      const agrupado = metricas?.reduce((acc: any, m: any) => {
        const empresaId = m.id_empresa;
        if (!acc[empresaId]) {
          acc[empresaId] = {
            nome: m.empresa.nome,
            gasto: 0,
            vendas: 0,
          };
        }
        acc[empresaId].gasto += m.verba_investida;
        acc[empresaId].vendas += m.vendas;
        return acc;
      }, {});

      return Object.values(agrupado || {});
    },
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!distribuicao || distribuicao.length === 0) {
    return null;
  }

  interface EmpresaDistribuicao {
    nome: string;
    gasto: number;
    vendas: number;
  }

  const typedDistribuicao = distribuicao as EmpresaDistribuicao[];

  const totalGasto = typedDistribuicao.reduce((acc, d) => acc + d.gasto, 0);
  const totalVendas = typedDistribuicao.reduce((acc, d) => acc + d.vendas, 0);

  const dadosGasto = typedDistribuicao.map((d) => ({
    name: d.nome,
    value: d.gasto,
  }));

  const dadosVendas = typedDistribuicao.map((d) => ({
    name: d.nome,
    value: d.vendas,
  }));

  // Detectar alertas de queima de capital
  const alertas = typedDistribuicao
    .map((d) => {
      const percentGasto = totalGasto > 0 ? (d.gasto / totalGasto) * 100 : 0;
      const percentVendas = totalVendas > 0 ? (d.vendas / totalVendas) * 100 : 0;
      const diferenca = percentGasto - percentVendas;
      
      if (diferenca > 20 && percentGasto > 10) {
        return {
          empresa: d.nome,
          percentGasto: percentGasto.toFixed(0),
          percentVendas: percentVendas.toFixed(0),
          diferenca: diferenca.toFixed(0),
        };
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const chartConfig = {
    gasto: { label: "Gasto" },
    vendas: { label: "Vendas" },
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // CustomLabel - percent do Recharts já vem como 0-1, então multiplicamos por 100
  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🥧 Distribuição Gasto vs Resultado
        </h3>
        <div className="mt-1">
          <MetricaComInfo 
            label="Comparação % do gasto vs % das vendas por empresa (últimos 6 meses)"
            info="Mostra como o investimento em mídia está distribuído entre empresas comparado com a distribuição de vendas. Alertas são gerados quando uma empresa consome mais % do orçamento do que gera em vendas."
          />
        </div>
      </div>
      <div>
        {alertas.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {alertas.map((a, i) => (
                <div key={i}>
                  <strong>{a.empresa}</strong>: {a.percentGasto}% do gasto, {a.percentVendas}% das vendas — 
                  <span className="font-semibold"> Alerta de queima de capital!</span>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-center mb-2">% do Gasto</h4>
            <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosGasto}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {dadosGasto.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={<ChartTooltipContent 
                      formatter={(value) => formatCurrency(Number(value))}
                    />}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Total: {formatCurrency(totalGasto)}
            </p>
          </div>

          <div>
            <h4 className="text-xs sm:text-sm font-medium text-center mb-2">% das Vendas</h4>
            <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosVendas}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {dadosVendas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Total: {totalVendas} vendas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
