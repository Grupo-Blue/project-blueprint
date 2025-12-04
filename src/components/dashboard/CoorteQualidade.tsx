import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { subMonths, startOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CoorteQualidadeProps {
  empresaId: string;
}

export function CoorteQualidade({ empresaId }: CoorteQualidadeProps) {
  const { data: coortes, isLoading } = useQuery({
    queryKey: ["coorte-qualidade", empresaId],
    queryFn: async () => {
      const dataInicio = startOfMonth(subMonths(new Date(), 5));

      const { data, error } = await supabase
        .from("lead")
        .select("data_criacao, is_mql, levantou_mao, tem_reuniao, reuniao_realizada, venda_realizada")
        .eq("id_empresa", empresaId)
        .gte("data_criacao", dataInicio.toISOString());

      if (error) throw error;

      // Agrupar por mês
      const porMes: any = {};
      
      data?.forEach((lead) => {
        const mes = format(new Date(lead.data_criacao), "yyyy-MM");
        if (!porMes[mes]) {
          porMes[mes] = {
            mes,
            mesLabel: format(new Date(lead.data_criacao), "MMM/yy", { locale: ptBR }),
            leads: 0,
            mqls: 0,
            levantadas: 0,
            reunioes: 0,
            vendas: 0,
          };
        }
        porMes[mes].leads++;
        if (lead.is_mql) porMes[mes].mqls++;
        if (lead.levantou_mao) porMes[mes].levantadas++;
        if (lead.tem_reuniao || lead.reuniao_realizada) porMes[mes].reunioes++;
        if (lead.venda_realizada) porMes[mes].vendas++;
      });

      // Converter para array e calcular percentuais
      return Object.values(porMes)
        .sort((a: any, b: any) => a.mes.localeCompare(b.mes))
        .map((m: any) => ({
          ...m,
          percentMql: m.leads > 0 ? (m.mqls / m.leads) * 100 : 0,
          percentLevantada: m.leads > 0 ? (m.levantadas / m.leads) * 100 : 0,
          percentReuniao: m.leads > 0 ? (m.reunioes / m.leads) * 100 : 0,
          percentVenda: m.leads > 0 ? (m.vendas / m.leads) * 100 : 0,
        }));
    },
    enabled: !!empresaId,
  });

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

  if (!coortes || coortes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📈 Qualidade de Lead por Coorte</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Sem dados de leads para análise de coorte
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calcular tendência (último mês vs penúltimo)
  const ultimoMes = coortes[coortes.length - 1];
  const penultimoMes = coortes.length > 1 ? coortes[coortes.length - 2] : null;
  
  const tendenciaConversao = penultimoMes 
    ? ultimoMes.percentVenda - penultimoMes.percentVenda 
    : 0;

  const chartConfig = {
    percentMql: { label: "% MQL", color: "hsl(262 83% 58%)" },
    percentLevantada: { label: "% Levantada", color: "hsl(38 92% 50%)" },
    percentReuniao: { label: "% Reunião", color: "hsl(var(--primary))" },
    percentVenda: { label: "% Venda", color: "hsl(142 76% 36%)" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              📈 Qualidade de Lead por Coorte
            </CardTitle>
            <CardDescription>
              Taxas de conversão por mês de entrada do lead
            </CardDescription>
          </div>
          {tendenciaConversao !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${tendenciaConversao > 0 ? "text-green-500" : "text-red-500"}`}>
              {tendenciaConversao > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {tendenciaConversao > 0 ? "+" : ""}{tendenciaConversao.toFixed(1)}pp
              </span>
              <span className="text-muted-foreground text-xs ml-1">conversão</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={coortes} layout="horizontal">
              <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
              <YAxis 
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value, name) => {
                    const config = chartConfig[name as keyof typeof chartConfig];
                    return [`${Number(value).toFixed(1)}%`, config?.label || name];
                  }}
                />}
              />
              <Legend />
              <Bar dataKey="percentMql" name="% MQL" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="percentLevantada" name="% Levantada" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="percentReuniao" name="% Reunião" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="percentVenda" name="% Venda" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Tabela resumo */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Mês</th>
                <th className="text-right py-2 font-medium">Leads</th>
                <th className="text-right py-2 font-medium">MQL</th>
                <th className="text-right py-2 font-medium">Levantadas</th>
                <th className="text-right py-2 font-medium">Reuniões</th>
                <th className="text-right py-2 font-medium">Vendas</th>
              </tr>
            </thead>
            <tbody>
              {coortes.slice(-3).map((c: any) => (
                <tr key={c.mes} className="border-b border-muted">
                  <td className="py-2 font-medium">{c.mesLabel}</td>
                  <td className="text-right py-2">{c.leads}</td>
                  <td className="text-right py-2">{c.percentMql.toFixed(0)}%</td>
                  <td className="text-right py-2">{c.percentLevantada.toFixed(0)}%</td>
                  <td className="text-right py-2">{c.percentReuniao.toFixed(0)}%</td>
                  <td className="text-right py-2 font-semibold">{c.percentVenda.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
