import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, MousePointer, GitBranch } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CampanhaFluxoDiagram } from "@/components/CampanhaFluxoDiagram";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";

interface Campanha {
  id_campanha: string;
  nome: string;
  objetivo: string | null;
  ativa: boolean;
  data_criacao: string;
  conta_anuncio: {
    nome: string;
    plataforma: string;
    id_empresa: string;
  };
}

interface MetricasSemana {
  verba_investida: number;
  leads: number;
  cpl: number | null;
  mqls: number | null;
  reunioes: number | null;
  vendas: number | null;
}

export default function Campanhas() {
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useUserEmpresas();
  const [filtroStatus, setFiltroStatus] = useState<string>("ativas");
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");
  const [campanhaFluxoOpen, setCampanhaFluxoOpen] = useState(false);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<{ id: string; nome: string } | null>(null);

  // Auto-selecionar empresa quando carregar (se tiver apenas 1)
  useEffect(() => {
    if (empresasPermitidas.length === 1) {
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas]);

  const { data: campanhas, isLoading } = useQuery({
    queryKey: ["campanhas", filtroStatus, empresaSelecionada, empresasPermitidas],
    queryFn: async () => {
      let query = supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          objetivo,
          ativa,
          data_criacao,
          conta_anuncio:id_conta (
            nome,
            plataforma,
            id_empresa
          )
        `)
        .order("data_criacao", { ascending: false });

      if (filtroStatus !== "todas") {
        query = query.eq("ativa", filtroStatus === "ativas");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar por empresas permitidas
      let filteredData = (data as Campanha[]).filter((c) => 
        empresasPermitidas.some((e) => e.id_empresa === c.conta_anuncio?.id_empresa)
      );

      // Filtrar por empresa selecionada
      if (empresaSelecionada !== "todas") {
        filteredData = filteredData.filter((c) => 
          c.conta_anuncio?.id_empresa === empresaSelecionada
        );
      }

      return filteredData;
    },
    enabled: hasAccess,
  });

  const { data: metricasMap } = useQuery({
    queryKey: ["campanhas-metricas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha_semana_metricas")
        .select("*")
        .order("id_semana", { ascending: false });

      if (error) throw error;

      // Agregar métricas por campanha
      const map = new Map<string, MetricasSemana>();
      data?.forEach((metrica: any) => {
        const existing = map.get(metrica.id_campanha) || {
          verba_investida: 0,
          leads: 0,
          cpl: null,
          mqls: 0,
          reunioes: 0,
          vendas: 0,
        };
        map.set(metrica.id_campanha, {
          verba_investida: existing.verba_investida + (metrica.verba_investida || 0),
          leads: existing.leads + (metrica.leads || 0),
          cpl: metrica.cpl,
          mqls: (existing.mqls || 0) + (metrica.mqls || 0),
          reunioes: (existing.reunioes || 0) + (metrica.reunioes || 0),
          vendas: (existing.vendas || 0) + (metrica.vendas || 0),
        });
      });
      return map;
    },
    enabled: hasAccess,
  });

  const calcularROI = (metricas: MetricasSemana | undefined) => {
    if (!metricas || !metricas.vendas || !metricas.verba_investida) return null;
    const receita = metricas.vendas * 1000;
    const roi = ((receita - metricas.verba_investida) / metricas.verba_investida) * 100;
    return roi;
  };

  // Loading state
  if (loadingEmpresas || isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Sem acesso
  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Campanhas</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie e monitore o desempenho das campanhas
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="inativas">Inativas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {empresasPermitidas.length > 1 && (
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                  )}
                  {empresasPermitidas.map((e) => (
                    <SelectItem key={e.id_empresa} value={e.id_empresa}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {campanhas?.map((campanha) => {
            const metricas = metricasMap?.get(campanha.id_campanha);
            const roi = calcularROI(metricas);

            return (
              <Card key={campanha.id_campanha} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl">{campanha.nome}</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCampanhaSelecionada({ id: campanha.id_campanha, nome: campanha.nome });
                            setCampanhaFluxoOpen(true);
                          }}
                          className="ml-4"
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          Ver Fluxo
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={campanha.ativa ? "default" : "secondary"}>
                          {campanha.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                        <Badge variant="outline">
                          {campanha.conta_anuncio.plataforma}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {campanha.conta_anuncio.nome}
                        </span>
                      </div>
                      {campanha.objetivo && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          {campanha.objetivo}
                        </p>
                      )}
                    </div>
                    {roi !== null && (
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">ROI</div>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {roi > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          {roi.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {metricas && (
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span>Investido</span>
                        </div>
                        <div className="text-xl font-semibold">
                          {formatCurrency(metricas.verba_investida)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Leads</span>
                        </div>
                        <div className="text-xl font-semibold">{metricas.leads}</div>
                        {metricas.cpl && (
                          <div className="text-xs text-muted-foreground">
                            CPL: {formatCurrency(metricas.cpl)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MousePointer className="h-4 w-4" />
                          <span>MQLs</span>
                        </div>
                        <div className="text-xl font-semibold">{metricas.mqls || 0}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>Reuniões</span>
                        </div>
                        <div className="text-xl font-semibold">{metricas.reunioes || 0}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>Vendas</span>
                        </div>
                        <div className="text-xl font-semibold text-green-600">
                          {metricas.vendas || 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {campanhas?.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <Target className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">Nenhuma campanha encontrada</h3>
                <p className="text-muted-foreground">
                  {filtroStatus === "todas" 
                    ? "Não há campanhas cadastradas no sistema."
                    : `Não há campanhas ${filtroStatus}.`}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={campanhaFluxoOpen} onOpenChange={setCampanhaFluxoOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fluxo de Conversão</DialogTitle>
          </DialogHeader>
          {campanhaSelecionada && (
            <CampanhaFluxoDiagram 
              campanhaId={campanhaSelecionada.id}
              campanhaNome={campanhaSelecionada.nome}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
