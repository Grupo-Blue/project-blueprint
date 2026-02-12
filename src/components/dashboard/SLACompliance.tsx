import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Timer, CheckCircle, AlertTriangle } from "lucide-react";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";

const SLA_LIMITE_SEG = 900; // 15 minutos

export function SLACompliance() {
  const { getInicioFim } = usePeriodo();
  const { empresaSelecionada } = useEmpresa();
  const { inicio, fim } = useMemo(() => getInicioFim(), [getInicioFim]);
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  const { data, isLoading } = useQuery({
    queryKey: ["sla-compliance", empresaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      const query = empresaSelecionada === "todas"
        ? supabase.from("lead").select("tempo_primeira_resposta_seg, proprietario_nome").gte("data_criacao", dataInicio).lte("data_criacao", dataFim + "T23:59:59").or("merged.is.null,merged.eq.false").not("nome_lead", "like", "%(cópia)%")
        : supabase.from("lead").select("tempo_primeira_resposta_seg, proprietario_nome").eq("id_empresa", empresaSelecionada).gte("data_criacao", dataInicio).lte("data_criacao", dataFim + "T23:59:59").or("merged.is.null,merged.eq.false").not("nome_lead", "like", "%(cópia)%");

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  const stats = useMemo(() => {
    if (!data || data.length === 0) return { total: 0, dentroSLA: 0, percentual: 0, porVendedor: [] };

    const comTempo = data.filter((l: any) => l.tempo_primeira_resposta_seg != null);
    const dentroSLA = comTempo.filter((l: any) => l.tempo_primeira_resposta_seg <= SLA_LIMITE_SEG).length;
    const percentual = comTempo.length > 0 ? (dentroSLA / comTempo.length) * 100 : 0;

    // Por vendedor
    const vendedorMap: Record<string, { total: number; dentroSLA: number }> = {};
    comTempo.forEach((l: any) => {
      const nome = l.proprietario_nome || "Sem vendedor";
      if (!vendedorMap[nome]) vendedorMap[nome] = { total: 0, dentroSLA: 0 };
      vendedorMap[nome].total++;
      if (l.tempo_primeira_resposta_seg <= SLA_LIMITE_SEG) vendedorMap[nome].dentroSLA++;
    });

    const porVendedor = Object.entries(vendedorMap)
      .map(([nome, v]) => ({ nome, ...v, percentual: v.total > 0 ? (v.dentroSLA / v.total) * 100 : 0 }))
      .sort((a, b) => b.percentual - a.percentual);

    return { total: comTempo.length, dentroSLA, percentual, porVendedor, semTempo: data.length - comTempo.length };
  }, [data]);

  if (isLoading) {
    return <Card><CardContent className="pt-6"><div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Timer className="h-4 w-4" />
          SLA de Primeiro Contato
        </CardTitle>
        <CardDescription className="text-xs">Meta: responder em até 15 minutos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span>Compliance</span>
              <span className={`font-bold ${stats.percentual >= 80 ? "text-green-600" : stats.percentual >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                {stats.percentual.toFixed(0)}%
              </span>
            </div>
            <Progress value={stats.percentual} className="h-2" />
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Leads medidos</div>
            <div className="text-lg font-bold">{stats.total}</div>
          </div>
        </div>

        {stats.semTempo != null && stats.semTempo > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            {stats.semTempo} leads sem tempo de resposta registrado
          </div>
        )}

        {/* Por vendedor */}
        {stats.porVendedor.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Por Vendedor</div>
            {stats.porVendedor.map((v) => (
              <div key={v.nome} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate">{v.nome}</span>
                <Progress value={v.percentual} className="h-1.5 flex-1" />
                <Badge variant={v.percentual >= 80 ? "default" : v.percentual >= 50 ? "secondary" : "destructive"} className="text-[10px] px-1.5">
                  {v.percentual.toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        )}

        {stats.total === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum lead com tempo de resposta registrado no período
          </div>
        )}
      </CardContent>
    </Card>
  );
}
