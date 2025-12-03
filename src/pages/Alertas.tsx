import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCard } from "@/components/AlertCard";
import { AlertTriangle, RefreshCw, Link2, CheckCircle2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmpresaMetrica {
  empresa: string;
  id_empresa: string;
  verba: number;
  leads: number;
  cpl: number;
  cpl_maximo: number;
  cac: number;
  cac_maximo: number;
  vendas: number;
}

interface AlertaUTM {
  id_alerta: string;
  id_criativo: string;
  id_campanha: string;
  tipo_discrepancia: string;
  url_esperada: string | null;
  url_capturada: string | null;
  detalhes: Record<string, any>;
  data_deteccao: string;
  criativo: {
    id_criativo_externo: string;
    tipo: string;
    descricao: string | null;
  };
  campanha: {
    nome: string;
  };
}

const tipoDiscrepanciaLabels: Record<string, string> = {
  SEM_URL_CAPTURADA: "URL não capturada",
  PLACEHOLDERS_NAO_RESOLVIDOS: "Placeholders não resolvidos",
  LANDING_PAGE_DIVERGENTE: "Landing page diferente",
  UTM_SOURCE_DIVERGENTE: "utm_source divergente",
  UTM_MEDIUM_DIVERGENTE: "utm_medium divergente",
  UTM_CAMPAIGN_DIVERGENTE: "utm_campaign divergente",
  UTM_CONTENT_DIVERGENTE: "utm_content divergente",
  SEM_UTMS_NA_URL: "Sem UTMs na URL",
};

const Alertas = () => {
  const { toast } = useToast();
  const [executandoDeteccao, setExecutandoDeteccao] = useState(false);

  // Buscar semana atual
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

  // Buscar métricas semanais
  const { data: metricas, isLoading, refetch } = useQuery({
    queryKey: ["metricas-alertas", semanaAtual?.id_semana],
    queryFn: async () => {
      if (!semanaAtual) return [];

      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select(`
          *,
          empresa:id_empresa (
            nome,
            cpl_maximo,
            cac_maximo
          )
        `)
        .eq("id_semana", semanaAtual.id_semana);

      if (error) throw error;
      return data;
    },
    enabled: !!semanaAtual,
  });

  // Buscar alertas UTM não resolvidos
  const { data: alertasUTM, refetch: refetchUTM } = useQuery({
    queryKey: ["alertas-utm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerta_utm")
        .select(`
          *,
          criativo:id_criativo (
            id_criativo_externo,
            tipo,
            descricao
          ),
          campanha:id_campanha (
            nome
          )
        `)
        .eq("resolvido", false)
        .order("data_deteccao", { ascending: false });

      if (error) throw error;
      return data as unknown as AlertaUTM[];
    },
  });

  // Processar alertas de métricas
  const alertas: EmpresaMetrica[] = metricas
    ?.filter((m: any) => {
      const cplAcima = m.cpl && m.empresa?.cpl_maximo && m.cpl > m.empresa.cpl_maximo;
      const cacAcima = m.cac && m.empresa?.cac_maximo && m.cac > m.empresa.cac_maximo;
      return cplAcima || cacAcima;
    })
    .map((m: any) => ({
      empresa: m.empresa?.nome || "N/A",
      id_empresa: m.id_empresa,
      verba: m.verba_investida || 0,
      leads: m.leads_total || 0,
      cpl: m.cpl || 0,
      cpl_maximo: m.empresa?.cpl_maximo || 0,
      cac: m.cac || 0,
      cac_maximo: m.empresa?.cac_maximo || 0,
      vendas: m.vendas || 0,
    })) || [];

  const alertasCPL = alertas.filter((a) => a.cpl > a.cpl_maximo);
  const alertasCAC = alertas.filter((a) => a.cac > a.cac_maximo);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchUTM()]);
    toast({
      title: "Alertas atualizados",
      description: "Os dados foram recarregados com sucesso",
    });
  };

  const handleExecutarDeteccao = async () => {
    setExecutandoDeteccao(true);
    try {
      toast({
        title: "Executando detecção...",
        description: "Analisando criativos para discrepâncias de UTM",
      });

      const { data, error } = await supabase.functions.invoke("detectar-discrepancias-utm");

      if (error) throw error;

      toast({
        title: "Detecção concluída!",
        description: `${data.discrepancias_encontradas} discrepâncias encontradas em ${data.criativos_analisados} criativos`,
      });

      await refetchUTM();
    } catch (error: any) {
      toast({
        title: "Erro na detecção",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExecutandoDeteccao(false);
    }
  };

  const handleMarcarResolvido = async (idAlerta: string) => {
    try {
      const { error } = await supabase
        .from("alerta_utm")
        .update({ resolvido: true, data_resolucao: new Date().toISOString() })
        .eq("id_alerta", idAlerta);

      if (error) throw error;

      toast({
        title: "Alerta resolvido",
        description: "O alerta foi marcado como resolvido",
      });

      await refetchUTM();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const totalAlertasMetricas = alertas.length;
  const totalAlertasUTM = alertasUTM?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando alertas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alertas Automáticos</h1>
          <p className="text-muted-foreground">
            Monitoramento de métricas e validação de UTMs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExecutarDeteccao} disabled={executandoDeteccao}>
            <Link2 className="mr-2 h-4 w-4" />
            {executandoDeteccao ? "Detectando..." : "Detectar UTMs"}
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlertasMetricas + totalAlertasUTM}</div>
            <p className="text-xs text-muted-foreground">Alertas ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas CPL/CAC</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlertasMetricas}</div>
            <p className="text-xs text-muted-foreground">Métricas acima da meta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas UTM</CardTitle>
            <Link2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlertasUTM}</div>
            <p className="text-xs text-muted-foreground">Discrepâncias detectadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {totalAlertasMetricas + totalAlertasUTM === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalAlertasMetricas + totalAlertasUTM === 0 ? "OK" : "Atenção"}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalAlertasMetricas + totalAlertasUTM === 0 
                ? "Tudo em ordem" 
                : "Requer ação"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Alertas */}
      <Tabs defaultValue="utm" className="space-y-4">
        <TabsList>
          <TabsTrigger value="utm" className="gap-2">
            <Link2 className="h-4 w-4" />
            UTM ({totalAlertasUTM})
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Métricas ({totalAlertasMetricas})
          </TabsTrigger>
        </TabsList>

        {/* Tab UTM */}
        <TabsContent value="utm" className="space-y-4">
          {alertasUTM && alertasUTM.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhuma Discrepância de UTM</CardTitle>
                <CardDescription>
                  Todos os criativos com URL esperada configurada estão validados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure URLs esperadas nas campanhas ou criativos para validar UTMs.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alertasUTM?.map((alerta) => (
                <Card key={alerta.id_alerta} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {alerta.campanha?.nome}
                          <Badge variant="secondary" className="text-xs">
                            {tipoDiscrepanciaLabels[alerta.tipo_discrepancia] || alerta.tipo_discrepancia}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Criativo: {alerta.criativo?.id_criativo_externo}
                          {alerta.criativo?.descricao && ` • ${alerta.criativo.descricao}`}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarcarResolvido(alerta.id_alerta)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Resolver
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 text-sm">
                      {alerta.detalhes?.mensagem && (
                        <p className="text-muted-foreground">
                          {alerta.detalhes.mensagem}
                        </p>
                      )}
                      {alerta.url_esperada && (
                        <div>
                          <span className="font-medium text-green-600">Esperado:</span>
                          <p className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                            {alerta.url_esperada}
                          </p>
                        </div>
                      )}
                      {alerta.url_capturada && (
                        <div>
                          <span className="font-medium text-amber-600">Capturado:</span>
                          <p className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                            {alerta.url_capturada}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Detectado em: {new Date(alerta.data_deteccao).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab Métricas */}
        <TabsContent value="metricas" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Semana {semanaAtual?.numero_semana}/{semanaAtual?.ano}
          </p>
          
          {alertas.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum Alerta de Métricas</CardTitle>
                <CardDescription>
                  Todas as empresas estão dentro das metas de CPL e CAC.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Continue monitorando as métricas semanalmente.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {alertasCPL.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Alertas CPL (Custo Por Lead)</h3>
                  <div className="grid gap-4">
                    {alertasCPL.map((alerta) => (
                      <AlertCard
                        key={`cpl-${alerta.id_empresa}`}
                        empresa={alerta.empresa}
                        tipo="CPL"
                        valorAtual={alerta.cpl}
                        valorMaximo={alerta.cpl_maximo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {alertasCAC.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Alertas CAC (Custo de Aquisição)</h3>
                  <div className="grid gap-4">
                    {alertasCAC.map((alerta) => (
                      <AlertCard
                        key={`cac-${alerta.id_empresa}`}
                        empresa={alerta.empresa}
                        tipo="CAC"
                        valorAtual={alerta.cac}
                        valorMaximo={alerta.cac_maximo}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Alertas;
