import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Target, 
  Users, 
  MousePointer,
  DollarSign,
  Zap,
  ArrowRight,
  Eye,
  CheckCircle
} from "lucide-react";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CampanhaMetrica {
  id_campanha: string;
  nome: string;
  leads: number;
  verba_investida: number;
  cpl: number;
  reunioes: number;
  mqls: number;
  levantadas: number;
  vendas: number;
  ticket_medio: number;
  cac: number;
  qtd_criativos?: number;
}

export default function DashboardTrafego() {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<string>("verba_desc");
  const { semanaSelecionada, getDataReferencia, tipoFiltro } = usePeriodo();

  // Usar data do filtro selecionado
  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-info-trafego", semanaSelecionada],
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

  // Query para distribuição de MQLs por critério
  const { data: mqlDistribuicao } = useQuery({
    queryKey: ["mql-distribuicao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("lead")
        .select("mautic_score, mautic_page_hits, is_mql, id_empresa");

      if (empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mqls = data?.filter(l => l.is_mql) || [];
      
      return {
        total: mqls.length,
        porScore: mqls.filter(l => (l.mautic_score || 0) >= 50).length,
        porPageHits: mqls.filter(l => (l.mautic_page_hits || 0) >= 10).length,
        porAmbos: mqls.filter(l => (l.mautic_score || 0) >= 50 && (l.mautic_page_hits || 0) >= 10).length,
      };
    },
  });

  const { data: campanhasMetricas, isLoading } = useQuery({
    queryKey: ["campanhas-metricas", tipoFiltro, semanaSelecionada, inicioMes.toISOString(), fimMes.toISOString(), empresaSelecionada],
    queryFn: async () => {
      // Se for filtro de semana específica, busca só aquela semana
      if (tipoFiltro === "semana_especifica" && semanaSelecionada) {
        let query = supabase
          .from("campanha_semana_metricas")
          .select(`
            *,
            campanha:id_campanha (
              nome, 
              id_conta,
              conta_anuncio:id_conta (id_empresa)
            )
          `)
          .eq("id_semana", semanaSelecionada);

        const { data, error } = await query;
        if (error) throw error;

        let filteredData = data;
        if (empresaSelecionada !== "todas") {
          filteredData = data.filter((m: any) => 
            m.campanha?.conta_anuncio?.id_empresa === empresaSelecionada
          );
        }

        // Buscar quantidade de criativos para cada campanha
        const campanhasComCriativos = await Promise.all(
          filteredData.map(async (m: any) => {
            const { count } = await supabase
              .from("criativo")
              .select("id_criativo", { count: "exact", head: true })
              .eq("id_campanha", m.id_campanha)
              .eq("ativo", true);

            return {
              id_campanha: m.id_campanha,
              nome: m.campanha?.nome || "Campanha sem nome",
              leads: m.leads,
              verba_investida: m.verba_investida,
              cpl: m.cpl,
              reunioes: m.reunioes || 0,
              mqls: m.mqls || 0,
              levantadas: m.levantadas || 0,
              vendas: m.vendas || 0,
              ticket_medio: m.ticket_medio || 0,
              cac: m.cac || 0,
              qtd_criativos: count || 0,
            };
          })
        );

        return campanhasComCriativos as CampanhaMetrica[];
      }

      // Para outros filtros, busca todas as semanas do período
      const { data: semanas, error: semanasError } = await supabase
        .from("semana")
        .select("id_semana")
        .gte("data_inicio", inicioMes.toISOString())
        .lte("data_fim", fimMes.toISOString());
      
      if (semanasError) throw semanasError;
      if (!semanas || semanas.length === 0) return [];

      let query = supabase
        .from("campanha_semana_metricas")
        .select(`
          *,
          campanha:id_campanha (
            nome, 
            id_conta,
            conta_anuncio:id_conta (id_empresa)
          )
        `)
        .in("id_semana", semanas.map(s => s.id_semana));

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data;
      if (empresaSelecionada !== "todas") {
        filteredData = data.filter((m: any) => 
          m.campanha?.conta_anuncio?.id_empresa === empresaSelecionada
        );
      }

      // Agregar métricas por campanha
      const metricasAgregadas = filteredData.reduce((acc: any, m: any) => {
        const campanhaId = m.id_campanha;
        if (!acc[campanhaId]) {
          acc[campanhaId] = {
            id_campanha: campanhaId,
            nome: m.campanha?.nome || "Campanha sem nome",
            leads: 0,
            verba_investida: 0,
            reunioes: 0,
            mqls: 0,
            levantadas: 0,
            vendas: 0,
            ticket_medio: 0,
            cac: 0,
          };
        }
        acc[campanhaId].leads += m.leads;
        acc[campanhaId].verba_investida += m.verba_investida;
        acc[campanhaId].reunioes += m.reunioes || 0;
        acc[campanhaId].mqls += m.mqls || 0;
        acc[campanhaId].levantadas += m.levantadas || 0;
        acc[campanhaId].vendas += m.vendas || 0;
        return acc;
      }, {});

      // Buscar quantidade de criativos para cada campanha
      const campanhasAgregadas = Object.values(metricasAgregadas);
      const campanhasComCriativos = await Promise.all(
        campanhasAgregadas.map(async (m: any) => {
          const { count } = await supabase
            .from("criativo")
            .select("id_criativo", { count: "exact", head: true })
            .eq("id_campanha", m.id_campanha)
            .eq("ativo", true);

          return {
            ...m,
            cpl: m.leads > 0 ? m.verba_investida / m.leads : null,
            cac: m.vendas > 0 ? m.verba_investida / m.vendas : null,
            ticket_medio: m.vendas > 0 ? (m.verba_investida * 3) / m.vendas : 0,
            qtd_criativos: count || 0,
          };
        })
      );

      return campanhasComCriativos as CampanhaMetrica[];
    },
  });

  // Buscar totais gerais da empresa (não apenas soma das campanhas)
  const { data: totaisGerais } = useQuery({
    queryKey: [
      "totais-gerais-empresa",
      empresaSelecionada,
      tipoFiltro,
      semanaSelecionada,
      inicioMes.toISOString(),
      fimMes.toISOString(),
    ],
    queryFn: async () => {
      const baseTotais = {
        verba: 0,
        leads: 0,
        mqls: 0,
        levantadas: 0,
        reunioes: 0,
        vendas: 0,
      };

      // Filtro por empresa (ou todas)
      const filtrarPorEmpresa = (registros: any[]) => {
        if (empresaSelecionada === "todas") return registros || [];
        return (registros || []).filter((r) => r.id_empresa === empresaSelecionada);
      };

      if (tipoFiltro === "semana_especifica" && semanaSelecionada) {
        // Para semana específica, usar tabela agregada por empresa
        const { data, error } = await supabase
          .from("empresa_semana_metricas")
          .select("*")
          .eq("id_semana", semanaSelecionada);

        if (error) throw error;

        const registros = filtrarPorEmpresa(data || []);

        return registros.reduce((acc, r) => ({
          verba: acc.verba + (r.verba_investida || 0),
          leads: acc.leads + (r.leads_total || 0),
          mqls: acc.mqls + (r.mqls || 0),
          levantadas: acc.levantadas + (r.levantadas || 0),
          reunioes: acc.reunioes + (r.reunioes || 0),
          vendas: acc.vendas + (r.vendas || 0),
        }), baseTotais);
      }

      // Para outros períodos, contar diretamente da tabela lead
      let leadsQuery = supabase
        .from("lead")
        .select("*")
        .gte("data_criacao", inicioMes.toISOString())
        .lte("data_criacao", fimMes.toISOString());

      if (empresaSelecionada !== "todas") {
        leadsQuery = leadsQuery.eq("id_empresa", empresaSelecionada);
      }

      const { data: leads, error } = await leadsQuery;
      if (error) throw error;

      // Buscar verba investida das campanhas (todas ou de uma empresa)
      let contasQuery = supabase.from("conta_anuncio").select("id_conta, id_empresa");
      if (empresaSelecionada !== "todas") {
        contasQuery = contasQuery.eq("id_empresa", empresaSelecionada);
      }

      const { data: contas } = await contasQuery;
      const contaIds = contas?.map((c) => c.id_conta) || [];
      let verba = 0;

      if (contaIds.length > 0) {
        const { data: campanhas } = await supabase
          .from("campanha")
          .select("id_campanha")
          .in("id_conta", contaIds);

        const campanhaIds = campanhas?.map((c) => c.id_campanha) || [];

        if (campanhaIds.length > 0) {
          const { data: metricasDia } = await supabase
            .from("campanha_metricas_dia")
            .select("verba_investida, data")
            .in("id_campanha", campanhaIds)
            .gte("data", inicioMes.toISOString())
            .lte("data", fimMes.toISOString());

          verba = metricasDia?.reduce((sum, m) => sum + (m.verba_investida || 0), 0) || 0;
        }
      }

      return {
        verba,
        leads: leads?.length || 0,
        mqls: leads?.filter((l: any) => l.is_mql).length || 0,
        levantadas: leads?.filter((l: any) => l.levantou_mao).length || 0,
        reunioes: leads?.filter((l: any) => l.tem_reuniao || l.reuniao_realizada).length || 0,
        vendas: leads?.filter((l: any) => l.venda_realizada).length || 0,
      };
    },
    enabled: true,
  });

  const totais = totaisGerais || { verba: 0, leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 };

  const taxaMQL = totais.leads > 0 ? (totais.mqls / totais.leads) * 100 : 0;
  const taxaLevantada = totais.mqls > 0 ? (totais.levantadas / totais.mqls) * 100 : 0;
  const taxaReuniao = totais.levantadas > 0 ? (totais.reunioes / totais.levantadas) * 100 : 0;
  const taxaVenda = totais.reunioes > 0 ? (totais.vendas / totais.reunioes) * 100 : 0;

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

  // Ordenar campanhas conforme o filtro selecionado
  const campanhasOrdenadas = campanhasMetricas?.slice().sort((a, b) => {
    switch (ordenacao) {
      case "verba_desc":
        return b.verba_investida - a.verba_investida;
      case "verba_asc":
        return a.verba_investida - b.verba_investida;
      case "leads_desc":
        return b.leads - a.leads;
      case "leads_asc":
        return a.leads - b.leads;
      case "cpl_desc":
        return (b.cpl || 0) - (a.cpl || 0);
      case "cpl_asc":
        return (a.cpl || 0) - (b.cpl || 0);
      case "criativos_desc":
        return (b.qtd_criativos || 0) - (a.qtd_criativos || 0);
      case "criativos_asc":
        return (a.qtd_criativos || 0) - (b.qtd_criativos || 0);
      case "nome_asc":
        return a.nome.localeCompare(b.nome);
      case "nome_desc":
        return b.nome.localeCompare(a.nome);
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Dashboard Tráfego</h1>
              <p className="text-muted-foreground mt-2">
                Análise detalhada de campanhas e funil - {labelPeriodo}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <FiltroPeriodo />
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Empresas</SelectItem>
                  {empresas?.map((e) => (
                    <SelectItem key={e.id_empresa} value={e.id_empresa}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPIs Topo */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Verba Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                R$ {totais.verba.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totais.leads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                MQLs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totais.mqls}</div>
              {mqlDistribuicao && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground mt-1 cursor-help">
                        {mqlDistribuicao.porScore} score • {mqlDistribuicao.porPageHits} engajamento
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">Critérios de MQL:</p>
                        <p>Score ≥ 50: {mqlDistribuicao.porScore} leads</p>
                        <p>Page Hits ≥ 10: {mqlDistribuicao.porPageHits} leads</p>
                        <p>Ambos: {mqlDistribuicao.porAmbos} leads</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Levantadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totais.levantadas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Reuniões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totais.reunioes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totais.vendas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Funil de Conversão Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Lead → MQL */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">Leads → MQLs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaMQL.toFixed(1)}%</span>
                    <Badge variant="outline">{totais.mqls} / {totais.leads}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${taxaMQL}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto" />

              {/* MQL → Levantada */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium">MQLs → Levantadas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaLevantada.toFixed(1)}%</span>
                    <Badge variant="outline">{totais.levantadas} / {totais.mqls}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${taxaLevantada}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto" />

              {/* Levantada → Reunião */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="font-medium">Levantadas → Reuniões</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaReuniao.toFixed(1)}%</span>
                    <Badge variant="outline">{totais.reunioes} / {totais.levantadas}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${taxaReuniao}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto" />

              {/* Reunião → Venda */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="font-medium">Reuniões → Vendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaVenda.toFixed(1)}%</span>
                    <Badge variant="outline">{totais.vendas} / {totais.reunioes}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${taxaVenda}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance por Campanha */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Performance por Campanha</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ordenar por:</span>
                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verba_desc">Maior Verba</SelectItem>
                    <SelectItem value="verba_asc">Menor Verba</SelectItem>
                    <SelectItem value="leads_desc">Mais Leads</SelectItem>
                    <SelectItem value="leads_asc">Menos Leads</SelectItem>
                    <SelectItem value="cpl_desc">Maior CPL</SelectItem>
                    <SelectItem value="cpl_asc">Menor CPL</SelectItem>
                    <SelectItem value="criativos_desc">Mais Criativos</SelectItem>
                    <SelectItem value="criativos_asc">Menos Criativos</SelectItem>
                    <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
                    <SelectItem value="nome_desc">Nome (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campanhasOrdenadas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha encontrada
                </p>
              ) : (
                campanhasOrdenadas?.map((campanha) => (
                  <div
                    key={campanha.id_campanha}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{campanha.nome}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            CPL: R$ {campanha.cpl?.toFixed(2) || "N/A"}
                          </Badge>
                          {campanha.qtd_criativos !== undefined && (
                            <Badge variant="secondary">
                              {campanha.qtd_criativos} criativos
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Verba</p>
                          <p className="font-medium">
                            R$ {campanha.verba_investida.toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Leads</p>
                          <p className="font-medium">{campanha.leads}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">MQLs</p>
                          <p className="font-medium">{campanha.mqls}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Vendas</p>
                          <p className="font-medium">{campanha.vendas}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Reuniões: {campanha.reunioes}</span>
                        <span>Levantadas: {campanha.levantadas}</span>
                        {campanha.cac > 0 && (
                          <span>CAC: R$ {campanha.cac.toFixed(2)}</span>
                        )}
                        {campanha.ticket_medio > 0 && (
                          <span>Ticket Médio: R$ {campanha.ticket_medio.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
