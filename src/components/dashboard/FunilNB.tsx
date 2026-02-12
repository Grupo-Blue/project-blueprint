import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";

export function FunilNB() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data: funilData } = useQuery({
    queryKey: ["funil-nb", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return null;
      const { data } = await supabase
        .from("lead")
        .select("is_mql, levantou_mao, reuniao_realizada, venda_realizada")
        .eq("id_empresa", empresaSelecionada)
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim)
        .or("cliente_status.is.null,cliente_status.not.in.(cliente,ex_cliente)");

      if (!data) return { leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 };

      return {
        leads: data.length,
        mqls: data.filter((l: any) => l.is_mql).length,
        levantadas: data.filter((l: any) => l.levantou_mao).length,
        reunioes: data.filter((l: any) => l.reuniao_realizada).length,
        vendas: data.filter((l: any) => l.venda_realizada).length,
      };
    },
    enabled: !!empresaSelecionada,
  });

  const d = funilData || { leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 };
  const taxa = (a: number, b: number) => (b === 0 ? "0%" : `${((a / b) * 100).toFixed(1)}%`);
  const max = Math.max(d.leads, 1);

  const etapas = [
    { label: "Leads", valor: d.leads, cor: "bg-blue-500" },
    { label: "MQLs", valor: d.mqls, cor: "bg-cyan-500", t: taxa(d.mqls, d.leads) },
    { label: "Levantadas", valor: d.levantadas, cor: "bg-teal-500", t: taxa(d.levantadas, d.mqls) },
    { label: "Reuniões", valor: d.reunioes, cor: "bg-green-500", t: taxa(d.reunioes, d.levantadas) },
    { label: "Vendas", valor: d.vendas, cor: "bg-emerald-600", t: taxa(d.vendas, d.reunioes) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funil New Business</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {etapas.map((e, i) => {
          const w = Math.max((e.valor / max) * 100, 10);
          return (
            <div key={e.label}>
              {i > 0 && (
                <div className="flex items-center justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">{e.t}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium text-right">{e.label}</div>
                <div className="flex-1">
                  <div className={`h-8 ${e.cor} rounded-md flex items-center justify-end pr-3`} style={{ width: `${w}%` }}>
                    <span className="text-white font-bold text-sm">{e.valor.toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Taxa Lead → Venda</span>
          <span className="font-bold text-lg">{taxa(d.vendas, d.leads)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
