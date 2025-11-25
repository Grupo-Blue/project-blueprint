import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CriativoAlertCard } from "@/components/CriativoAlertCard";
import { AlertTriangle, ArrowLeft, RefreshCw, Image, Video, Grid3x3, FileQuestion, Download, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface CampanhaCriativo {
  id_campanha: string;
  nome_campanha: string;
  empresa: string;
  plataforma: string;
  criativos_ativos: number;
  total_criativos: number;
  criativos: Array<{
    id_criativo: string;
    id_criativo_externo: string;
    tipo: string;
    descricao: string | null;
    ativo: boolean;
  }>;
}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case "VIDEO":
      return <Video className="h-4 w-4" />;
    case "IMAGEM":
      return <Image className="h-4 w-4" />;
    case "CARROSSEL":
      return <Grid3x3 className="h-4 w-4" />;
    default:
      return <FileQuestion className="h-4 w-4" />;
  }
};

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    VIDEO: "Vídeo",
    IMAGEM: "Imagem",
    CARROSSEL: "Carrossel",
    OUTRO: "Outro",
  };
  return labels[tipo] || tipo;
};

const getCriativoUrl = (plataforma: string, idExterno: string) => {
  if (plataforma === "META") {
    return `https://business.facebook.com/adsmanager/manage/ads?act=${idExterno.split('_')[0]}&selected_ad_ids=${idExterno}`;
  } else if (plataforma === "GOOGLE") {
    return `https://ads.google.com/aw/ads?campaignId=${idExterno}`;
  }
  return null;
};

