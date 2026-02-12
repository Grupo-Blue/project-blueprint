import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatCurrency } from "@/lib/utils";
import { aplicarFiltroComercial } from "@/lib/empresa-constants";

const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];
const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type MetricaKey = "receita" | "leads" | "conversao" | "cac";

export function ComparativoAnual() {
  const { empresaSelecionada } = useEmpresa();
  const anoAtual = new Date().getFullYear();
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([String(anoAtual), String(anoAtual - 1)]);
  const [metrica, setMetrica] = useState<MetricaKey>("receita");

  const anosDisponiveis = [anoAtual, anoAtual - 1, anoAtual - 2];

  const { data: dadosAnuais, isLoading } = useQuery({
    queryKey: ["comparativo-anual", empresaSelecionada, anosSelecionados],
    queryFn: async () => {
      const result: Record<string, any[]> = {};

      for (const anoStr of anosSelecionados) {
        const ano = Number(anoStr);
        const inicioAno = `${ano}-01-01`;
        const fimAno = `${ano}-12-31`;

        let query = supabase
          .from("empresa_metricas_dia")
          .select("data, leads_total, verba_investida, vendas, valor_vendas")
          .gte("data", inicioAno)
          .lte("data", fimAno)
          .eq("tipo_negocio", "total");

        query = aplicarFiltroComercial(query, empresaSelecionada);

        const { data } = await query;
        result[anoStr] = data || [];
      }

      return result;
    },
    enabled: !!empresaSelecionada && anosSelecionados.length > 0,
  });

  const chartData = useMemo(() => {
    if (!dadosAnuais) return [];

    return MESES_LABEL.map((label, i) => {
      const mesNum = i + 1;
      const row: any = { mes: label };

      anosSelecionados.forEach((ano) => {
        const metricas = dadosAnuais[ano]?.filter((m: any) => {
          const d = new Date(m.data);
          return d.getMonth() === i;
        }) || [];

        const totalLeads = metricas.reduce((s: number, m: any) => s + (m.leads_total || 0), 0);
        const totalVerba = metricas.reduce((s: number, m: any) => s + (Number(m.verba_investida) || 0), 0);
        const totalVendas = metricas.reduce((s: number, m: any) => s + (m.vendas || 0), 0);
        const totalReceita = metricas.reduce((s: number, m: any) => s + (Number(m.valor_vendas) || 0), 0);

        switch (metrica) {
          case "receita": row[ano] = totalReceita; break;
          case "leads": row[ano] = totalLeads; break;
          case "conversao": row[ano] = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0; break;
          case "cac": row[ano] = totalVendas > 0 ? totalVerba / totalVendas : 0; break;
        }
      });

      return row;
    });
  }, [dadosAnuais, anosSelecionados, metrica]);

  const formatValue = (v: number) => {
    if (metrica === "receita" || metrica === "cac") return formatCurrency(v);
    if (metrica === "conversao") return `${v.toFixed(1)}%`;
    return String(v);
  };

  if (isLoading) {
    return <Card><CardContent className="pt-6"><div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Comparativo Anual
            </CardTitle>
            <CardDescription className="text-xs">Sobreposição de métricas por ano</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleGroup type="single" value={metrica} onValueChange={(v) => v && setMetrica(v as MetricaKey)} className="bg-muted rounded-md p-0.5">
              <ToggleGroupItem value="receita" className="text-[10px] px-2 h-6 data-[state=on]:bg-background">Receita</ToggleGroupItem>
              <ToggleGroupItem value="leads" className="text-[10px] px-2 h-6 data-[state=on]:bg-background">Leads</ToggleGroupItem>
              <ToggleGroupItem value="conversao" className="text-[10px] px-2 h-6 data-[state=on]:bg-background">Conversão</ToggleGroupItem>
              <ToggleGroupItem value="cac" className="text-[10px] px-2 h-6 data-[state=on]:bg-background">CAC</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="multiple" value={anosSelecionados} onValueChange={(v) => v.length > 0 && setAnosSelecionados(v)} className="bg-muted rounded-md p-0.5">
              {anosDisponiveis.map((a) => (
                <ToggleGroupItem key={a} value={String(a)} className="text-[10px] px-2 h-6 data-[state=on]:bg-background">
                  {a}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => metrica === "receita" || metrica === "cac" ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))} width={40} />
              <Tooltip formatter={(value: number) => formatValue(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              {anosSelecionados.map((ano, i) => (
                <Line key={ano} type="monotone" dataKey={ano} stroke={CORES[i]} strokeWidth={2} dot={{ r: 2 }} name={ano} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
