import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Flame, TrendingDown, TrendingUp, AlertTriangle, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { CriativoDetalhesModal } from "./CriativoDetalhesModal";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";

interface CriativosFadigaProps {
  empresaId?: string;
}

interface CriativoPerformance {
  id: string;
  descricao: string;
  campanha: string;
  impressoes: number;
  cliques: number;
  leads: number;
  verba: number;
  ctr: number;
  cpl: number | null;
  idade: number;
  fatigado: boolean;
  urlPreview?: string;
  urlMidia?: string;
  tipo?: string;
}

export function CriativosFadiga({ empresaId }: CriativosFadigaProps) {
  const [selectedCriativo, setSelectedCriativo] = useState<CriativoPerformance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: criativosData, isLoading } = useQuery({
    queryKey: ["criativos-fadiga", empresaId],
    queryFn: async () => {
      // Buscar criativos ativos com métricas
      let query = supabase
        .from("criativo")
        .select(`
          id_criativo,
          descricao,
          created_at,
          ativo,
          tipo,
          url_preview,
          url_midia,
          campanha:id_campanha(
            nome,
            conta_anuncio:id_conta(id_empresa)
          )
        `)
        .eq("ativo", true);

      const { data: criativos, error: criativosError } = await query;
      if (criativosError) throw criativosError;

      // Filtrar por empresa se especificado
      const criativosFiltrados = criativos?.filter((c: any) => 
        !empresaId || c.campanha?.conta_anuncio?.id_empresa === empresaId
      ) || [];

      // Buscar métricas para cada criativo
      const criativoIds = criativosFiltrados.map((c: any) => c.id_criativo);
      
      if (criativoIds.length === 0) {
        return { criativos: [], melhores: [], piores: [], fatigados: [], verbaTotalFatigados: 0, verbaTotal: 0 };
      }

      const { data: metricas, error: metricasError } = await supabase
        .from("criativo_metricas_dia")
        .select("id_criativo, impressoes, cliques, leads, verba_investida, data")
        .in("id_criativo", criativoIds);

      if (metricasError) throw metricasError;

      // Agregar métricas por criativo
      const metricasMap = new Map<string, { impressoes: number; cliques: number; leads: number; verba: number; diasComMetrica: Set<string>; ctrRecente: number[]; }>();
      
      metricas?.forEach((m: any) => {
        if (!metricasMap.has(m.id_criativo)) {
          metricasMap.set(m.id_criativo, { 
            impressoes: 0, cliques: 0, leads: 0, verba: 0, 
            diasComMetrica: new Set(),
            ctrRecente: []
          });
        }
        const agg = metricasMap.get(m.id_criativo)!;
        agg.impressoes += m.impressoes || 0;
        agg.cliques += m.cliques || 0;
        agg.leads += m.leads || 0;
        agg.verba += Number(m.verba_investida) || 0;
        agg.diasComMetrica.add(m.data);
        
        // Calcular CTR do dia para detectar fadiga
        if (m.impressoes > 0) {
          agg.ctrRecente.push((m.cliques / m.impressoes) * 100);
        }
      });

      // Montar lista de criativos com performance
      const criativosPerformance: CriativoPerformance[] = criativosFiltrados.map((c: any) => {
        const metr = metricasMap.get(c.id_criativo) || { impressoes: 0, cliques: 0, leads: 0, verba: 0, diasComMetrica: new Set(), ctrRecente: [] };
        const ctr = metr.impressoes > 0 ? (metr.cliques / metr.impressoes) * 100 : 0;
        const cpl = metr.leads > 0 ? metr.verba / metr.leads : null;
        const idade = differenceInDays(new Date(), new Date(c.created_at));
        
        // Detectar fadiga: CTR caindo nas últimas métricas
        const ctrRecentes = metr.ctrRecente.slice(-7);
        let fatigado = false;
        if (ctrRecentes.length >= 3) {
          const primeiraMetade = ctrRecentes.slice(0, Math.floor(ctrRecentes.length / 2));
          const segundaMetade = ctrRecentes.slice(Math.floor(ctrRecentes.length / 2));
          const mediaInicio = primeiraMetade.reduce((a, b) => a + b, 0) / primeiraMetade.length;
          const mediaFim = segundaMetade.reduce((a, b) => a + b, 0) / segundaMetade.length;
          fatigado = mediaFim < mediaInicio * 0.8; // CTR caiu mais de 20%
        }

        return {
          id: c.id_criativo,
          descricao: c.descricao || "Sem descrição",
          campanha: c.campanha?.nome || "Sem campanha",
          impressoes: metr.impressoes,
          cliques: metr.cliques,
          leads: metr.leads,
          verba: metr.verba,
          ctr,
          cpl,
          idade,
          fatigado,
          urlPreview: c.url_preview,
          urlMidia: c.url_midia,
          tipo: c.tipo
        };
      }).filter((c: CriativoPerformance) => c.verba > 0);

      // Ordenar por CPL (melhores e piores)
      const comCPL = criativosPerformance.filter(c => c.cpl !== null);
      const melhores = [...comCPL].sort((a, b) => (a.cpl || 0) - (b.cpl || 0)).slice(0, 5);
      const piores = [...comCPL].sort((a, b) => (b.cpl || 0) - (a.cpl || 0)).slice(0, 5);
      const fatigados = criativosPerformance.filter(c => c.fatigado);
      
      const verbaTotal = criativosPerformance.reduce((acc, c) => acc + c.verba, 0);
      const verbaTotalFatigados = fatigados.reduce((acc, c) => acc + c.verba, 0);
      const percentFatigados = verbaTotal > 0 ? (verbaTotalFatigados / verbaTotal) * 100 : 0;

      // Dados para gráfico de idade vs performance
      const idadePerformance = criativosPerformance
        .filter(c => c.cpl !== null)
        .sort((a, b) => a.idade - b.idade)
        .reduce((acc: { idade: string; cpl: number; ctr: number; count: number }[], c) => {
          const bucket = c.idade < 7 ? "0-7 dias" : 
                        c.idade < 14 ? "7-14 dias" : 
                        c.idade < 30 ? "14-30 dias" : "30+ dias";
          const existing = acc.find(a => a.idade === bucket);
          if (existing) {
            existing.cpl = (existing.cpl * existing.count + (c.cpl || 0)) / (existing.count + 1);
            existing.ctr = (existing.ctr * existing.count + c.ctr) / (existing.count + 1);
            existing.count++;
          } else {
            acc.push({ idade: bucket, cpl: c.cpl || 0, ctr: c.ctr, count: 1 });
          }
          return acc;
        }, []);

      return { 
        criativos: criativosPerformance, 
        melhores, 
        piores, 
        fatigados,
        verbaTotalFatigados,
        verbaTotal,
        percentFatigados,
        idadePerformance
      };
    },
  });

  const chartConfig = {
    cpl: { label: "CPL", color: "hsl(var(--chart-1))" },
    ctr: { label: "CTR", color: "hsl(var(--chart-2))" },
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

  const temDados = criativosData && criativosData.criativos.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Fadiga de Criativos
            </CardTitle>
            <CardDescription>Performance e desgaste de criativos ativos</CardDescription>
          </div>
          {temDados && criativosData.fatigados.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criativosData.fatigados.length} fatigados
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!temDados ? (
          <div className="text-center py-8 text-muted-foreground">
            <Flame className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Sem dados de criativos com métricas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo de fadiga */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-center">
                <MetricaComInfo 
                  label="Criativos Ativos" 
                  info="Total de criativos atualmente ativos nas campanhas."
                  className="text-[10px] sm:text-xs text-muted-foreground justify-center"
                />
                <div className="text-base sm:text-xl font-bold">{criativosData.criativos.length}</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-center">
                <MetricaComInfo 
                  label="Fatigados" 
                  info="Criativos com CTR em queda de mais de 20%."
                  className="text-[10px] sm:text-xs text-muted-foreground justify-center"
                />
                <div className="text-base sm:text-xl font-bold text-red-600">{criativosData.fatigados.length}</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-center">
                <MetricaComInfo 
                  label="% Verba Fatigados" 
                  info="Percentual do investimento em criativos fatigados."
                  className="text-[10px] sm:text-xs text-muted-foreground justify-center"
                />
                <div className="text-base sm:text-xl font-bold text-orange-600">
                  {criativosData.percentFatigados.toFixed(1)}%
                </div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-center">
                <MetricaComInfo 
                  label="Verba Fatigados" 
                  info="Valor investido em criativos fatigados."
                  className="text-[10px] sm:text-xs text-muted-foreground justify-center"
                />
                <div className="text-sm sm:text-lg font-bold truncate">{formatCurrency(criativosData.verbaTotalFatigados)}</div>
              </div>
            </div>

            {/* Top 5 Melhores e Piores CPL */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Melhores */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  Top 5 Melhores CPL
                </h4>
                <div className="space-y-1">
                  {criativosData.melhores.map((c, i) => (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/20 text-sm cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                      onClick={() => { setSelectedCriativo(c); setModalOpen(true); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                        <span className="truncate">{c.descricao.substring(0, 30)}...</span>
                      </div>
                      <span className="font-semibold text-green-600 shrink-0">
                        {formatCurrency(c.cpl || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Piores */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  Top 5 Piores CPL
                </h4>
                <div className="space-y-1">
                  {criativosData.piores.map((c, i) => (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20 text-sm cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                      onClick={() => { setSelectedCriativo(c); setModalOpen(true); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                        <span className="truncate">{c.descricao.substring(0, 30)}...</span>
                      </div>
                      <span className="font-semibold text-red-600 shrink-0">
                        {formatCurrency(c.cpl || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gráfico de performance por idade */}
            {criativosData.idadePerformance.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  CPL por Idade do Criativo
                </h4>
                <div className="h-48">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={criativosData.idadePerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis dataKey="idade" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value: number, name: string) => 
                            name === "cpl" ? formatCurrency(value) : `${value.toFixed(2)}%`
                          }
                        />
                        <Bar dataKey="cpl" name="CPL Médio" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* Lista de criativos fatigados */}
            {criativosData.fatigados.length > 0 && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Criativos Fatigados (CTR em queda)
                </h4>
                <div className="space-y-1 text-sm">
                  {criativosData.fatigados.slice(0, 5).map((c) => (
                    <div 
                      key={c.id} 
                      className="flex justify-between cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 p-1 rounded transition-colors"
                      onClick={() => { setSelectedCriativo(c); setModalOpen(true); }}
                    >
                      <span className="truncate">{c.descricao.substring(0, 40)}...</span>
                      <span className="text-muted-foreground">{formatCurrency(c.verba)} gastos</span>
                    </div>
                  ))}
                  {criativosData.fatigados.length > 5 && (
                    <div className="text-muted-foreground">
                      + {criativosData.fatigados.length - 5} outros
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de detalhes */}
        <CriativoDetalhesModal 
          criativo={selectedCriativo}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </CardContent>
    </Card>
  );
}
