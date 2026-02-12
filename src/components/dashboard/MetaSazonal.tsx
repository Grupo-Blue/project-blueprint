import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarDays } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatCurrency } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MetaSazonalProps {
  tipoNegocio: string;
}

export function MetaSazonal({ tipoNegocio }: MetaSazonalProps) {
  const { empresaSelecionada } = useEmpresa();
  const anoAtual = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["meta-sazonal", empresaSelecionada, anoAtual, tipoNegocio],
    queryFn: async () => {
      // Buscar metas do ano
      const { data: metas } = await supabase
        .from("meta_comercial")
        .select("mes, meta_receita, indice_sazonal, tipo_negocio")
        .eq("id_empresa", empresaSelecionada)
        .eq("ano", anoAtual);

      // Buscar realizado do ano
      let query = supabase
        .from("empresa_metricas_dia")
        .select("data, valor_vendas, tipo_negocio")
        .eq("id_empresa", empresaSelecionada)
        .gte("data", `${anoAtual}-01-01`)
        .lte("data", `${anoAtual}-12-31`);

      if (tipoNegocio !== "total") {
        query = query.eq("tipo_negocio", tipoNegocio);
      } else {
        query = query.eq("tipo_negocio", "total");
      }

      const { data: metricas } = await query;

      return { metas: metas || [], metricas: metricas || [] };
    },
    enabled: !!empresaSelecionada && empresaSelecionada !== "todas",
  });

  const chartData = useMemo(() => {
    if (!data) return [];

    return MESES.map((label, i) => {
      const mesNum = i + 1;

      // Meta para o tipo selecionado
      let metaReceita = 0;
      if (tipoNegocio === "total") {
        const metaTotal = data.metas.find((m: any) => m.mes === mesNum && m.tipo_negocio === "total");
        metaReceita = Number(metaTotal?.meta_receita) || 0;
      } else {
        const metaTipo = data.metas.find((m: any) => m.mes === mesNum && m.tipo_negocio === tipoNegocio);
        metaReceita = Number(metaTipo?.meta_receita) || 0;
      }

      // Realizado
      const realizadoMes = data.metricas
        .filter((m: any) => new Date(m.data).getMonth() === i)
        .reduce((s: number, m: any) => s + (Number(m.valor_vendas) || 0), 0);

      return { mes: label, meta: metaReceita, realizado: realizadoMes };
    });
  }, [data, tipoNegocio]);

  if (isLoading) {
    return <Card><CardContent className="pt-6"><div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></CardContent></Card>;
  }

  const hasMetas = chartData.some((d) => d.meta > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4" />
          Meta vs Realizado {anoAtual}
        </CardTitle>
        <CardDescription className="text-xs">
          {hasMetas ? "Receita mensal comparada com metas" : "Configure metas para ver a comparação"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={35} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              {hasMetas && <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />}
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
