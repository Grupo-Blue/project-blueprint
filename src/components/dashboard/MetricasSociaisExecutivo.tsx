import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, Users, Eye, Share2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

interface MetricasSociaisExecutivoProps {
  empresaId?: string;
  dataReferencia: Date;
}

interface MetricaAgregada {
  cliques_website: number;
  novos_seguidores: number;
  alcance: number;
  redes_ativas: number;
}

export function MetricasSociaisExecutivo({ empresaId, dataReferencia }: MetricasSociaisExecutivoProps) {
  // Calcular período atual
  const inicioMesAtual = startOfMonth(dataReferencia);
  const fimMesAtual = endOfMonth(dataReferencia);
  const hoje = new Date();
  const dataFinalAtual = fimMesAtual > hoje ? hoje : fimMesAtual;

  // Calcular período anterior (mês anterior)
  const mesAnterior = subMonths(dataReferencia, 1);
  const inicioMesAnterior = startOfMonth(mesAnterior);
  const fimMesAnterior = endOfMonth(mesAnterior);

  // Query período atual
  const { data: metricasAtuais, isLoading: loadingAtual } = useQuery({
    queryKey: ["social-executivo-atual", empresaId, format(inicioMesAtual, "yyyy-MM-dd")],
    queryFn: async () => {
      let query = supabase
        .from("social_metricas_dia")
        .select("rede_social, cliques_website, novos_seguidores, alcance")
        .gte("data", format(inicioMesAtual, "yyyy-MM-dd"))
        .lte("data", format(dataFinalAtual, "yyyy-MM-dd"));

      if (empresaId) {
        query = query.eq("id_empresa", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query período anterior
  const { data: metricasAnteriores, isLoading: loadingAnterior } = useQuery({
    queryKey: ["social-executivo-anterior", empresaId, format(inicioMesAnterior, "yyyy-MM-dd")],
    queryFn: async () => {
      let query = supabase
        .from("social_metricas_dia")
        .select("rede_social, cliques_website, novos_seguidores, alcance")
        .gte("data", format(inicioMesAnterior, "yyyy-MM-dd"))
        .lte("data", format(fimMesAnterior, "yyyy-MM-dd"));

      if (empresaId) {
        query = query.eq("id_empresa", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Agregar métricas
  const agregarMetricas = (metricas: typeof metricasAtuais): MetricaAgregada => {
    if (!metricas || metricas.length === 0) {
      return { cliques_website: 0, novos_seguidores: 0, alcance: 0, redes_ativas: 0 };
    }

    const redesUnicas = new Set(metricas.map(m => m.rede_social));
    
    return {
      cliques_website: metricas.reduce((sum, m) => sum + (m.cliques_website || 0), 0),
      novos_seguidores: metricas.reduce((sum, m) => sum + (m.novos_seguidores || 0), 0),
      alcance: metricas.reduce((sum, m) => sum + (m.alcance || 0), 0),
      redes_ativas: redesUnicas.size,
    };
  };

  const atual = agregarMetricas(metricasAtuais);
  const anterior = agregarMetricas(metricasAnteriores);

  // Calcular variação percentual
  const calcularVariacao = (valorAtual: number, valorAnterior: number): number | null => {
    if (valorAnterior === 0) return valorAtual > 0 ? 100 : null;
    return ((valorAtual - valorAnterior) / valorAnterior) * 100;
  };

  const variacaoCliques = calcularVariacao(atual.cliques_website, anterior.cliques_website);
  const variacaoSeguidores = calcularVariacao(atual.novos_seguidores, anterior.novos_seguidores);
  const variacaoAlcance = calcularVariacao(atual.alcance, anterior.alcance);

  const isLoading = loadingAtual || loadingAnterior;

  // Formatar números grandes
  const formatarNumero = (valor: number): string => {
    if (valor >= 1000000) return `${(valor / 1000000).toFixed(1)}M`;
    if (valor >= 1000) return `${(valor / 1000).toFixed(1)}K`;
    return valor.toLocaleString("pt-BR");
  };

  // Componente de indicador de tendência
  const IndicadorTendencia = ({ variacao }: { variacao: number | null }) => {
    if (variacao === null) return null;
    
    const isPositivo = variacao >= 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs ${isPositivo ? "text-green-600" : "text-red-600"}`}>
        {isPositivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(variacao).toFixed(0)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Métricas de Awareness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se não há dados, não exibir o card
  if (atual.cliques_website === 0 && atual.novos_seguidores === 0 && atual.alcance === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Métricas de Awareness
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Métricas consolidadas de redes sociais (Instagram, Facebook, LinkedIn, TikTok, YouTube, Twitter). Comparação com mês anterior.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Cliques Website */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Share2 className="h-3 w-3" />
              Cliques Website
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{formatarNumero(atual.cliques_website)}</span>
              <IndicadorTendencia variacao={variacaoCliques} />
            </div>
          </div>

          {/* Novos Seguidores */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Novos Seguidores
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">+{formatarNumero(atual.novos_seguidores)}</span>
              <IndicadorTendencia variacao={variacaoSeguidores} />
            </div>
          </div>

          {/* Alcance Total */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              Alcance Total
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{formatarNumero(atual.alcance)}</span>
              <IndicadorTendencia variacao={variacaoAlcance} />
            </div>
          </div>

          {/* Redes Ativas */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Redes Ativas
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{atual.redes_ativas}</span>
              <span className="text-xs text-muted-foreground">de 6</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
