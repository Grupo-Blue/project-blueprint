import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
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
  Building2
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { startOfMonth, endOfMonth } from "date-fns";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
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
  const { semanaSelecionada, getDataReferencia, tipoFiltro, dataEspecifica } = usePeriodo();
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useUserEmpresas();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");

  // Auto-selecionar empresa quando carregar (se tiver apenas 1)
  useEffect(() => {
    if (empresasPermitidas.length === 1) {
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas]);

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
  }, [tipoFiltro, dataEspecifica, semanaSelecionada]);

  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-info-direcao", semanaSelecionada],
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
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
    queryKey: ["metricas-direcao", tipoFiltro, semanaSelecionada, dataInicioStr, dataFimStr, empresaSelecionada],
    queryFn: async () => {
      // Determinar datas do período
      let dataInicioQuery = dataInicioStr;
      let dataFimQuery = dataFimStr;

      if (tipoFiltro === "semana_especifica" && semanaSelecionada) {
        const { data: semana } = await supabase
          .from("semana")
          .select("data_inicio, data_fim")
          .eq("id_semana", semanaSelecionada)
          .single();
        
        if (semana) {
          dataInicioQuery = semana.data_inicio;
          dataFimQuery = semana.data_fim;
        }
      }

      console.log("[DashboardDirecao] Período:", dataInicioQuery, "até", dataFimQuery);

      // TODAS as queries em paralelo - máxima eficiência
      const [empresasResult, leadsResult, leadsPagosResult, vendasResult, contasResult, campanhasResult, metricasResult] = await Promise.all([
        supabase.from("empresa").select("id_empresa, nome, cpl_maximo, cac_maximo"),
        // Leads TOTAIS (para contagem geral)
        supabase.from("lead")
          .select("id_lead, id_empresa")
          .gte("data_criacao", dataInicioQuery)
          .lte("data_criacao", dataFimQuery + "T23:59:59"),
        // Leads PAGOS (para CPL correto)
        supabase.from("lead")
          .select("id_lead, id_empresa")
          .eq("lead_pago", true)
          .gte("data_criacao", dataInicioQuery)
          .lte("data_criacao", dataFimQuery + "T23:59:59"),
        supabase.from("lead")
          .select("id_lead, id_empresa, valor_venda")
          .eq("venda_realizada", true)
          .gte("data_venda", dataInicioQuery)
          .lte("data_venda", dataFimQuery + "T23:59:59"),
        supabase.from("conta_anuncio").select("id_conta, id_empresa"),
        supabase.from("campanha").select("id_campanha, id_conta"),
        supabase.from("campanha_metricas_dia")
          .select("id_campanha, verba_investida, data")
          .gte("data", dataInicioQuery)
          .lte("data", dataFimQuery)
      ]);

      if (empresasResult.error) throw empresasResult.error;
      
      const todasEmpresas = empresasResult.data || [];
      const todosLeads = leadsResult.data || [];
      const leadsPagos = leadsPagosResult.data || [];
      const todasVendas = vendasResult.data || [];
      const todasContas = contasResult.data || [];
      const todasCampanhas = campanhasResult.data || [];
      const metricasVerba = metricasResult.data || [];

      console.log("[DashboardDirecao] Leads totais:", todosLeads.length, "| Leads pagos:", leadsPagos.length);
      console.log("[DashboardDirecao] Total verba bruta:", metricasVerba.reduce((sum, m) => sum + Number(m.verba_investida), 0));

      // Mapa campanha -> empresa (via conta)
      const contaToEmpresa = new Map(todasContas.map(c => [c.id_conta, c.id_empresa]));
      const campanhaToEmpresa = new Map<string, string>();
      todasCampanhas.forEach(camp => {
        const empresaId = contaToEmpresa.get(camp.id_conta);
        if (empresaId) campanhaToEmpresa.set(camp.id_campanha, empresaId);
      });

      // Agregar verba por empresa - com log de debug
      const verbaByEmpresa = new Map<string, number>();
      let verbaOrfao = 0;
      metricasVerba.forEach(m => {
        const empresaId = campanhaToEmpresa.get(m.id_campanha);
        if (empresaId) {
          verbaByEmpresa.set(empresaId, (verbaByEmpresa.get(empresaId) || 0) + Number(m.verba_investida));
        } else {
          verbaOrfao += Number(m.verba_investida);
        }
      });
      
      if (verbaOrfao > 0) {
        console.warn("[DashboardDirecao] Verba sem empresa mapeada:", verbaOrfao);
      }

      // Agregar leads TOTAIS por empresa
      const leadsByEmpresa = new Map<string, number>();
      todosLeads.forEach(l => leadsByEmpresa.set(l.id_empresa, (leadsByEmpresa.get(l.id_empresa) || 0) + 1));
      
      // Agregar leads PAGOS por empresa (para CPL)
      const leadsPagosByEmpresa = new Map<string, number>();
      leadsPagos.forEach(l => leadsPagosByEmpresa.set(l.id_empresa, (leadsPagosByEmpresa.get(l.id_empresa) || 0) + 1));
      
      const vendasByEmpresa = new Map<string, number>();
      todasVendas.forEach(v => vendasByEmpresa.set(v.id_empresa, (vendasByEmpresa.get(v.id_empresa) || 0) + 1));

      // Filtrar empresas
      const empresasFiltradas = empresaSelecionada && empresaSelecionada !== "todas"
        ? todasEmpresas.filter(e => e.id_empresa === empresaSelecionada)
        : todasEmpresas;

      const resultado = empresasFiltradas.map(empresa => ({
        id_empresa: empresa.id_empresa,
        nome: empresa.nome,
        verba_investida: verbaByEmpresa.get(empresa.id_empresa) || 0,
        leads_total: leadsByEmpresa.get(empresa.id_empresa) || 0,
        leads_pagos: leadsPagosByEmpresa.get(empresa.id_empresa) || 0,
        // CPL usa apenas leads PAGOS
        cpl: (leadsPagosByEmpresa.get(empresa.id_empresa) || 0) > 0 
          ? (verbaByEmpresa.get(empresa.id_empresa) || 0) / (leadsPagosByEmpresa.get(empresa.id_empresa) || 1) 
          : null,
        cac: (vendasByEmpresa.get(empresa.id_empresa) || 0) > 0 
          ? (verbaByEmpresa.get(empresa.id_empresa) || 0) / (vendasByEmpresa.get(empresa.id_empresa) || 1) 
          : null,
        vendas: vendasByEmpresa.get(empresa.id_empresa) || 0,
        cpl_maximo: empresa.cpl_maximo,
        cac_maximo: empresa.cac_maximo,
      }));

      console.log("[DashboardDirecao] Resultado final por empresa:", resultado.map(r => ({ nome: r.nome, verba: r.verba_investida })));
      
      return resultado;
    },
    staleTime: 60 * 1000, // Cache por 60 segundos
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

  // Determinar label do período
  const getLabelPeriodo = () => {
    switch (tipoFiltro) {
      case "mes_atual":
        return "Mês Atual";
      case "mes_anterior":
        return "Mês Anterior";
      case "data_especifica":
        return format(dataReferencia, "MMMM/yyyy", { locale: ptBR });
      case "semana_especifica":
        return semanaAtual ? `Semana ${semanaAtual.numero_semana}/${semanaAtual.ano}` : "Semana";
      default:
        return "Período";
    }
  };

  const labelPeriodo = getLabelPeriodo();

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
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresasPermitidas.length > 1 && (
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                )}
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
                  acoesAprovacao?.map((acao: any) => (
                    <div
                      key={acao.id_acao}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{acao.tipo_acao}</p>
                          <p className="text-xs text-muted-foreground">{acao.empresa.nome}</p>
                          <p className="text-xs">
                            {format(new Date(acao.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge>{acao.categoria}</Badge>
                      </div>
                    </div>
                  ))
                )}
                <Link to="/aprovacoes">
                  <Button variant="outline" className="w-full">
                    Ver Todas as Aprovações
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Últimos Aprendizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
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
                  ultimosAprendizados?.map((aprendizado: any) => (
                    <div
                      key={aprendizado.id_aprendizado}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{aprendizado.empresa.nome}</p>
                          <Badge variant="outline" className="text-xs">
                            {aprendizado.tipo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {aprendizado.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Semana {aprendizado.semana.numero_semana}/{aprendizado.semana.ano}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <Link to="/aprendizados">
                  <Button variant="outline" className="w-full">
                    Ver Todos os Aprendizados
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
