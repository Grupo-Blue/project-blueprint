import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";

interface VendedorStats {
  nome: string;
  leads: number;
  vendas: number;
  conversao: number;
  ticketMedio: number;
  tempoMedioResposta: number | null;
}

export function RankingVendedores() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];
  const [sortBy, setSortBy] = useState<keyof VendedorStats>("vendas");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: ranking } = useQuery({
    queryKey: ["ranking-vendedores", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      const { data } = await supabase
        .from("lead")
        .select("proprietario_nome, venda_realizada, valor_venda, tempo_primeira_resposta_seg")
        .eq("id_empresa", empresaSelecionada)
        .gte("data_criacao", dataInicio)
        .lte("data_criacao", dataFim)
        .not("proprietario_nome", "is", null);

      if (!data) return [];

      const map = new Map<string, { leads: number; vendas: number; valorTotal: number; tempos: number[] }>();
      (data as any[]).forEach((l) => {
        const nome = l.proprietario_nome!;
        const curr = map.get(nome) || { leads: 0, vendas: 0, valorTotal: 0, tempos: [] };
        curr.leads++;
        if (l.venda_realizada) {
          curr.vendas++;
          curr.valorTotal += Number(l.valor_venda || 0);
        }
        if (l.tempo_primeira_resposta_seg != null) curr.tempos.push(l.tempo_primeira_resposta_seg);
        map.set(nome, curr);
      });

      return Array.from(map.entries()).map(([nome, s]): VendedorStats => ({
        nome,
        leads: s.leads,
        vendas: s.vendas,
        conversao: s.leads > 0 ? (s.vendas / s.leads) * 100 : 0,
        ticketMedio: s.vendas > 0 ? s.valorTotal / s.vendas : 0,
        tempoMedioResposta: s.tempos.length > 0 ? s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length : null,
      }));
    },
    enabled: !!empresaSelecionada,
  });

  const handleSort = (col: keyof VendedorStats) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  const sorted = [...(ranking || [])].sort((a, b) => {
    const va = a[sortBy] ?? 99999;
    const vb = b[sortBy] ?? 99999;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortHeader = ({ col, label }: { col: keyof VendedorStats; label: string }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => handleSort(col)}>
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  const fmtTempo = (seg: number | null) => {
    if (seg == null) return "—";
    if (seg < 60) return `${Math.round(seg)}s`;
    return `${Math.round(seg / 60)}min`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ranking de Vendedores</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <SortHeader col="leads" label="Leads" />
              <SortHeader col="vendas" label="Vendas" />
              <SortHeader col="conversao" label="Conversão" />
              <SortHeader col="ticketMedio" label="Ticket Médio" />
              <SortHeader col="tempoMedioResposta" label="Tempo Resp." />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
            ) : sorted.map((v) => (
              <TableRow key={v.nome}>
                <TableCell className="font-medium">{v.nome}</TableCell>
                <TableCell>{v.leads}</TableCell>
                <TableCell>{v.vendas}</TableCell>
                <TableCell>{v.conversao.toFixed(1)}%</TableCell>
                <TableCell>R$ {v.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</TableCell>
                <TableCell>{fmtTempo(v.tempoMedioResposta)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
