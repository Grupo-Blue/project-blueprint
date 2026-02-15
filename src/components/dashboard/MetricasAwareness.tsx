import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Eye, MousePointer, TrendingUp, DollarSign, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";

interface MetricasAwarenessProps {
  empresaId: string | null;
  dataInicio: Date;
  dataFim: Date;
}

export function MetricasAwareness({ empresaId, dataInicio, dataFim }: MetricasAwarenessProps) {
  // Buscar métricas do Instagram
  const { data: metricasInstagram, isLoading: loadingMetricas } = useQuery({
    queryKey: ["instagram-metricas", empresaId, dataInicio.toISOString(), dataFim.toISOString()],
    queryFn: async () => {
      if (!empresaId) return [];
      
      const { data, error } = await supabase
        .from("instagram_metricas_dia")
        .select("*")
        .eq("id_empresa", empresaId)
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .lte("data", format(dataFim, "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar investimento em campanhas de awareness (objetivo: REACH, AWARENESS, ENGAGEMENT)
  const { data: investimentoAwareness, isLoading: loadingInvestimento } = useQuery({
    queryKey: ["investimento-awareness", empresaId, dataInicio.toISOString(), dataFim.toISOString()],
    queryFn: async () => {
      if (!empresaId) return 0;

      // Buscar contas da empresa
      const { data: contas } = await supabase
        .from("conta_anuncio")
        .select("id_conta")
        .eq("id_empresa", empresaId);

      if (!contas || contas.length === 0) return 0;

      // Buscar campanhas de awareness
      const { data: campanhas } = await supabase
        .from("campanha")
        .select("id_campanha, objetivo")
        .in("id_conta", contas.map(c => c.id_conta))
        .in("objetivo", ["REACH", "AWARENESS", "ENGAGEMENT", "POST_ENGAGEMENT", "VIDEO_VIEWS", "BRAND_AWARENESS"]);

      if (!campanhas || campanhas.length === 0) return 0;

      // Buscar investimento nas campanhas
      const { data: metricas } = await supabase
        .from("campanha_metricas_dia")
        .select("verba_investida")
        .in("id_campanha", campanhas.map(c => c.id_campanha))
        .not("fonte_conversoes", "is", null)
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .lte("data", format(dataFim, "yyyy-MM-dd"));

      return metricas?.reduce((acc, m) => acc + Number(m.verba_investida || 0), 0) || 0;
    },
    enabled: !!empresaId,
  });

  // Buscar leads orgânicos do Instagram
  const { data: leadsOrganicos, isLoading: loadingLeads } = useQuery({
    queryKey: ["leads-organicos-instagram", empresaId, dataInicio.toISOString(), dataFim.toISOString()],
    queryFn: async () => {
      if (!empresaId) return 0;

      const { count } = await supabase
        .from("lead")
        .select("id_lead", { count: "exact", head: true })
        .eq("id_empresa", empresaId)
        .or("utm_source.ilike.%instagram%,utm_source.ilike.%instagram_bio%,utm_source.eq.ig")
        .eq("lead_pago", false)
        .gte("data_criacao", dataInicio.toISOString())
        .lte("data_criacao", dataFim.toISOString());

      return count || 0;
    },
    enabled: !!empresaId,
  });

  const isLoading = loadingMetricas || loadingInvestimento || loadingLeads;

  if (!empresaId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Métricas de Awareness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            Selecione uma empresa para ver as métricas de awareness
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Métricas de Awareness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calcular totais
  const totalNovosSeguidores = metricasInstagram?.reduce((acc, m) => acc + (m.novos_seguidores || 0), 0) || 0;
  const totalVisitasPerfil = metricasInstagram?.reduce((acc, m) => acc + (m.visitas_perfil || 0), 0) || 0;
  const totalCliquesWebsite = metricasInstagram?.reduce((acc, m) => acc + (m.cliques_website || 0), 0) || 0;
  const totalAlcance = metricasInstagram?.reduce((acc, m) => acc + (m.alcance || 0), 0) || 0;
  const ultimoSeguidoresTotal = metricasInstagram?.length > 0 
    ? metricasInstagram[metricasInstagram.length - 1].seguidores_total 
    : 0;

  // Calcular métricas derivadas
  const custoPorSeguidor = totalNovosSeguidores > 0 && investimentoAwareness 
    ? investimentoAwareness / totalNovosSeguidores 
    : null;
  const custoPorVisitaPerfil = totalVisitasPerfil > 0 && investimentoAwareness 
    ? investimentoAwareness / totalVisitasPerfil 
    : null;
  const taxaConversaoSeguidorLead = totalNovosSeguidores > 0 && leadsOrganicos 
    ? (leadsOrganicos / totalNovosSeguidores) * 100 
    : null;

  // Preparar dados do gráfico
  const chartData = metricasInstagram?.map(m => ({
    data: format(parseISO(m.data), "dd/MM", { locale: ptBR }),
    seguidores: m.novos_seguidores || 0,
    visitasPerfil: m.visitas_perfil || 0,
    cliques: m.cliques_website || 0,
    alcance: m.alcance || 0,
  })) || [];

  const temDados = metricasInstagram && metricasInstagram.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-pink-500" />
          Métricas de Awareness (Instagram via Metricool)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!temDados ? (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma métrica de Instagram disponível para este período.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure a integração com Metricool na página de Integrações.
            </p>
          </div>
        ) : (
          <>
            {/* Cards de métricas principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10 border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-pink-500" />
                  <MetricaComInfo
                    label="Novos Seguidores"
                    info="Total de novos seguidores no período"
                    className="text-sm text-muted-foreground"
                  />
                </div>
                <p className="text-2xl font-bold">{totalNovosSeguidores.toLocaleString("pt-BR")}</p>
                {ultimoSeguidoresTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {ultimoSeguidoresTotal.toLocaleString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <MetricaComInfo
                    label="Visitas ao Perfil"
                    info="Total de visitas ao perfil do Instagram"
                    className="text-sm text-muted-foreground"
                  />
                </div>
                <p className="text-2xl font-bold">{totalVisitasPerfil.toLocaleString("pt-BR")}</p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border">
                <div className="flex items-center gap-2 mb-2">
                  <MousePointer className="h-4 w-4 text-green-500" />
                  <MetricaComInfo
                    label="Cliques no Site"
                    info="Cliques no link do perfil (bio)"
                    className="text-sm text-muted-foreground"
                  />
                </div>
                <p className="text-2xl font-bold">{totalCliquesWebsite.toLocaleString("pt-BR")}</p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10 border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <MetricaComInfo
                    label="Alcance Total"
                    info="Contas únicas alcançadas"
                    className="text-sm text-muted-foreground"
                  />
                </div>
                <p className="text-2xl font-bold">{totalAlcance.toLocaleString("pt-BR")}</p>
              </div>
            </div>

            {/* Métricas de ROI de Awareness */}
            {investimentoAwareness !== undefined && investimentoAwareness > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <MetricaComInfo
                      label="Investimento Awareness"
                      info="Investimento em campanhas de alcance, engajamento e awareness"
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="text-xl font-bold">R$ {investimentoAwareness.toFixed(2)}</p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-pink-500" />
                    <MetricaComInfo
                      label="Custo por Seguidor"
                      info="Investimento dividido por novos seguidores"
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="text-xl font-bold">{custoPorSeguidor ? `R$ ${custoPorSeguidor.toFixed(2)}` : "N/A"}</p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <MetricaComInfo
                      label="Custo por Visita"
                      info="Investimento dividido por visitas ao perfil"
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="text-xl font-bold">{custoPorVisitaPerfil ? `R$ ${custoPorVisitaPerfil.toFixed(2)}` : "N/A"}</p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <MetricaComInfo
                      label="Taxa Seguidor → Lead"
                      info="Leads orgânicos ÷ Novos seguidores"
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="text-xl font-bold">{taxaConversaoSeguidorLead ? `${taxaConversaoSeguidorLead.toFixed(2)}%` : "N/A"}</p>
                  {leadsOrganicos !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {leadsOrganicos} leads orgânicos
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Gráfico de evolução */}
            {chartData.length > 0 && (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="data" 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="seguidores" 
                      name="Novos Seguidores"
                      stroke="#ec4899" 
                      strokeWidth={2}
                      dot={{ fill: '#ec4899', r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="visitasPerfil" 
                      name="Visitas Perfil"
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cliques" 
                      name="Cliques Website"
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
