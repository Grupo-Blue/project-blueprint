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

const Dashboard = () => {
  const { semanaSelecionada, getDataReferencia, tipoFiltro } = usePeriodo();
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

  // Buscar leads do período selecionado
  const { data: leadsDoMes } = useQuery({
    queryKey: ["leads-periodo", inicioMes.toISOString(), fimMes.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select("id_lead, venda_realizada, valor_venda")
        .gte("data_criacao", inicioMes.toISOString())
        .lte("data_criacao", fimMes.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Determinar label do período
  const getLabelPeriodo = () => {
    switch (tipoFiltro) {
      case "mes_atual":
        return "do Mês Atual";
      case "mes_anterior":
        return "do Mês Anterior";
      case "data_especifica":
        return `de ${format(dataReferencia, "MMMM/yyyy", { locale: ptBR })}`;
      case "semana_especifica":
        return "da Semana";
      default:
        return "do Período";
    }
  };

  const labelPeriodo = getLabelPeriodo();

  const { data: semanaInfo } = useQuery({
    queryKey: ["semana-info", semanaSelecionada],
    queryFn: async () => {
      if (!semanaSelecionada) return null;
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .eq("id_semana", semanaSelecionada)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!semanaSelecionada,
  });

  const { data: metricasSemanais } = useQuery({
    queryKey: ["metricas-dashboard", tipoFiltro, semanaSelecionada, inicioMes.toISOString(), fimMes.toISOString(), empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada) return null;
      
      // Se for filtro de semana específica, busca só aquela semana
      if (tipoFiltro === "semana_especifica" && semanaSelecionada) {
        const { data, error } = await supabase
          .from("empresa_semana_metricas")
          .select("*, semana(*)")
          .eq("id_semana", semanaSelecionada)
          .eq("id_empresa", empresaSelecionada);
        if (error) throw error;
        return data;
      }
      
      // Para outros filtros, busca todas as semanas do período
      const { data: semanas, error: semanasError } = await supabase
        .from("semana")
        .select("id_semana")
        .gte("data_inicio", inicioMes.toISOString())
        .lte("data_fim", fimMes.toISOString());
      
      if (semanasError) throw semanasError;
      if (!semanas || semanas.length === 0) return null;
      
      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select("*, semana(*)")
        .in("id_semana", semanas.map(s => s.id_semana))
        .eq("id_empresa", empresaSelecionada);
      
      if (error) throw error;
      return data;
    },
    enabled: !!empresaSelecionada,
  });

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

  // Calcular estatísticas
  const totalCampanhas = campanhas?.length || 0;
  const totalLeads = leadsDoMes?.length || 0;
  const totalVendas = leadsDoMes?.filter((l) => l.venda_realizada).length || 0;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;

  const totaisMetricas = metricasSemanais?.reduce(
    (acc, m) => ({
      verba: acc.verba + m.verba_investida,
      leads: acc.leads + m.leads_total,
    }),
    { verba: 0, leads: 0 }
  ) || { verba: 0, leads: 0 };

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
              {metricasSemanais && metricasSemanais.length > 0 
                ? (tipoFiltro === "semana_especifica" 
                    ? `Semana ${semanaInfo?.numero_semana}/${semanaInfo?.ano}`
                    : labelPeriodo)
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

      <div className="mb-6 md:mb-8">
        {empresaSelecionada && <InteligenciaIA empresaId={empresaSelecionada} />}
      </div>

      <ValidacaoUTM />
    </>
  );
};
export default Dashboard;
