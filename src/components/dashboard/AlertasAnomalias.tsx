import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Users, Target, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, subDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertasAnomaliasProps {
  empresaId?: string;
}

interface Alerta {
  id: string;
  tipo: "critico" | "alto" | "medio";
  categoria: string;
  mensagem: string;
  detalhe: string;
  tempo: string;
  icon: React.ReactNode;
}

export function AlertasAnomalias({ empresaId }: AlertasAnomaliasProps) {
  const { data: alertas, isLoading } = useQuery({
    queryKey: ["alertas-anomalias", empresaId],
    queryFn: async () => {
      const alertasDetectados: Alerta[] = [];
      const hoje = new Date();
      const data14dias = subDays(hoje, 14);
      const data7dias = subDays(hoje, 7);
      const data3dias = subDays(hoje, 3);

      // 1. Buscar métricas diárias para detectar anomalias de CPL e leads
      const { data: metricasDiarias, error: metricasError } = await supabase
        .from("campanha_metricas_dia")
        .select(`
          data,
          verba_investida,
          leads,
          campanha:id_campanha(
            nome,
            ativa,
            conta_anuncio:id_conta(
              id_empresa,
              empresa:id_empresa(nome)
            )
          )
        `)
        .gte("data", format(data14dias, "yyyy-MM-dd"));

      if (metricasError) throw metricasError;

      // Filtrar por empresa e agregar por dia/empresa
      const metricasFiltradas = metricasDiarias?.filter((m: any) => 
        !empresaId || m.campanha?.conta_anuncio?.id_empresa === empresaId
      ) || [];

      // Agregar por data e empresa
      const porDiaEmpresa = new Map<string, { verba: number; leads: number; empresa: string }>();
      metricasFiltradas.forEach((m: any) => {
        const key = `${m.data}_${m.campanha?.conta_anuncio?.id_empresa}`;
        const empresaNome = m.campanha?.conta_anuncio?.empresa?.nome || "Desconhecido";
        if (!porDiaEmpresa.has(key)) {
          porDiaEmpresa.set(key, { verba: 0, leads: 0, empresa: empresaNome });
        }
        const agg = porDiaEmpresa.get(key)!;
        agg.verba += Number(m.verba_investida) || 0;
        agg.leads += m.leads || 0;
      });

      // Calcular média de CPL dos últimos 14 dias por empresa
      const empresaStats = new Map<string, { cplDias: number[]; leadsDias: number[]; nomeEmpresa: string }>();
      porDiaEmpresa.forEach((v, k) => {
        const empresaId = k.split("_")[1];
        if (!empresaStats.has(empresaId)) {
          empresaStats.set(empresaId, { cplDias: [], leadsDias: [], nomeEmpresa: v.empresa });
        }
        const stats = empresaStats.get(empresaId)!;
        if (v.leads > 0) {
          stats.cplDias.push(v.verba / v.leads);
        }
        stats.leadsDias.push(v.leads);
      });

      // Detectar anomalias
      empresaStats.forEach((stats, empId) => {
        const cplMedia = stats.cplDias.length > 0 
          ? stats.cplDias.reduce((a, b) => a + b, 0) / stats.cplDias.length 
          : 0;
        const leadsMedia = stats.leadsDias.length > 0 
          ? stats.leadsDias.reduce((a, b) => a + b, 0) / stats.leadsDias.length 
          : 0;

        // CPL atual vs média
        if (stats.cplDias.length >= 3) {
          const cplRecente = stats.cplDias[stats.cplDias.length - 1];
          const variacao = cplMedia > 0 ? ((cplRecente - cplMedia) / cplMedia) * 100 : 0;
          
          if (variacao > 30) {
            alertasDetectados.push({
              id: `cpl_alto_${empId}`,
              tipo: "critico",
              categoria: "CPL",
              mensagem: `${stats.nomeEmpresa}: CPL subiu ${variacao.toFixed(0)}%`,
              detalhe: `CPL atual ${formatCurrency(cplRecente)} vs média ${formatCurrency(cplMedia)}`,
              tempo: "Últimos dias",
              icon: <TrendingUp className="h-4 w-4" />
            });
          }
        }

        // Leads zerados consecutivos
        const leadsRecentes = stats.leadsDias.slice(-3);
        const diasSemLeads = leadsRecentes.filter(l => l === 0).length;
        if (diasSemLeads >= 2 && leadsMedia > 0) {
          alertasDetectados.push({
            id: `leads_zero_${empId}`,
            tipo: "critico",
            categoria: "Leads",
            mensagem: `${stats.nomeEmpresa}: ${diasSemLeads} dias sem leads`,
            detalhe: `Média histórica: ${leadsMedia.toFixed(1)} leads/dia`,
            tempo: "Últimos 3 dias",
            icon: <Users className="h-4 w-4" />
          });
        }

        // Queda brusca de leads (>40%)
        if (stats.leadsDias.length >= 7) {
          const leadsUltimaSemana = stats.leadsDias.slice(-7).reduce((a, b) => a + b, 0);
          const leadsSemanaAnterior = stats.leadsDias.slice(-14, -7).reduce((a, b) => a + b, 0);
          if (leadsSemanaAnterior > 0) {
            const quedaPercent = ((leadsSemanaAnterior - leadsUltimaSemana) / leadsSemanaAnterior) * 100;
            if (quedaPercent > 40) {
              alertasDetectados.push({
                id: `leads_queda_${empId}`,
                tipo: "alto",
                categoria: "Leads",
                mensagem: `${stats.nomeEmpresa}: Leads caíram ${quedaPercent.toFixed(0)}%`,
                detalhe: `De ${leadsSemanaAnterior} para ${leadsUltimaSemana} leads/semana`,
                tempo: "vs semana anterior",
                icon: <TrendingDown className="h-4 w-4" />
              });
            }
          }
        }
      });

      // 2. Campanhas com gasto e sem vendas (últimos 30 dias)
      const { data: campanhasGasto, error: campanhasError } = await supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          ativa,
          conta_anuncio:id_conta(
            id_empresa,
            empresa:id_empresa(nome)
          )
        `)
        .eq("ativa", true);

      if (campanhasError) throw campanhasError;

      // Buscar métricas agregadas por campanha
      const { data: metricasCampanha } = await supabase
        .from("campanha_metricas_dia")
        .select("id_campanha, verba_investida, leads")
        .gte("data", format(subDays(hoje, 30), "yyyy-MM-dd"));

      // Buscar vendas por campanha (via leads)
      const { data: leadsVendas } = await supabase
        .from("lead")
        .select("id_criativo, venda_realizada")
        .eq("venda_realizada", true)
        .gte("data_venda", subDays(hoje, 30).toISOString());

      const { data: criativosCampanha } = await supabase
        .from("criativo")
        .select("id_criativo, id_campanha");

      // Mapear vendas por campanha
      const vendasPorCampanha = new Map<string, number>();
      leadsVendas?.forEach((l: any) => {
        const criativo = criativosCampanha?.find((c: any) => c.id_criativo === l.id_criativo);
        if (criativo) {
          vendasPorCampanha.set(criativo.id_campanha, (vendasPorCampanha.get(criativo.id_campanha) || 0) + 1);
        }
      });

      // Agregar métricas por campanha
      const metricasPorCampanha = new Map<string, { verba: number; leads: number }>();
      metricasCampanha?.forEach((m: any) => {
        if (!metricasPorCampanha.has(m.id_campanha)) {
          metricasPorCampanha.set(m.id_campanha, { verba: 0, leads: 0 });
        }
        const agg = metricasPorCampanha.get(m.id_campanha)!;
        agg.verba += Number(m.verba_investida) || 0;
        agg.leads += m.leads || 0;
      });

      // Detectar campanhas com alto gasto e zero vendas
      campanhasGasto?.forEach((c: any) => {
        if (!empresaId || c.conta_anuncio?.id_empresa === empresaId) {
          const metricas = metricasPorCampanha.get(c.id_campanha);
          const vendas = vendasPorCampanha.get(c.id_campanha) || 0;
          
          if (metricas && metricas.verba > 500 && vendas === 0) {
            alertasDetectados.push({
              id: `campanha_sem_venda_${c.id_campanha}`,
              tipo: metricas.verba > 2000 ? "alto" : "medio",
              categoria: "Campanhas",
              mensagem: `${c.nome.substring(0, 40)}...`,
              detalhe: `${formatCurrency(metricas.verba)} gastos, 0 vendas`,
              tempo: "30 dias",
              icon: <DollarSign className="h-4 w-4" />
            });
          }

          // Campanha com gasto e zero leads
          if (metricas && metricas.verba > 200 && metricas.leads === 0) {
            alertasDetectados.push({
              id: `campanha_sem_leads_${c.id_campanha}`,
              tipo: "alto",
              categoria: "Campanhas",
              mensagem: `${c.nome.substring(0, 40)}...`,
              detalhe: `${formatCurrency(metricas.verba)} gastos, 0 leads`,
              tempo: "30 dias",
              icon: <Target className="h-4 w-4" />
            });
          }
        }
      });

      // 3. Buscar alertas de URL configuração
      const { data: criativosUrl } = await supabase
        .from("criativo")
        .select("id_criativo, url_esperada, campanha:id_campanha(url_esperada)")
        .eq("ativo", true);

      const criativosSemUrl = criativosUrl?.filter((c: any) => 
        !c.url_esperada && !c.campanha?.url_esperada
      ).length || 0;

      if (criativosSemUrl > 10) {
        alertasDetectados.push({
          id: "urls_nao_configuradas",
          tipo: "medio",
          categoria: "Config",
          mensagem: `${criativosSemUrl} criativos sem URL esperada`,
          detalhe: "Configure URLs para validação de tracking",
          tempo: "Config",
          icon: <AlertTriangle className="h-4 w-4" />
        });
      }

      // Ordenar por criticidade
      const ordemTipo = { critico: 0, alto: 1, medio: 2 };
      alertasDetectados.sort((a, b) => ordemTipo[a.tipo] - ordemTipo[b.tipo]);

      return alertasDetectados.slice(0, 10); // Top 10 alertas
    },
  });

  const getCorTipo = (tipo: Alerta["tipo"]) => {
    switch (tipo) {
      case "critico": return "bg-red-500";
      case "alto": return "bg-orange-500";
      case "medio": return "bg-yellow-500";
    }
  };

  const getBadgeTipo = (tipo: Alerta["tipo"]) => {
    switch (tipo) {
      case "critico": return <Badge variant="destructive">CRÍTICO</Badge>;
      case "alto": return <Badge className="bg-orange-500 hover:bg-orange-600">ALTO</Badge>;
      case "medio": return <Badge variant="outline" className="text-yellow-600 border-yellow-600">MÉDIO</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertasCriticos = alertas?.filter(a => a.tipo === "critico").length || 0;
  const alertasAlto = alertas?.filter(a => a.tipo === "alto").length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Anomalias
            </CardTitle>
            <CardDescription>Detecção automática baseada em histórico</CardDescription>
          </div>
          <div className="flex gap-2">
            {alertasCriticos > 0 && (
              <Badge variant="destructive">{alertasCriticos} críticos</Badge>
            )}
            {alertasAlto > 0 && (
              <Badge className="bg-orange-500">{alertasAlto} altos</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        {!alertas || alertas.length === 0 ? (
          <div className="text-center py-6 md:py-8 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm md:text-base">Nenhuma anomalia detectada</p>
            <p className="text-xs md:text-sm">Sistema operando normalmente</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {alertas.map((alerta) => (
              <div 
                key={alerta.id}
                className={`p-2 md:p-4 rounded-lg border flex items-start gap-2 md:gap-3 ${
                  alerta.tipo === "critico" 
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" 
                    : alerta.tipo === "alto"
                    ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"
                    : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
                }`}
              >
                <div className={`p-1.5 md:p-2 rounded-full shrink-0 ${
                  alerta.tipo === "critico" ? "bg-red-100 dark:bg-red-900 text-red-600" :
                  alerta.tipo === "alto" ? "bg-orange-100 dark:bg-orange-900 text-orange-600" :
                  "bg-yellow-100 dark:bg-yellow-900 text-yellow-600"
                }`}>
                  {alerta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                    {getBadgeTipo(alerta.tipo)}
                    <Badge variant="outline" className="text-[10px] md:text-xs">{alerta.categoria}</Badge>
                    <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                      {alerta.tempo}
                    </span>
                  </div>
                  <div className="text-xs md:text-base font-medium truncate">{alerta.mensagem}</div>
                  <div className="text-[10px] md:text-sm text-muted-foreground truncate">{alerta.detalhe}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
