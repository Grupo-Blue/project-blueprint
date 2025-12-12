import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
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
  ShieldCheck,
  XCircle,
  Calendar
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { startOfMonth, endOfMonth } from "date-fns";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { MetricasSociaisExecutivo } from "@/components/dashboard/MetricasSociaisExecutivo";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para modal de aprovação
  const [selectedAcao, setSelectedAcao] = useState<any>(null);
  const [comentario, setComentario] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"aprovar" | "reprovar">("aprovar");
  const [processingApproval, setProcessingApproval] = useState(false);

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

  const { data: acoesAprovacao, refetch: refetchAcoes } = useQuery({
    queryKey: ["acoes-pendentes-direcao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("acao")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .eq("categoria", "C")
        .eq("status", "PENDENTE");

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query.order("data_criacao", { ascending: false });
      if (error) throw error;

      // Buscar profiles para cada ação
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.id_usuario))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(acao => ({
          ...acao,
          usuario: profilesMap.get(acao.id_usuario) || { nome: "Usuário não encontrado" }
        }));
      }
      return data || [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Funções de aprovação
  const handleOpenDialog = (acao: any, type: "aprovar" | "reprovar") => {
    setSelectedAcao(acao);
    setActionType(type);
    setComentario("");
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedAcao) return;

    setProcessingApproval(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const novoStatus = actionType === "aprovar" ? "APROVADA" : "REPROVADA";
      
      const { error: updateError } = await supabase
        .from("acao")
        .update({
          status: novoStatus,
          motivo_reprovacao: actionType === "reprovar" ? comentario : null,
        })
        .eq("id_acao", selectedAcao.id_acao);

      if (updateError) throw updateError;

      const { error: approvalError } = await supabase
        .from("acao_aprovacao")
        .insert({
          id_acao: selectedAcao.id_acao,
          id_usuario_aprovador: user.id,
          status: actionType === "aprovar" ? "APROVADA" : "REPROVADA",
          comentario: comentario || null,
        });

      if (approvalError) throw approvalError;

      toast({
        title: actionType === "aprovar" ? "Ação aprovada!" : "Ação reprovada",
        description: `A ação foi ${actionType === "aprovar" ? "aprovada" : "reprovada"} com sucesso`,
      });

      setDialogOpen(false);
      setSelectedAcao(null);
      setComentario("");
      refetchAcoes();
    } catch (error: any) {
      toast({
        title: "Erro ao processar ação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingApproval(false);
    }
  };

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
    <div className="min-h-screen bg-background p-3 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">Dashboard Direção</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
              Visão executiva - {labelPeriodo}
            </p>
          </div>
        </div>

        {/* Alertas Críticos */}
        {alertas.length > 0 && (
          <Card className="border-destructive">
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="flex items-center gap-2 text-destructive text-sm md:text-base">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                Alertas ({alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0 space-y-2">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id_empresa}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 md:p-3 bg-destructive/10 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">{alerta.nome}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {alerta.cpl && alerta.cpl > alerta.cpl_maximo &&
                        `CPL: R$ ${alerta.cpl.toFixed(0)} (max: R$ ${alerta.cpl_maximo.toFixed(0)}) `}
                      {alerta.cac && alerta.cac > alerta.cac_maximo &&
                        `CAC: R$ ${alerta.cac.toFixed(0)} (max: R$ ${alerta.cac_maximo.toFixed(0)})`}
                    </p>
                  </div>
                  <Badge variant="destructive" className="self-start sm:self-auto text-[10px] md:text-xs">Acima</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Verba</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-base md:text-2xl font-bold">
                R$ {(totais.verba / 1000).toFixed(1)}k
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
                {empresaSelecionada === "todas" 
                  ? `${empresas?.length || 0} empresas`
                  : empresas?.find(e => e.id_empresa === empresaSelecionada)?.nome}
              </p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Leads</CardTitle>
              <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-base md:text-2xl font-bold">
                <span className="text-primary">{totais.leadsPagos}</span>
                <span className="text-muted-foreground text-sm md:text-lg">/{totais.leads}</span>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                CPL: R$ {cplMedio.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Vendas</CardTitle>
              <Target className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-base md:text-2xl font-bold">{totais.vendas}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                CAC: R$ {cacMedio.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                {empresaSelecionada === "todas" ? "Empresas" : "Empresa"}
              </CardTitle>
              <Building2 className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="text-base md:text-2xl font-bold">
                {empresaSelecionada === "todas" ? empresas?.length || 0 : 1}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                {alertas.length} alertas
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
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
              Performance por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="space-y-2 md:space-y-4">
              {metricas?.map((metrica) => (
                <div
                  key={metrica.id_empresa}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 p-2 md:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-sm md:text-base truncate">{metrica.nome}</p>
                    <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                      <span>Verba: R$ {(metrica.verba_investida / 1000).toFixed(1)}k</span>
                      <span>Leads: <span className="text-primary font-medium">{metrica.leads_pagos}</span>/{metrica.leads_total}</span>
                      <span>Vendas: {metrica.vendas}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs md:text-sm font-medium">
                        CPL: R$ {metrica.cpl?.toFixed(0) || "N/A"}
                      </p>
                      {metrica.cpl && metrica.cpl > metrica.cpl_maximo ? (
                        <Badge variant="destructive" className="text-[10px] md:text-xs">Acima</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] md:text-xs">OK</Badge>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs md:text-sm font-medium">
                        CAC: R$ {metrica.cac?.toFixed(0) || "N/A"}
                      </p>
                      {metrica.cac && metrica.cac > metrica.cac_maximo ? (
                        <Badge variant="destructive" className="text-[10px] md:text-xs">Acima</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] md:text-xs">OK</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Aprovações Categoria C - Seção Completa */}
        <Card className={acoesAprovacao?.length ? "border-l-4 border-l-yellow-500" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Aprovações Categoria C
              {acoesAprovacao?.length ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 ml-2">
                  {acoesAprovacao.length} pendente{acoesAprovacao.length > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {acoesAprovacao?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium">Nenhuma ação pendente</p>
                <p className="text-sm text-muted-foreground">
                  Todas as ações Categoria C foram processadas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {acoesAprovacao?.map((acao: any) => (
                  <div key={acao.id_acao} className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{acao.tipo_acao}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {acao.empresa?.nome || "N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(acao.data_criacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                        Pendente
                      </Badge>
                    </div>
                    
                    <div className="text-sm mb-2">
                      <span className="text-muted-foreground">Solicitado por: </span>
                      <span>{acao.usuario?.nome || "N/A"}</span>
                    </div>
                    
                    <p className="text-sm mb-3 line-clamp-2">{acao.descricao}</p>
                    
                    {acao.impacto_esperado && (
                      <p className="text-xs text-muted-foreground mb-3">
                        <strong>Impacto:</strong> {acao.impacto_esperado}
                      </p>
                    )}
                    
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        onClick={() => handleOpenDialog(acao, "aprovar")}
                        size="sm"
                        className="flex-1"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => handleOpenDialog(acao, "reprovar")}
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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

      {/* Dialog de Aprovação/Reprovação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "aprovar" ? "Aprovar Ação" : "Reprovar Ação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {actionType === "aprovar"
                ? "Você está aprovando a execução desta ação de tráfego."
                : "Você está reprovando esta ação. Por favor, informe o motivo."}
            </p>

            <div className="space-y-2">
              <Label htmlFor="comentario">
                {actionType === "aprovar" ? "Comentário (opcional)" : "Motivo da Reprovação *"}
              </Label>
              <Textarea
                id="comentario"
                placeholder={
                  actionType === "aprovar"
                    ? "Adicione observações se necessário..."
                    : "Explique o motivo da reprovação..."
                }
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={4}
                required={actionType === "reprovar"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={processingApproval || (actionType === "reprovar" && !comentario.trim())}
              variant={actionType === "aprovar" ? "default" : "destructive"}
            >
              {processingApproval ? "Processando..." : actionType === "aprovar" ? "Confirmar Aprovação" : "Confirmar Reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
