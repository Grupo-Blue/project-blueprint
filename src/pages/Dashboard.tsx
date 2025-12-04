import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, TrendingUp, Target, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertaIntegracao } from "@/components/AlertaIntegracao";
import { ValidacaoUTM } from "@/components/ValidacaoUTM";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { InteligenciaIA } from "@/components/InteligenciaIA";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
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

const Dashboard = () => {
  const { getDataReferencia, tipoFiltro } = usePeriodo();
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useUserEmpresas();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");
  
  // Usar data do filtro selecionado
  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  // Auto-selecionar empresa quando carregar
  useEffect(() => {
    if (empresasPermitidas.length > 0 && !empresaSelecionada) {
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas, empresaSelecionada]);

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
  });

  // Buscar métricas diárias do período
  const { data: metricasDiarias } = useQuery({
    queryKey: ["metricas-dashboard-diarias", inicioMes.toISOString(), fimMes.toISOString(), empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada) return null;
      
      const { data, error } = await supabase
        .from("empresa_metricas_dia")
        .select("*")
        .eq("id_empresa", empresaSelecionada)
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data;
    },
    enabled: !!empresaSelecionada,
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

  // Determinar label do período
  const getLabelPeriodo = () => {
    switch (tipoFiltro) {
      case "mes_atual":
        return "do Mês Atual";
      case "mes_anterior":
        return "do Mês Anterior";
      case "data_especifica":
        return `de ${format(dataReferencia, "MMMM/yyyy", { locale: ptBR })}`;
      default:
        return "do Período";
    }
  };

  const labelPeriodo = getLabelPeriodo();

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
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresasPermitidas.map((empresa) => (
                  <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FiltroPeriodo />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampanhas}</div>
            <p className="text-xs text-muted-foreground">
              {totalCampanhas === 0 ? "Nenhuma campanha cadastrada" : "Em execução"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads {labelPeriodo}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads === 0 ? "Nenhum lead neste período" : `${format(inicioMes, "dd/MMM", { locale: ptBR })} - ${format(fimMes, "dd/MMM", { locale: ptBR })}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cplMedio > 0 
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(cplMedio)
                : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricasDiarias && metricasDiarias.length > 0 
                ? labelPeriodo
                : "Sem métricas no período"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão {labelPeriodo}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaConversao.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {totalVendas} vendas de {totalLeads} leads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NOVA SEÇÃO: KPIs Históricos */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <KPIsHistoricos empresaId={empresaSelecionada} />
        </div>
      )}

      {/* FASE 3: Pacing de Orçamento */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <PacingOrcamento empresaId={empresaSelecionada} />
        </div>
      )}

      {/* NOVA SEÇÃO: Distribuição por Empresa (visível quando há múltiplas empresas) */}
      {empresasPermitidas.length > 1 && (
        <div className="mb-6 md:mb-8">
          <DistribuicaoEmpresa />
        </div>
      )}

      {/* NOVA SEÇÃO: Coorte de Qualidade */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <CoorteQualidade empresaId={empresaSelecionada} />
        </div>
      )}

      {/* NOVA SEÇÃO: Tracking Score */}
      <div className="mb-6 md:mb-8">
        <TrackingScore empresaId={empresaSelecionada} />
      </div>

      {/* FASE 2: Alertas de Anomalias */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <AlertasAnomalias empresaId={empresaSelecionada} />
        </div>
      )}

      {/* FASE 2: ROI e Lucratividade */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <ROIProfitability empresaId={empresaSelecionada} />
        </div>
      )}

      {/* FASE 3: Tempo de Ciclo de Vendas */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <TempoCiclo empresaId={empresaSelecionada} />
        </div>
      )}

      {/* FASE 2: Fadiga de Criativos */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <CriativosFadiga empresaId={empresaSelecionada} />
        </div>
      )}

      {/* Métricas Multi-Rede (Redes Sociais) */}
      {empresaSelecionada && (
        <div className="mb-6 md:mb-8">
          <MetricasMultiRede empresaId={empresaSelecionada} dataReferencia={dataReferencia} />
        </div>
      )}

      {/* IA Intelligence */}
      <div className="mb-6 md:mb-8">
        {empresaSelecionada && <InteligenciaIA empresaId={empresaSelecionada} />}
      </div>

      {/* ValidacaoUTM detalhado */}
      <ValidacaoUTM />
    </>
  );
};
export default Dashboard;
