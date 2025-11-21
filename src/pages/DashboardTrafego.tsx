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
}

export default function DashboardTrafego() {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-atual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: campanhasMetricas, isLoading } = useQuery({
    queryKey: ["campanhas-metricas", semanaAtual?.id_semana, empresaSelecionada],
    queryFn: async () => {
      if (!semanaAtual) return [];

      let query = supabase
        .from("campanha_semana_metricas")
        .select(`
          *,
          campanha:id_campanha (nome, id_conta),
          conta_anuncio!inner (id_empresa)
        `)
        .eq("id_semana", semanaAtual.id_semana);

      if (empresaSelecionada !== "todas") {
        query = query.eq("conta_anuncio.id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((m: any) => ({
        id_campanha: m.id_campanha,
        nome: m.campanha.nome,
        leads: m.leads,
        verba_investida: m.verba_investida,
        cpl: m.cpl,
        reunioes: m.reunioes || 0,
        mqls: m.mqls || 0,
        levantadas: m.levantadas || 0,
        vendas: m.vendas || 0,
        ticket_medio: m.ticket_medio || 0,
        cac: m.cac || 0,
      })) as CampanhaMetrica[];
    },
    enabled: !!semanaAtual,
  });

  const totais = campanhasMetricas?.reduce(
    (acc, c) => ({
      verba: acc.verba + c.verba_investida,
      leads: acc.leads + c.leads,
      mqls: acc.mqls + c.mqls,
      levantadas: acc.levantadas + c.levantadas,
      reunioes: acc.reunioes + c.reunioes,
      vendas: acc.vendas + c.vendas,
    }),
    { verba: 0, leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 }
  ) || { verba: 0, leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 };

  const taxaMQL = totais.leads > 0 ? (totais.mqls / totais.leads) * 100 : 0;
  const taxaLevantada = totais.mqls > 0 ? (totais.levantadas / totais.mqls) * 100 : 0;
  const taxaReuniao = totais.levantadas > 0 ? (totais.reunioes / totais.levantadas) * 100 : 0;
  const taxaVenda = totais.reunioes > 0 ? (totais.vendas / totais.reunioes) * 100 : 0;

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard Tráfego</h1>
            <p className="text-muted-foreground mt-2">
              Análise detalhada de campanhas e funil
              {semanaAtual && ` - Semana ${semanaAtual.numero_semana}/${semanaAtual.ano}`}
            </p>
          </div>
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
                R$ {totais.verba.toLocaleString("pt-BR")}
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
            <CardTitle>Performance por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campanhasMetricas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha encontrada
                </p>
              ) : (
                campanhasMetricas?.map((campanha) => (
                  <div
                    key={campanha.id_campanha}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{campanha.nome}</h3>
                        <Badge variant="outline">
                          CPL: R$ {campanha.cpl?.toFixed(2) || "N/A"}
                        </Badge>
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
