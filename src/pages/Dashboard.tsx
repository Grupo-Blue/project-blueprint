import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, DollarSign, Target } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AlertaIntegracao } from "@/components/AlertaIntegracao";
import { ValidacaoUTM } from "@/components/ValidacaoUTM";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { InteligenciaIA } from "@/components/InteligenciaIA";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { KPIsHistoricos } from "@/components/dashboard/KPIsHistoricos";
import { DistribuicaoEmpresa } from "@/components/dashboard/DistribuicaoEmpresa";
import { CoorteQualidade } from "@/components/dashboard/CoorteQualidade";
import { TrackingScore } from "@/components/dashboard/TrackingScore";
import { ROIProfitability } from "@/components/dashboard/ROIProfitability";
import { CriativosFadiga } from "@/components/dashboard/CriativosFadiga";
import { AlertasAnomalias } from "@/components/dashboard/AlertasAnomalias";
import { PacingOrcamento } from "@/components/dashboard/PacingOrcamento";
import { TempoCiclo } from "@/components/dashboard/TempoCiclo";
import { MetricasMultiRede } from "@/components/dashboard/MetricasMultiRede";
import { StapeHealthWidget } from "@/components/dashboard/StapeHealthWidget";
import { ServerSideComparison } from "@/components/dashboard/ServerSideComparison";
import { LiquidKPICard } from "@/components/dashboard/LiquidKPICard";
import { TrafficFlowChart } from "@/components/dashboard/TrafficFlowChart";
import { LeadQualityBubbles } from "@/components/dashboard/LeadQualityBubbles";
import { LiquidFunnel } from "@/components/dashboard/LiquidFunnel";

const Dashboard = () => {
  const { getDataReferencia, labelPeriodo } = usePeriodo();
  const { empresaSelecionada, empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useEmpresa();

  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  const { data: campanhas } = useQuery({
    queryKey: ["campanhas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha").select("id_campanha").eq("ativa", true);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const empresaIdQuery = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: metricasDiarias } = useQuery({
    queryKey: ["metricas-dashboard-diarias", inicioMes.toISOString(), fimMes.toISOString(), empresaIdQuery],
    queryFn: async () => {
      if (!empresaIdQuery) return null;
      const { data, error } = await supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("id_empresa", empresaIdQuery)
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!empresaIdQuery,
    refetchInterval: 5 * 60 * 1000,
  });

  // Buscar métricas de campanhas para o chart
  const { data: metricasCampanhas } = useQuery({
    queryKey: ["metricas-campanhas-chart", inicioMes.toISOString(), fimMes.toISOString(), empresaIdQuery],
    queryFn: async () => {
      let query = supabase
        .from("campanha_metricas_dia")
        .select("data, impressoes, cliques, leads")
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"))
        .order("data");

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by day
      const byDay: Record<string, { impressoes: number; cliques: number; leads: number }> = {};
      (data || []).forEach(d => {
        if (!byDay[d.data]) byDay[d.data] = { impressoes: 0, cliques: 0, leads: 0 };
        byDay[d.data].impressoes += d.impressoes || 0;
        byDay[d.data].cliques += d.cliques || 0;
        byDay[d.data].leads += d.leads || 0;
      });

      return Object.entries(byDay).map(([date, metrics]) => ({
        label: format(new Date(date + "T12:00:00"), "dd/MM"),
        ...metrics,
      }));
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (loadingEmpresas) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) return <SemAcessoEmpresas />;

  const totaisMetricas = metricasDiarias?.reduce(
    (acc, m) => ({
      verba: acc.verba + Number(m.verba_investida || 0),
      leads: acc.leads + (m.leads_total || 0),
      vendas: acc.vendas + (m.vendas || 0),
    }),
    { verba: 0, leads: 0, vendas: 0 }
  ) || { verba: 0, leads: 0, vendas: 0 };

  const totalCampanhas = campanhas?.length || 0;
  const totalLeads = totaisMetricas.leads;
  const totalVendas = totaisMetricas.vendas;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;
  const cplMedio = totaisMetricas.leads > 0 ? totaisMetricas.verba / totaisMetricas.leads : 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  return (
    <>
      <AlertaIntegracao />

      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-1 text-foreground">Bem-vindo ao SGT!</h2>
        <p className="text-sm text-muted-foreground">Sistema de Governança de Tráfego Pago • {labelPeriodo}</p>
      </div>

      {/* KPI Cards - Bento Grid Top */}
      <div className="bento-grid mb-6">
        <LiquidKPICard
          label="Campanhas"
          value={totalCampanhas.toString()}
          icon={BarChart3}
          glow="cyan"
          delay={0}
        />
        <LiquidKPICard
          label="Leads"
          value={totalLeads.toString()}
          icon={Users}
          glow="cyan"
          delay={100}
        />
        <LiquidKPICard
          label="CPL Médio"
          value={cplMedio > 0 ? formatCurrency(cplMedio) : "R$ 0"}
          icon={DollarSign}
          glow="amber"
          delay={200}
        />
        <LiquidKPICard
          label="Conversão"
          value={`${taxaConversao.toFixed(1)}%`}
          icon={Target}
          glow="mint"
          delay={300}
          progressRing={{ value: taxaConversao, max: 100 }}
        />
      </div>

      {/* Main Content Bento Grid */}
      <div className="bento-grid mb-6">
        {/* Traffic Flow Chart - 2x2 */}
        <div className="bento-2x2">
          <TrafficFlowChart data={metricasCampanhas || []} />
        </div>

        {/* Lead Quality Bubbles */}
        <LeadQualityBubbles />

        {/* Liquid Funnel */}
        <LiquidFunnel />
      </div>

      {/* Existing widgets - now with glass styling */}
      {empresaIdQuery && (
        <div className="space-y-5">
          <KPIsHistoricos empresaId={empresaIdQuery} />
          <PacingOrcamento empresaId={empresaIdQuery} />
        </div>
      )}

      {empresasPermitidas.length > 1 && (
        <div className="mt-5">
          <DistribuicaoEmpresa />
        </div>
      )}

      {empresaIdQuery && (
        <div className="space-y-5 mt-5">
          <CoorteQualidade empresaId={empresaIdQuery} />
          <div className="bento-grid">
            <div className="bento-2x1"><TrackingScore empresaId={empresaIdQuery} /></div>
            <div className="bento-2x1"><StapeHealthWidget empresaId={empresaIdQuery} /></div>
          </div>
          <ServerSideComparison empresaId={empresaIdQuery} />
          <AlertasAnomalias empresaId={empresaIdQuery} />
          <ROIProfitability empresaId={empresaIdQuery} />
          <TempoCiclo empresaId={empresaIdQuery} />
          <CriativosFadiga empresaId={empresaIdQuery} />
          <MetricasMultiRede empresaId={empresaIdQuery} dataReferencia={dataReferencia} />
          <InteligenciaIA empresaId={empresaIdQuery} />
        </div>
      )}

      <div className="mt-5">
        <ValidacaoUTM />
      </div>
    </>
  );
};

export default Dashboard;
