import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function LeadsPorCanal() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data: canais } = useQuery({
    queryKey: ["leads-por-canal", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      const { data } = await supabase
        .from("lead")
        .select("origem_canal, utm_source, venda_realizada, valor_venda")
        .eq("id_empresa", empresaSelecionada)
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim);

      if (!data) return [];
      const map = new Map<string, { leads: number; vendas: number; receita: number }>();
      (data as any[]).forEach((l) => {
        const canal = l.utm_source || l.origem_canal || "Direto";
        const curr = map.get(canal) || { leads: 0, vendas: 0, receita: 0 };
        curr.leads++;
        if (l.venda_realizada) {
          curr.vendas++;
          curr.receita += Number(l.valor_venda || 0);
        }
        map.set(canal, curr);
      });

      return Array.from(map.entries())
        .map(([canal, s]) => ({
          canal,
          leads: s.leads,
          vendas: s.vendas,
          conversao: s.leads > 0 ? (s.vendas / s.leads) * 100 : 0,
          receita: s.receita,
        }))
        .sort((a, b) => b.leads - a.leads);
    },
    enabled: !!empresaSelecionada,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Leads por Canal</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Vendas</TableHead>
              <TableHead>Conversão</TableHead>
              <TableHead>Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!canais || canais.length === 0) ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
            ) : canais.map((c) => (
              <TableRow key={c.canal}>
                <TableCell className="font-medium">{c.canal}</TableCell>
                <TableCell>{c.leads}</TableCell>
                <TableCell>{c.vendas}</TableCell>
                <TableCell>{c.conversao.toFixed(1)}%</TableCell>
                <TableCell>R$ {c.receita.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
