import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, ShoppingCart, BarChart3, Ticket } from "lucide-react";

interface KPIData {
  receita: number;
  vendas: number;
  leads: number;
  conversao: number;
  cac: number;
  ticketMedio: number;
}

interface CockpitKPIsProps {
  tipoNegocio: string;
}

export const CockpitKPIs = ({ tipoNegocio }: CockpitKPIsProps) => {
  const [kpis, setKpis] = useState<KPIData>({ receita: 0, vendas: 0, leads: 0, conversao: 0, cac: 0, ticketMedio: 0 });
  const [kpisPeriodoAnterior, setKpisPeriodoAnterior] = useState<KPIData>({ receita: 0, vendas: 0, leads: 0, conversao: 0, cac: 0, ticketMedio: 0 });
  const [loading, setLoading] = useState(true);
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();

  const { inicio, fim } = getInicioFim();
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  useEffect(() => {
    fetchKPIs();
  }, [empresaSelecionada, dataInicio, dataFim, tipoNegocio]);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("tipo_negocio", tipoNegocio)
        .gte("data", dataInicio)
        .lte("data", dataFim);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      const agregado = agregarMetricas(data || []);
      setKpis(agregado);

      // Período anterior (mesmo range, deslocado)
      const dias = Math.ceil((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const inicioAnterior = new Date(new Date(dataInicio).getTime() - dias * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const fimAnterior = new Date(new Date(dataInicio).getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      let queryAnterior = supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("tipo_negocio", tipoNegocio)
        .gte("data", inicioAnterior)
        .lte("data", fimAnterior);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        queryAnterior = queryAnterior.eq("id_empresa", empresaSelecionada);
      }

      const { data: dataAnterior } = await queryAnterior;
      setKpisPeriodoAnterior(agregarMetricas(dataAnterior || []));
    } catch (err) {
      console.error("Erro ao buscar KPIs:", err);
    } finally {
      setLoading(false);
    }
  };

  const agregarMetricas = (data: any[]): KPIData => {
    const receita = data.reduce((s, d) => s + (Number(d.valor_vendas) || 0), 0);
    const vendas = data.reduce((s, d) => s + (Number(d.vendas) || 0), 0);
    const leads = data.reduce((s, d) => s + (Number(d.leads_total) || 0), 0);
    const verba = data.reduce((s, d) => s + (Number(d.verba_investida) || 0), 0);
    const conversao = leads > 0 ? (vendas / leads) * 100 : 0;
    const cac = vendas > 0 ? verba / vendas : 0;
    const ticketMedio = vendas > 0 ? receita / vendas : 0;
    return { receita, vendas, leads, conversao, cac, ticketMedio };
  };

  const calcVariacao = (atual: number, anterior: number): number => {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / anterior) * 100;
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  const cards = [
    { label: "Receita", value: formatCurrency(kpis.receita), variacao: calcVariacao(kpis.receita, kpisPeriodoAnterior.receita), icon: DollarSign, color: "text-green-500" },
    { label: "Vendas", value: kpis.vendas.toString(), variacao: calcVariacao(kpis.vendas, kpisPeriodoAnterior.vendas), icon: ShoppingCart, color: "text-blue-500" },
    { label: "Leads", value: kpis.leads.toString(), variacao: calcVariacao(kpis.leads, kpisPeriodoAnterior.leads), icon: Users, color: "text-purple-500" },
    { label: "Conversão", value: formatPercent(kpis.conversao), variacao: calcVariacao(kpis.conversao, kpisPeriodoAnterior.conversao), icon: Target, color: "text-orange-500" },
    { label: "CAC", value: formatCurrency(kpis.cac), variacao: calcVariacao(kpis.cac, kpisPeriodoAnterior.cac), icon: BarChart3, color: "text-red-500", invertido: true },
    { label: "Ticket Médio", value: formatCurrency(kpis.ticketMedio), variacao: calcVariacao(kpis.ticketMedio, kpisPeriodoAnterior.ticketMedio), icon: Ticket, color: "text-teal-500" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-20 mb-2" />
              <div className="h-8 bg-muted rounded w-24 mb-1" />
              <div className="h-3 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isPositive = card.invertido ? card.variacao <= 0 : card.variacao >= 0;
        return (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              </div>
              <p className="text-xl font-bold tracking-tight">{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                  {card.variacao > 0 ? "+" : ""}{formatPercent(card.variacao)}
                </span>
                <span className="text-xs text-muted-foreground">vs anterior</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
