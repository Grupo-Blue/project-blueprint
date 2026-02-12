import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingDown, DollarSign, Users } from "lucide-react";
import { useMemo } from "react";

export function RenovacaoKPIs() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data } = useQuery({
    queryKey: ["renovacao-kpis", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return null;
      const { data: leads } = await supabase
        .from("lead")
        .select("venda_realizada, valor_venda, stage_atual")
        .eq("id_empresa", empresaSelecionada)
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim)
        .in("cliente_status", ["cliente", "ex_cliente"]);

      if (!leads) return null;
      const total = leads.length;
      const vendas = leads.filter((l: any) => l.venda_realizada).length;
      const perdidos = leads.filter((l: any) => l.stage_atual === "Perdido").length;
      const receita = leads.filter((l: any) => l.venda_realizada).reduce((s: number, l: any) => s + Number(l.valor_venda || 0), 0);

      return { total, taxaRenovacao: total > 0 ? (vendas / total) * 100 : 0, churn: total > 0 ? (perdidos / total) * 100 : 0, receita, vendas };
    },
    enabled: !!empresaSelecionada,
  });

  const kpis = [
    { label: "Renovações", valor: data?.total || 0, icon: Users, fmt: (v: number) => v.toString() },
    { label: "Taxa Renovação", valor: data?.taxaRenovacao || 0, icon: RefreshCw, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: "Churn", valor: data?.churn || 0, icon: TrendingDown, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: "Receita Renovação", valor: data?.receita || 0, icon: DollarSign, fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            <k.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{k.fmt(k.valor)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
