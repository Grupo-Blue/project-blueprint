import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import {
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Building2,
  ClipboardList,
  Play,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { startOfMonth, endOfMonth } from "date-fns";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { MetricasSociaisExecutivo } from "@/components/dashboard/MetricasSociaisExecutivo";

interface EmpresaMetrica {
  id_empresa: string;
  nome: string;
  verba_investida: number;
  leads_total: number;
  leads_pagos: number;
  cpl: number | null;
  cac: number | null;
  vendas: number;
  cpl_maximo: number;
  cac_maximo: number;
}

export default function DashboardDirecao() {
  const { getDataReferencia, tipoFiltro, dataEspecifica, labelPeriodo } = usePeriodo();
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();

  // ESTABILIZAR datas com useMemo para evitar recálculos a cada render
  const { dataInicioStr, dataFimStr, dataReferencia } = useMemo(() => {
    const dataRef = getDataReferencia();
    const inicioMes = startOfMonth(dataRef);
    const fimMes = endOfMonth(dataRef);
    const hoje = new Date();
    const dataFinal = fimMes > hoje ? hoje : fimMes;
    
    return {
      dataInicioStr: format(inicioMes, "yyyy-MM-dd"),
      dataFimStr: format(dataFinal, "yyyy-MM-dd"),
      dataReferencia: dataRef
    };
  }, [tipoFiltro, dataEspecifica]);

  const { data: empresas } = useQuery({
    queryKey: ["empresas-direcao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: metricas, isLoading } = useQuery({
    queryKey: ["metricas-direcao", tipoFiltro, dataInicioStr, dataFimStr, empresaSelecionada],
    queryFn: async () => {
      console.log("[DashboardDirecao] Período:", dataInicioStr, "até", dataFimStr);

      // Buscar empresas e métricas diárias em paralelo
      const [empresasResult, metricasDiariasResult] = await Promise.all([
        supabase.from("empresa").select("id_empresa, nome, cpl_maximo, cac_maximo"),
        supabase.from("empresa_metricas_dia")
          .select("*")
          .gte("data", dataInicioStr)
          .lte("data", dataFimStr)
      ]);

      if (empresasResult.error) throw empresasResult.error;
      
      const todasEmpresas = empresasResult.data || [];
      const metricasDiarias = metricasDiariasResult.data || [];

      // Filtrar empresas
      const empresasFiltradas = empresaSelecionada && empresaSelecionada !== "todas"
        ? todasEmpresas.filter(e => e.id_empresa === empresaSelecionada)
        : todasEmpresas;

      // Agregar métricas diárias por empresa
      const resultado = empresasFiltradas.map(empresa => {
        const metricasEmpresa = metricasDiarias.filter(m => m.id_empresa === empresa.id_empresa);
        
        const totais = metricasEmpresa.reduce((acc, m) => ({
          verba_investida: acc.verba_investida + Number(m.verba_investida || 0),
          leads_total: acc.leads_total + (m.leads_total || 0),
          leads_pagos: acc.leads_pagos + (m.leads_pagos || 0),
          vendas: acc.vendas + (m.vendas || 0),
        }), { verba_investida: 0, leads_total: 0, leads_pagos: 0, vendas: 0 });

        return {
          id_empresa: empresa.id_empresa,
          nome: empresa.nome,
          verba_investida: totais.verba_investida,
          leads_total: totais.leads_total,
          leads_pagos: totais.leads_pagos,
          cpl: totais.leads_pagos > 0 ? totais.verba_investida / totais.leads_pagos : null,
          cac: totais.vendas > 0 ? totais.verba_investida / totais.vendas : null,
          vendas: totais.vendas,
          cpl_maximo: empresa.cpl_maximo,
          cac_maximo: empresa.cac_maximo,
        };
      });

      console.log("[DashboardDirecao] Resultado agregado:", resultado.map(r => ({ nome: r.nome, verba: r.verba_investida })));
      
      return resultado;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: acoesAprovacao } = useQuery({
    queryKey: ["acoes-pendentes-direcao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("acao")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .eq("status", "PENDENTE");

      // Filtrar por empresa se uma específica for selecionada
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query
        .order("data_criacao", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Query para demandas de campanhas
  const { data: demandasCampanha } = useQuery({
    queryKey: ["demandas-direcao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("demanda_campanha")
        .select(`
          *,
          empresa:id_empresa (nome)
        `);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: ultimosAprendizados } = useQuery({
    queryKey: ["ultimos-aprendizados-direcao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("aprendizado_semana")
        .select(`
          *,
          empresa:id_empresa (nome),
          semana:id_semana (numero_semana, ano)
        `);

      // Filtrar por empresa se uma específica for selecionada
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const totais = metricas?.reduce(
    (acc, m) => ({
      verba: acc.verba + m.verba_investida,
      leads: acc.leads + m.leads_total,
      leadsPagos: acc.leadsPagos + m.leads_pagos,
      vendas: acc.vendas + m.vendas,
    }),
    { verba: 0, leads: 0, leadsPagos: 0, vendas: 0 }
  ) || { verba: 0, leads: 0, leadsPagos: 0, vendas: 0 };

  // CPL usa apenas leads pagos
  const cplMedio = totais.leadsPagos > 0 ? totais.verba / totais.leadsPagos : 0;
  const cacMedio = totais.vendas > 0 ? totais.verba / totais.vendas : 0;

  const alertas = metricas?.filter(
    (m) => (m.cpl && m.cpl > m.cpl_maximo) || (m.cac && m.cac > m.cac_maximo)
  ) || [];

  if (isLoading || loadingEmpresas) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard Direção</h1>
            <p className="text-muted-foreground mt-2">
              Visão executiva consolidada - {labelPeriodo}
            </p>
          </div>
        </div>

        {/* Alertas Críticos */}
        {alertas.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Alertas Críticos ({alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id_empresa}
                  className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{alerta.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {alerta.cpl && alerta.cpl > alerta.cpl_maximo &&
                        `CPL: R$ ${alerta.cpl.toFixed(2)} (máximo: R$ ${alerta.cpl_maximo.toFixed(2)}) `}
                      {alerta.cac && alerta.cac > alerta.cac_maximo &&
                        `CAC: R$ ${alerta.cac.toFixed(2)} (máximo: R$ ${alerta.cac_maximo.toFixed(2)})`}
                    </p>
                  </div>
                  <Badge variant="destructive">Acima do limite</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Verba Investida</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totais.verba.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {empresaSelecionada === "todas" 
                  ? `Consolidado de ${empresas?.length || 0} empresas`
                  : empresas?.find(e => e.id_empresa === empresaSelecionada)?.nome}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-primary">{totais.leadsPagos}</span>
                <span className="text-muted-foreground text-lg"> / {totais.leads}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pagos / Total • CPL: R$ {cplMedio.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totais.vendas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CAC médio: R$ {cacMedio.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {empresaSelecionada === "todas" ? "Empresas" : "Empresa Selecionada"}
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {empresaSelecionada === "todas" ? empresas?.length || 0 : 1}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {alertas.length} com alertas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Métricas de Awareness - Redes Sociais */}
        <MetricasSociaisExecutivo 
          empresaId={empresaSelecionada !== "todas" ? empresaSelecionada : undefined}
          dataReferencia={dataReferencia}
        />

        {/* Métricas por Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metricas?.map((metrica) => (
                <div
                  key={metrica.id_empresa}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{metrica.nome}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Verba: R$ {metrica.verba_investida.toLocaleString("pt-BR")}</span>
                      <span>Leads: <span className="text-primary font-medium">{metrica.leads_pagos}</span> / {metrica.leads_total}</span>
                      <span>Vendas: {metrica.vendas}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CPL: R$ {metrica.cpl?.toFixed(2) || "N/A"}
                      </p>
                      {metrica.cpl && metrica.cpl > metrica.cpl_maximo ? (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Acima do limite
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Dentro do limite
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CAC: R$ {metrica.cac?.toFixed(2) || "N/A"}
                      </p>
                      {metrica.cac && metrica.cac > metrica.cac_maximo ? (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Acima do limite
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Dentro do limite
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ações Pendentes de Aprovação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ações Pendentes de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acoesAprovacao?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma ação pendente
                  </p>
                ) : (
                  <>
                    {acoesAprovacao?.map((acao: any) => (
                      <div
                        key={acao.id_acao}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{acao.tipo_acao}</p>
                          <p className="text-xs text-muted-foreground">
                            {acao.empresa?.nome} •{" "}
                            {format(new Date(acao.data_criacao), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <Badge variant="outline">Pendente</Badge>
                      </div>
                    ))}
                    <Link to="/aprovacoes">
                      <Button variant="outline" className="w-full mt-2">
                        Ver todas as aprovações
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Últimos Aprendizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Últimos Aprendizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ultimosAprendizados?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum aprendizado registrado
                  </p>
                ) : (
                  <>
                    {ultimosAprendizados?.map((aprendizado: any) => (
                      <div
                        key={aprendizado.id_aprendizado}
                        className="p-3 border rounded-lg"
                      >
                        <p className="text-sm line-clamp-2">{aprendizado.descricao}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {aprendizado.empresa?.nome} • Semana{" "}
                          {aprendizado.semana?.numero_semana}/{aprendizado.semana?.ano}
                        </p>
                      </div>
                    ))}
                    <Link to="/aprendizados">
                      <Button variant="outline" className="w-full mt-2">
                        Ver todos os aprendizados
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demandas de Campanhas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Demandas de Campanhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {demandasCampanha?.filter(d => d.status === 'PENDENTE').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
                <Play className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {demandasCampanha?.filter(d => d.status === 'EM_EXECUCAO').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Em Execução</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {demandasCampanha?.filter(d => d.status === 'EXECUTADA').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Executadas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {demandasCampanha?.filter(d => d.status === 'VERIFICADA').length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Verificadas</p>
                </div>
              </div>
            </div>
            <Link to="/demandas-campanhas">
              <Button variant="outline" className="w-full">
                Ver todas as demandas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
