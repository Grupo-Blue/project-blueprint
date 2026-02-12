import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

const CORES = ["hsl(210, 80%, 55%)", "#06b6d4", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

export function CACPorCanal() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data: cacData } = useQuery({
    queryKey: ["cac-por-canal", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return [];

      const { data: leads } = await supabase
        .from("lead")
        .select("utm_source, origem_canal, venda_realizada")
        .eq("id_empresa", empresaSelecionada)
        .eq("venda_realizada", true)
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim);

      const { data: metricas } = await supabase
        .from("empresa_metricas_dia")
        .select("verba_investida")
        .eq("id_empresa", empresaSelecionada)
        .eq("tipo_negocio", "total")
        .gte("data", dataInicio)
        .lte("data", dataFim);

      if (!leads || !metricas) return [];

      const totalVerba = metricas.reduce((s, m) => s + Number(m.verba_investida || 0), 0);
      const vendasPorCanal = new Map<string, number>();
      (leads as any[]).forEach((l) => {
        const canal = l.utm_source || l.origem_canal || "Direto";
        vendasPorCanal.set(canal, (vendasPorCanal.get(canal) || 0) + 1);
      });

      const totalVendas = leads.length;

      return Array.from(vendasPorCanal.entries())
        .map(([canal, vendas]) => ({
          canal: canal.length > 15 ? canal.slice(0, 15) + "…" : canal,
          cac: totalVendas > 0 ? Math.round((totalVerba * (vendas / totalVendas)) / vendas) : 0,
          vendas,
        }))
        .sort((a, b) => a.cac - b.cac)
        .slice(0, 8);
    },
    enabled: !!empresaSelecionada,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">CAC por Canal</CardTitle>
      </CardHeader>
      <CardContent>
        {(!cacData || cacData.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cacData} margin={{ left: 10, right: 20 }}>
              <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "CAC"]} />
              <Bar dataKey="cac" radius={[4, 4, 0, 0]}>
                {cacData.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
