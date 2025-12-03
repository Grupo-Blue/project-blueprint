import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CriativoAlertCard } from "@/components/CriativoAlertCard";
import { AlertTriangle, RefreshCw, Image, Video, Grid3x3, FileQuestion, Download, ExternalLink, Copy, ChevronDown, Eye, Link2, Pencil, Link2Off } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CampanhaCriativo {
  id_campanha: string;
  nome_campanha: string;
  empresa: string;
  plataforma: string;
  criativos_ativos: number;
  total_criativos: number;
  url_esperada_campanha: string | null;
  criativos: Array<{
    id_criativo: string;
    id_criativo_externo: string;
    tipo: string;
    descricao: string | null;
    ativo: boolean;
    url_midia: string | null;
    url_preview: string | null;
    url_esperada: string | null;
  }>;
}

interface CriativoParaEditar {
  id_criativo: string;
  id_criativo_externo: string;
  tipo: string;
  descricao: string | null;
  url_esperada: string | null;
  url_esperada_campanha: string | null;
  nome_campanha: string;
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

const Criativos = () => {
  const { toast } = useToast();
  const [syncingCreatives, setSyncingCreatives] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [criativoEditando, setCriativoEditando] = useState<CriativoParaEditar | null>(null);
  const [urlEsperadaInput, setUrlEsperadaInput] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Buscar campanhas com criativos
  const { data: campanhas, isLoading, refetch } = useQuery({
    queryKey: ["campanhas-criativos"],
    queryFn: async () => {
      const { data: campanhasData, error: campanhasError } = await supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          url_esperada,
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
          .select("id_criativo, id_criativo_externo, tipo, descricao, ativo, url_midia, url_preview, url_esperada")
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
          url_esperada_campanha: camp.url_esperada,
          criativos: criativosData?.map((c) => ({
            id_criativo: c.id_criativo,
            id_criativo_externo: c.id_criativo_externo,
            tipo: c.tipo,
            descricao: c.descricao,
            ativo: c.ativo,
            url_midia: c.url_midia,
            url_preview: c.url_preview,
            url_esperada: c.url_esperada,
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

  const handleCopyId = (idExterno: string) => {
    navigator.clipboard.writeText(idExterno);
    toast({
      title: "ID copiado!",
      description: "Use este ID no parâmetro utm_content dos seus anúncios",
    });
  };

  const handleAbrirModal = (criativo: CampanhaCriativo["criativos"][0], campanha: CampanhaCriativo) => {
    setCriativoEditando({
      id_criativo: criativo.id_criativo,
      id_criativo_externo: criativo.id_criativo_externo,
      tipo: criativo.tipo,
      descricao: criativo.descricao,
      url_esperada: criativo.url_esperada,
      url_esperada_campanha: campanha.url_esperada_campanha,
      nome_campanha: campanha.nome_campanha,
    });
    setUrlEsperadaInput(criativo.url_esperada || "");
    setModalOpen(true);
  };

  const handleSalvarUrlEsperada = async () => {
    if (!criativoEditando) return;
    
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("criativo")
        .update({ url_esperada: urlEsperadaInput.trim() || null })
        .eq("id_criativo", criativoEditando.id_criativo);

      if (error) throw error;

      toast({
        title: "URL salva com sucesso!",
        description: urlEsperadaInput.trim() 
          ? "O criativo agora usa URL própria" 
          : "O criativo agora herda a URL da campanha",
      });
      
      setModalOpen(false);
      setCriativoEditando(null);
      await refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  // Função para determinar o status da URL do criativo
  const getUrlStatus = (criativo: CampanhaCriativo["criativos"][0], urlCampanha: string | null) => {
    if (criativo.url_esperada) {
      return { icon: <Pencil className="h-3 w-3" />, label: "URL própria", color: "text-blue-600" };
    }
    if (urlCampanha) {
      return { icon: <Link2 className="h-3 w-3" />, label: "Herdando", color: "text-muted-foreground" };
    }
    return { icon: <Link2Off className="h-3 w-3" />, label: "Sem URL", color: "text-amber-600" };
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
            <div>
              <h1 className="text-2xl font-bold">Gestão de Criativos</h1>
              <p className="text-sm text-muted-foreground">
                Alertas de campanhas com menos de 2 criativos ativos
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={syncingCreatives}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {syncingCreatives ? "Atualizando..." : "Atualizar"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar Dados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSyncCreatives}>
                  <Download className="mr-2 h-4 w-4" />
                  Sincronizar com APIs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                          {campanha.url_esperada_campanha && (
                            <span className="ml-2 text-blue-600">• URL campanha configurada</span>
                          )}
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
                          const urlStatus = getUrlStatus(criativo, campanha.url_esperada_campanha);
                          return (
                            <div
                              key={criativo.id_criativo}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                              onClick={() => handleAbrirModal(criativo, campanha)}
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
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyId(criativo.id_criativo_externo);
                                      }}
                                      className="h-6 w-6 p-0"
                                      title="Copiar ID"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {criativo.descricao && (
                                    <span className="text-sm text-muted-foreground truncate max-w-[400px]">
                                      {criativo.descricao}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Indicador de status da URL */}
                                <div className={`flex items-center gap-1 text-xs ${urlStatus.color}`} title={urlStatus.label}>
                                  {urlStatus.icon}
                                  <span className="hidden sm:inline">{urlStatus.label}</span>
                                </div>
                                <Badge variant={criativo.ativo ? "secondary" : "outline"}>
                                  {criativo.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                                {criativo.url_preview && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(criativo.url_preview!, '_blank');
                                    }}
                                    className="gap-1"
                                    title="Ver preview do criativo no Facebook"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Ver Preview
                                  </Button>
                                )}
                                {criativo.url_midia && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(criativo.url_midia!, '_blank');
                                    }}
                                    className="gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Ver Mídia
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

      {/* Modal de edição de URL esperada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {criativoEditando && getTipoIcon(criativoEditando.tipo)}
              Editar URL Esperada
            </DialogTitle>
            <DialogDescription>
              Configure a URL esperada para validação de UTMs deste criativo
            </DialogDescription>
          </DialogHeader>

          {criativoEditando && (
            <div className="space-y-4">
              {/* Info do criativo */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Campanha:</span>{" "}
                  <strong>{criativoEditando.nome_campanha}</strong>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {getTipoLabel(criativoEditando.tipo)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">ID Externo:</span>{" "}
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {criativoEditando.id_criativo_externo}
                  </code>
                </p>
                {criativoEditando.descricao && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Descrição:</span>{" "}
                    {criativoEditando.descricao}
                  </p>
                )}
              </div>

              {/* URL da campanha (referência) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  URL da Campanha (herdada)
                </Label>
                {criativoEditando.url_esperada_campanha ? (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-mono break-all">
                      {criativoEditando.url_esperada_campanha}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      📝 Se deixar o campo abaixo vazio, o criativo usará esta URL
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed bg-amber-50 dark:bg-amber-950/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      ⚠️ Nenhuma URL configurada na campanha
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure uma URL abaixo ou cadastre na campanha
                    </p>
                  </div>
                )}
              </div>

              {/* URL específica do criativo */}
              <div className="space-y-2">
                <Label htmlFor="url-esperada" className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  URL Específica do Criativo (override)
                </Label>
                <Textarea
                  id="url-esperada"
                  placeholder="https://seusite.com.br/pagina?utm_source=meta&utm_medium=cpc&utm_campaign=nome..."
                  value={urlEsperadaInput}
                  onChange={(e) => setUrlEsperadaInput(e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  ✨ Se preenchido, esta URL sobrescreve a URL da campanha para este criativo
                </p>
              </div>

              {/* Status atual */}
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-sm font-medium mb-1">Status Atual:</p>
                {urlEsperadaInput.trim() ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Pencil className="h-4 w-4" />
                    <span>Usando URL PRÓPRIA do criativo</span>
                  </div>
                ) : criativoEditando.url_esperada_campanha ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    <span>Usando URL da CAMPANHA (herdada)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Link2Off className="h-4 w-4" />
                    <span>Nenhuma URL configurada</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setUrlEsperadaInput("")} 
              disabled={salvando || !urlEsperadaInput.trim()}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              <Link2Off className="h-4 w-4 mr-2" />
              Limpar URL (herdar da campanha)
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarUrlEsperada} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Criativos;
