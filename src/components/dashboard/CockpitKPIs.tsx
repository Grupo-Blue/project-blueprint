import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { DollarSign, Users, Target, ShoppingCart, BarChart3, Ticket } from "lucide-react";
import { aplicarFiltroComercial } from "@/lib/empresa-constants";
import { LiquidKPICard } from "@/components/dashboard/LiquidKPICard";

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

      query = aplicarFiltroComercial(query, empresaSelecionada);

      const { data, error } = await query;
      if (error) throw error;

      const agregado = agregarMetricas(data || []);
      setKpis(agregado);

      const dias = Math.ceil((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const inicioAnterior = new Date(new Date(dataInicio).getTime() - dias * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const fimAnterior = new Date(new Date(dataInicio).getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      let queryAnterior = supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("tipo_negocio", tipoNegocio)
        .gte("data", inicioAnterior)
        .lte("data", fimAnterior);

      queryAnterior = aplicarFiltroComercial(queryAnterior, empresaSelecionada);

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
    { label: "Receita", value: formatCurrency(kpis.receita), variacao: calcVariacao(kpis.receita, kpisPeriodoAnterior.receita), icon: DollarSign, glow: "amber" as const },
    { label: "Vendas", value: kpis.vendas.toString(), variacao: calcVariacao(kpis.vendas, kpisPeriodoAnterior.vendas), icon: ShoppingCart, glow: "cyan" as const },
    { label: "Leads", value: kpis.leads.toString(), variacao: calcVariacao(kpis.leads, kpisPeriodoAnterior.leads), icon: Users, glow: "cyan" as const },
    { label: "Conversão", value: formatPercent(kpis.conversao), variacao: calcVariacao(kpis.conversao, kpisPeriodoAnterior.conversao), icon: Target, glow: "mint" as const, progressRing: { value: kpis.conversao, max: 100 } },
    { label: "CAC", value: formatCurrency(kpis.cac), variacao: calcVariacao(kpis.cac, kpisPeriodoAnterior.cac), icon: BarChart3, glow: "amber" as const, invertido: true },
    { label: "Ticket Médio", value: formatCurrency(kpis.ticketMedio), variacao: calcVariacao(kpis.ticketMedio, kpisPeriodoAnterior.ticketMedio), icon: Ticket, glow: "mint" as const },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card p-5 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-3" />
            <div className="h-8 bg-muted rounded w-24 mb-2" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <LiquidKPICard
          key={card.label}
          label={card.label}
          value={card.value}
          variacao={card.variacao}
          icon={card.icon}
          glow={card.glow}
          invertido={card.invertido}
          progressRing={card.progressRing}
          delay={i * 60}
        />
      ))}
    </div>
  );
};
