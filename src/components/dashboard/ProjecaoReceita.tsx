import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Target } from "lucide-react";
import { startOfMonth, endOfMonth, format, getDaysInMonth, getDate, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { formatCurrency } from "@/lib/utils";

interface ProjecaoReceitaProps {
  tipoNegocio: string;
}

export function ProjecaoReceita({ tipoNegocio }: ProjecaoReceitaProps) {
  const { getInicioFim } = usePeriodo();
  const { empresaSelecionada } = useEmpresa();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];
  const diasNoMes = getDaysInMonth(inicio);
  const hoje = new Date();
  const diaAtual = inicio.getMonth() === hoje.getMonth() && inicio.getFullYear() === hoje.getFullYear() ? getDate(hoje) : diasNoMes;

  // Buscar meta do mês
  const { data: meta } = useQuery({
    queryKey: ["meta-receita-projecao", empresaSelecionada, inicio.getFullYear(), inicio.getMonth() + 1, tipoNegocio],
    queryFn: async () => {
      const tipos = tipoNegocio === "total" ? ["total", "new_business", "renovacao"] : [tipoNegocio];
      const { data } = await supabase
        .from("meta_comercial")
        .select("meta_receita")
        .eq("id_empresa", empresaSelecionada)
        .eq("ano", inicio.getFullYear())
        .eq("mes", inicio.getMonth() + 1)
        .in("tipo_negocio", tipos);
      if (!data || data.length === 0) return 0;
      if (tipoNegocio === "total") {
        const totalRow = data.find((d: any) => true);
        return Number(totalRow?.meta_receita) || 0;
      }
      return data.reduce((s: number, d: any) => s + (Number(d.meta_receita) || 0), 0);
    },
    enabled: !!empresaSelecionada && empresaSelecionada !== "todas",
  });

  // Buscar vendas no período, dia a dia
  const { data: vendas, isLoading } = useQuery({
    queryKey: ["vendas-projecao", empresaSelecionada, dataInicio, dataFim, tipoNegocio],
    queryFn: async () => {
      let query = supabase
        .from("lead")
        .select("valor_venda, data_venda, cliente_status")
        .eq("id_empresa", empresaSelecionada)
        .eq("venda_realizada", true)
        .not("valor_venda", "is", null)
        .or("merged.is.null,merged.eq.false")
        .not("nome_lead", "like", "%(cópia)%")
        .gte("data_venda", dataInicio)
        .lte("data_venda", dataFim);

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar por tipo negocio
      return (data || []).filter((l: any) => {
        if (tipoNegocio === "total") return true;
        const isRenovacao = ["cliente", "ex_cliente"].includes(l.cliente_status || "");
        return tipoNegocio === "renovacao" ? isRenovacao : !isRenovacao;
      });
    },
    enabled: !!empresaSelecionada && empresaSelecionada !== "todas",
  });

  // Montar gráfico dia a dia
  const chartData = useMemo(() => {
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    const vendasPorDia: Record<string, number> = {};
    vendas?.forEach((v: any) => {
      if (v.data_venda) {
        const d = v.data_venda.split("T")[0];
        vendasPorDia[d] = (vendasPorDia[d] || 0) + (Number(v.valor_venda) || 0);
      }
    });

    let acumulado = 0;
    return dias.map((dia, i) => {
      const diaStr = format(dia, "yyyy-MM-dd");
      const diaNum = i + 1;
      acumulado += vendasPorDia[diaStr] || 0;
      const metaIdeal = meta ? (meta / diasNoMes) * diaNum : null;
      const mostrar = diaNum <= diaAtual;
      return {
        dia: format(dia, "dd"),
        receita: mostrar ? acumulado : null,
        meta: metaIdeal,
      };
    });
  }, [vendas, meta, inicio, fim, diasNoMes, diaAtual]);

  const receitaTotal = vendas?.reduce((s: number, v: any) => s + (Number(v.valor_venda) || 0), 0) || 0;
  const projecao = diaAtual > 0 ? (receitaTotal / diaAtual) * diasNoMes : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          Projeção de Receita
        </CardTitle>
        <CardDescription className="text-xs">
          {format(inicio, "MMMM yyyy", { locale: ptBR })} — Projeção: {formatCurrency(projecao)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="text-[10px] text-muted-foreground">Realizado</div>
            <div className="text-sm font-bold">{formatCurrency(receitaTotal)}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="text-[10px] text-muted-foreground">Meta</div>
            <div className="text-sm font-bold">{meta ? formatCurrency(meta) : "—"}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="text-[10px] text-muted-foreground">Projeção</div>
            <div className={`text-sm font-bold ${meta && projecao >= meta ? "text-green-600" : "text-orange-600"}`}>
              {formatCurrency(projecao)}
            </div>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} width={35} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
              />
              {meta && <ReferenceLine y={meta} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />}
              <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" dot={false} name="Meta Ideal" />
              <Line type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Receita Acumulada" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
