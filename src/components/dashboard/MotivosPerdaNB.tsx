import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

const CORES = ["hsl(var(--primary))", "#06b6d4", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function MotivosPerdaNB() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data: motivos } = useQuery({
    queryKey: ["motivos-perda-nb", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      const { data } = await supabase
        .from("lead")
        .select("motivo_perda")
        .eq("id_empresa", empresaSelecionada)
        .eq("stage_atual", "Perdido")
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim)
        .or("cliente_status.is.null,cliente_status.not.in.(cliente,ex_cliente)")
        .not("motivo_perda", "is", null);

      if (!data) return [];
      const map = new Map<string, number>();
      (data as any[]).forEach((l) => {
        const m = l.motivo_perda || "Não informado";
        map.set(m, (map.get(m) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
    enabled: !!empresaSelecionada,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Motivos de Perda (NB)</CardTitle>
      </CardHeader>
      <CardContent>
        {(!motivos || motivos.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados de perda no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={motivos} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {motivos.map((_, i) => (
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
