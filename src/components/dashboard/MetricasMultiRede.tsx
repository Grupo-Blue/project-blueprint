import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, MousePointerClick, Users, Eye, Globe } from "lucide-react";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

interface MetricasMultiRedeProps {
  empresaId?: string;
  dataReferencia: Date;
}

type RedeSocial = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'TWITTER';

const REDES_INFO: Record<RedeSocial, { icon: string; label: string; color: string; chartColor: string }> = {
  INSTAGRAM: { icon: '📸', label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500', chartColor: '#E1306C' },
  FACEBOOK: { icon: '📘', label: 'Facebook', color: 'bg-blue-600', chartColor: '#1877F2' },
  LINKEDIN: { icon: '💼', label: 'LinkedIn', color: 'bg-blue-700', chartColor: '#0A66C2' },
  TIKTOK: { icon: '🎵', label: 'TikTok', color: 'bg-black', chartColor: '#000000' },
  YOUTUBE: { icon: '📺', label: 'YouTube', color: 'bg-red-600', chartColor: '#FF0000' },
  TWITTER: { icon: '🐦', label: 'Twitter/X', color: 'bg-sky-500', chartColor: '#1DA1F2' },
};

export const MetricasMultiRede = ({ empresaId, dataReferencia }: MetricasMultiRedeProps) => {
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  // Buscar métricas de todas as redes
  const { data: metricasSociais, isLoading } = useQuery({
    queryKey: ["metricas-multi-rede", empresaId, inicioMes.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("social_metricas_dia")
        .select("*")
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (empresaId && empresaId !== "all") {
        query = query.eq("id_empresa", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Processar métricas por rede
  const metricasPorRede = (metricasSociais || []).reduce((acc, m) => {
    const rede = m.rede_social as RedeSocial;
    if (!acc[rede]) {
      acc[rede] = {
        seguidores: 0,
        novosSeguidores: 0,
        cliquesWebsite: 0,
        alcance: 0,
        impressoes: 0,
        engajamento: 0,
        diasComDados: 0,
      };
    }
    
    // Pegar o último valor de seguidores (cumulativo)
    if (m.seguidores_total > acc[rede].seguidores) {
      acc[rede].seguidores = m.seguidores_total;
    }
    
    // Somar métricas incrementais
    acc[rede].novosSeguidores += m.novos_seguidores || 0;
    acc[rede].cliquesWebsite += m.cliques_website || 0;
    acc[rede].alcance += m.alcance || 0;
    acc[rede].impressoes += m.impressoes || 0;
    acc[rede].engajamento += m.engajamento || 0;
    acc[rede].diasComDados++;
    
    return acc;
  }, {} as Record<RedeSocial, { seguidores: number; novosSeguidores: number; cliquesWebsite: number; alcance: number; impressoes: number; engajamento: number; diasComDados: number }>);

  // Preparar dados para o gráfico de cliques por dia
  const dadosGrafico = (metricasSociais || []).reduce((acc, m) => {
    const data = m.data;
    if (!acc[data]) {
      acc[data] = { data };
    }
    acc[data][m.rede_social] = (acc[data][m.rede_social] || 0) + (m.cliques_website || 0);
    return acc;
  }, {} as Record<string, any>);

  const dadosGraficoArray = Object.values(dadosGrafico).sort((a: any, b: any) => 
    new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  // Calcular totais consolidados
  const totalCliques = Object.values(metricasPorRede).reduce((sum, r) => sum + r.cliquesWebsite, 0);
  const totalNovosSeguidores = Object.values(metricasPorRede).reduce((sum, r) => sum + r.novosSeguidores, 0);
  const totalAlcance = Object.values(metricasPorRede).reduce((sum, r) => sum + r.alcance, 0);
  const redesAtivas = Object.keys(metricasPorRede).length;

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

  if (Object.keys(metricasPorRede).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Métricas Multi-Rede
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma métrica de redes sociais disponível. Configure a integração Metricool.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Métricas Multi-Rede
            </CardTitle>
            <CardDescription>
              Desempenho consolidado de todas as redes sociais
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Métricas coletadas automaticamente via Metricool de todas as redes sociais conectadas.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cards de resumo por rede */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.entries(REDES_INFO) as [RedeSocial, typeof REDES_INFO[RedeSocial]][]).map(([rede, info]) => {
            const metricas = metricasPorRede[rede];
            if (!metricas) return null;

            return (
              <div key={rede} className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{info.icon}</span>
                  <span className="text-sm font-medium">{info.label}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Seguidores</span>
                    <span className="font-medium">
                      {metricas.seguidores.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Novos</span>
                    <span className={`font-medium ${metricas.novosSeguidores >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metricas.novosSeguidores >= 0 ? '+' : ''}{metricas.novosSeguidores.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MousePointerClick className="h-3 w-3" />
                      Cliques
                    </span>
                    <span className="font-medium text-primary">
                      {metricas.cliquesWebsite.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Métricas consolidadas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <MousePointerClick className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold text-primary">
              {totalCliques.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">Total Cliques Website</div>
          </div>
          
          <div className="bg-green-500/10 rounded-lg p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600">
              +{totalNovosSeguidores.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">Novos Seguidores</div>
          </div>
          
          <div className="bg-blue-500/10 rounded-lg p-4 text-center">
            <Eye className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">
              {totalAlcance.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">Alcance Total</div>
          </div>
          
          <div className="bg-purple-500/10 rounded-lg p-4 text-center">
            <Globe className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600">
              {redesAtivas}
            </div>
            <div className="text-xs text-muted-foreground">Redes Ativas</div>
          </div>
        </div>

        {/* Gráfico de evolução de cliques */}
        {dadosGraficoArray.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Evolução de Cliques por Rede
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosGraficoArray}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="data" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip 
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy')}
                    formatter={(value: number, name: string) => [value.toLocaleString('pt-BR'), REDES_INFO[name as RedeSocial]?.label || name]}
                  />
                  <Legend 
                    formatter={(value) => REDES_INFO[value as RedeSocial]?.label || value}
                  />
                  {(Object.keys(metricasPorRede) as RedeSocial[]).map((rede) => (
                    <Line
                      key={rede}
                      type="monotone"
                      dataKey={rede}
                      stroke={REDES_INFO[rede].chartColor}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
