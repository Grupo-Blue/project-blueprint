import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, TrendingUp, Target, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

const Dashboard = () => {
  const { getDataReferencia, tipoFiltro, labelPeriodo } = usePeriodo();
  const { empresaSelecionada, empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  
  // Usar data do filtro selecionado
  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  // Buscar campanhas ativas
  const { data: campanhas } = useQuery({
    queryKey: ["campanhas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha")
        .select("id_campanha")
        .eq("ativa", true);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refresh a cada 5 minutos
  });

  // ID da empresa para queries (null se "todas")
  const empresaIdQuery = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  // Buscar métricas diárias do período
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
    refetchInterval: 5 * 60 * 1000, // Auto-refresh a cada 5 minutos
  });

  // Estatísticas calculadas das métricas diárias
  const totaisMetricas = metricasDiarias?.reduce(
    (acc, m) => ({
      verba: acc.verba + Number(m.verba_investida || 0),
      leads: acc.leads + (m.leads_total || 0),
      vendas: acc.vendas + (m.vendas || 0),
    }),
    { verba: 0, leads: 0, vendas: 0 }
  ) || { verba: 0, leads: 0, vendas: 0 };

  // Loading state
  if (loadingEmpresas) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Sem acesso
  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  // Calcular estatísticas a partir das métricas diárias agregadas
  const totalCampanhas = campanhas?.length || 0;
  const totalLeads = totaisMetricas.leads;
  const totalVendas = totaisMetricas.vendas;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;
  const cplMedio = totaisMetricas.leads > 0 ? totaisMetricas.verba / totaisMetricas.leads : 0;

  return (
    <>
      <AlertaIntegracao />
      
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Bem-vindo ao SGT!</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Sistema de Governança de Tráfego Pago
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Campanhas</CardTitle>
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{totalCampanhas}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {totalCampanhas === 0 ? "Nenhuma" : "Ativas"}
            </p>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Leads</CardTitle>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{totalLeads}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {labelPeriodo}
            </p>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">CPL Médio</CardTitle>
            <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {cplMedio > 0 
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  }).format(cplMedio)
                : "R$ 0"}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {labelPeriodo}
            </p>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Conversão</CardTitle>
            <Target className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold">{taxaConversao.toFixed(1)}%</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {totalVendas}/{totalLeads}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NOVA SEÇÃO: KPIs Históricos */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <KPIsHistoricos empresaId={empresaIdQuery} />
        </div>
      )}

      {/* FASE 3: Pacing de Orçamento */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <PacingOrcamento empresaId={empresaIdQuery} />
        </div>
      )}

      {/* NOVA SEÇÃO: Distribuição por Empresa (visível quando há múltiplas empresas) */}
      {empresasPermitidas.length > 1 && (
        <div className="mb-6 md:mb-8">
          <DistribuicaoEmpresa />
        </div>
      )}

      {/* NOVA SEÇÃO: Coorte de Qualidade */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <CoorteQualidade empresaId={empresaIdQuery} />
        </div>
      )}

      {/* NOVA SEÇÃO: Tracking Score */}
      <div className="mb-6 md:mb-8">
        <TrackingScore empresaId={empresaIdQuery || undefined} />
      </div>

      {/* Stape Health - Monitoramento Server-Side */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <StapeHealthWidget empresaId={empresaIdQuery} />
        </div>
      )}

      {/* Comparativo Server-Side vs Client-Side */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <ServerSideComparison empresaId={empresaIdQuery} />
        </div>
      )}

      {/* FASE 2: Alertas de Anomalias */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <AlertasAnomalias empresaId={empresaIdQuery} />
        </div>
      )}

      {/* FASE 2: ROI e Lucratividade */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <ROIProfitability empresaId={empresaIdQuery} />
        </div>
      )}

      {/* FASE 3: Tempo de Ciclo de Vendas */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <TempoCiclo empresaId={empresaIdQuery} />
        </div>
      )}

      {/* FASE 2: Fadiga de Criativos */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <CriativosFadiga empresaId={empresaIdQuery} />
        </div>
      )}

      {/* Métricas Multi-Rede (Redes Sociais) */}
      {empresaIdQuery && (
        <div className="mb-6 md:mb-8">
          <MetricasMultiRede empresaId={empresaIdQuery} dataReferencia={dataReferencia} />
        </div>
      )}

      {/* IA Intelligence */}
      <div className="mb-6 md:mb-8">
        {empresaIdQuery && <InteligenciaIA empresaId={empresaIdQuery} />}
      </div>

      {/* ValidacaoUTM detalhado */}
      <ValidacaoUTM />
    </>
  );
};
export default Dashboard;