const Criativos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [syncingCreatives, setSyncingCreatives] = useState(false);

  // Buscar campanhas com criativos
  const { data: campanhas, isLoading, refetch } = useQuery({
    queryKey: ["campanhas-criativos"],
    queryFn: async () => {
      const { data: campanhasData, error: campanhasError } = await supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          conta_anuncio!inner (
            id_empresa,
            plataforma,
            empresa:id_empresa (
              nome
            )
          )
        `)
        .eq("ativa", true);

      if (campanhasError) throw campanhasError;

      // Para cada campanha, buscar criativos
      const campanhasComCriativos: CampanhaCriativo[] = [];

      for (const camp of campanhasData || []) {
        const { data: criativosData, error: criativosError } = await supabase
          .from("criativo")
          .select("id_criativo, id_criativo_externo, tipo, descricao, ativo")
          .eq("id_campanha", camp.id_campanha);

        if (criativosError) continue;

        const criativosAtivos = criativosData?.filter((c) => c.ativo).length || 0;

        campanhasComCriativos.push({
          id_campanha: camp.id_campanha,
          nome_campanha: camp.nome,
          empresa: (camp as any).conta_anuncio?.empresa?.nome || "N/A",
          plataforma: (camp as any).conta_anuncio?.plataforma || "OUTRO",
          criativos_ativos: criativosAtivos,
          total_criativos: criativosData?.length || 0,
          criativos: criativosData?.map((c) => ({
            id_criativo: c.id_criativo,
            id_criativo_externo: c.id_criativo_externo,
            tipo: c.tipo,
            descricao: c.descricao,
            ativo: c.ativo,
          })) || [],
        });
      }

      return campanhasComCriativos;
    },
  });

  // Filtrar alertas (campanhas com < 2 criativos ativos)
  const alertas = campanhas?.filter((c) => c.criativos_ativos < 2) || [];
  
  // Campanhas OK (com 2 ou mais criativos ativos)
  const campanhasOk = campanhas?.filter((c) => c.criativos_ativos >= 2) || [];

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Criativos atualizados",
      description: "Os dados foram recarregados com sucesso",
    });
  };

  const handleSyncCreatives = async () => {
    setSyncingCreatives(true);
    
    try {
      toast({
        title: "Sincronizando criativos...",
        description: "Buscando criativos das integrações ativas",
      });

      // Chamar ambas as edge functions em paralelo
      const [metaResult, googleResult] = await Promise.allSettled([
        supabase.functions.invoke("coletar-criativos-meta"),
        supabase.functions.invoke("coletar-criativos-google"),
      ]);

      let hasErrors = false;
      let successCount = 0;

      // Verificar resultado Meta
      if (metaResult.status === "fulfilled") {
        const metaData = metaResult.value.data as any;
        if (metaData?.success) {
          successCount++;
        } else if (metaData?.error) {
          hasErrors = true;
          toast({
            title: "Erro no Meta Ads",
            description: metaData.error,
            variant: "destructive",
          });
        }
      } else {
        hasErrors = true;
        toast({
          title: "Erro no Meta Ads",
          description: metaResult.reason?.message || "Erro desconhecido",
          variant: "destructive",
        });
      }

      // Verificar resultado Google
      if (googleResult.status === "fulfilled") {
        const googleData = googleResult.value.data as any;
        if (googleData?.success) {
          successCount++;
        } else if (googleData?.error) {
          hasErrors = true;
          toast({
            title: "Erro no Google Ads",
            description: googleData.error,
            variant: "destructive",
          });
        }
      } else {
        hasErrors = true;
        toast({
          title: "Erro no Google Ads",
          description: googleResult.reason?.message || "Erro desconhecido",
          variant: "destructive",
        });
      }

      if (!hasErrors && successCount > 0) {
        toast({
          title: "Sincronização concluída!",
          description: "Criativos sincronizados com sucesso",
        });
        await refetch();
      } else if (successCount === 0 && hasErrors) {
        toast({
          title: "Falha na sincronização",
          description: "Nenhuma integração foi sincronizada com sucesso",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncingCreatives(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando criativos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gestão de Criativos</h1>
                <p className="text-sm text-muted-foreground">
                  Alertas de campanhas com menos de 2 criativos ativos
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleSyncCreatives}
                disabled={syncingCreatives}
              >
                <Download className="mr-2 h-4 w-4" />
                {syncingCreatives ? "Sincronizando..." : "Sincronizar Criativos"}
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campanhas</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campanhas?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Campanhas ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Alertas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{alertas.length}</div>
              <p className="text-xs text-muted-foreground">Menos de 2 criativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sem Criativos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {alertas.filter((a) => a.criativos_ativos === 0).length}
              </div>
              <p className="text-xs text-muted-foreground">Crítico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">OK</CardTitle>
              <Image className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{campanhasOk.length}</div>
              <p className="text-xs text-muted-foreground">2+ criativos ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">🚨 Campanhas com Alertas</h2>
            <div className="grid gap-4">
              {alertas.map((campanha) => (
                <CriativoAlertCard
                  key={campanha.id_campanha}
                  campanha={campanha.nome_campanha}
                  criativosAtivos={campanha.criativos_ativos}
                  empresa={campanha.empresa}
                />
              ))}
            </div>
          </div>
        )}

        {/* Todas as Campanhas */}
        <div>
          <h2 className="text-xl font-bold mb-4">Todas as Campanhas</h2>
          {campanhas && campanhas.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhuma Campanha Ativa</CardTitle>
                <CardDescription>
                  Não há campanhas ativas cadastradas no sistema.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {campanhas?.map((campanha) => (
                <Card key={campanha.id_campanha}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {campanha.nome_campanha}
                          {campanha.criativos_ativos < 2 && (
                            <Badge variant="destructive">Alerta</Badge>
                          )}
                          {campanha.criativos_ativos >= 2 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              OK
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {campanha.empresa} • {campanha.criativos_ativos} criativos ativos de {campanha.total_criativos} total
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {campanha.criativos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum criativo cadastrado</p>
                    ) : (
                      <div className="space-y-2">
                        {campanha.criativos.map((criativo) => {
                          const criativoUrl = getCriativoUrl(campanha.plataforma, criativo.id_criativo_externo);
                          
                          return (
                            <div
                              key={criativo.id_criativo}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center gap-2">
                                  {getTipoIcon(criativo.tipo)}
                                  <span className="text-sm font-medium">
                                    {getTipoLabel(criativo.tipo)}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">ID:</span>
                                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                      {criativo.id_criativo_externo}
                                    </code>
                                  </div>
                                  {criativo.descricao && (
                                    <span className="text-sm text-muted-foreground truncate max-w-[400px]">
                                      {criativo.descricao}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={criativo.ativo ? "secondary" : "outline"}>
                                  {criativo.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                                {criativoUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(criativoUrl, '_blank')}
                                    className="gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Ver
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Criativos;
