import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Eye,
  RefreshCw,
  Plus,
  ExternalLink,
  Search,
  Building2,
  TrendingUp,
  Newspaper,
  Settings,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AnaliseCompetitiva() {
  const { empresaSelecionada } = useEmpresa();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [plataformaFiltro, setPlataformaFiltro] = useState("todas");
  const [tabAtiva, setTabAtiva] = useState("anuncios");

  // Fetch competitor ads
  const { data: anuncios, isLoading: loadingAnuncios } = useQuery({
    queryKey: ["concorrente-anuncios", empresaSelecionada, plataformaFiltro, busca],
    queryFn: async () => {
      let query = supabase
        .from("concorrente_anuncio")
        .select("*")
        .order("data_detectado", { ascending: false })
        .limit(100);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }
      if (plataformaFiltro !== "todas") {
        query = query.eq("plataforma", plataformaFiltro);
      }
      if (busca) {
        query = query.or(`titulo.ilike.%${busca}%,texto_corpo.ilike.%${busca}%,concorrente_nome.ilike.%${busca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch trends
  const { data: tendencias, isLoading: loadingTendencias } = useQuery({
    queryKey: ["tendencias-mercado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tendencia_mercado")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch competitor configs
  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["concorrente-configs", empresaSelecionada],
    queryFn: async () => {
      let query = supabase.from("concorrente_config").select("*").order("nome_concorrente");
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation: run competitor monitoring
  const monitorarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("monitorar-concorrentes-apify", {
        body: {
          id_empresa: empresaSelecionada !== "todas" ? empresaSelecionada : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Coleta concluída",
        description: `${data.collected} anúncios coletados`,
      });
      queryClient.invalidateQueries({ queryKey: ["concorrente-anuncios"] });
    },
    onError: (error) => {
      toast({
        title: "Erro na coleta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation: collect trends
  const tendenciasMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("coletar-tendencias-cripto");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Tendências coletadas",
        description: `${data.collected} artigos coletados`,
      });
      queryClient.invalidateQueries({ queryKey: ["tendencias-mercado"] });
    },
    onError: (error) => {
      toast({
        title: "Erro na coleta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Stats
  const concorrentesUnicos = new Set(anuncios?.map((a) => a.concorrente_nome)).size;
  const totalAnuncios = anuncios?.length || 0;
  const anunciosAtivos = anuncios?.filter((a) => a.status === "ATIVO").length || 0;

  const plataformaBadgeColor = (p: string) => {
    switch (p) {
      case "META": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "GOOGLE": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "LINKEDIN": return "bg-sky-500/10 text-sky-500 border-sky-500/20";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Análise Competitiva</h1>
          <p className="text-muted-foreground">
            Monitore anúncios de concorrentes e tendências do mercado
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => monitorarMutation.mutate()}
            disabled={monitorarMutation.isPending}
          >
            {monitorarMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Coletar Anúncios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => tendenciasMutation.mutate()}
            disabled={tendenciasMutation.isPending}
          >
            {tendenciasMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Coletar Tendências
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Concorrentes</p>
            <p className="text-2xl font-bold">{concorrentesUnicos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Anúncios</p>
            <p className="text-2xl font-bold">{totalAnuncios}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-green-500">{anunciosAtivos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Tendências</p>
            <p className="text-2xl font-bold">{tendencias?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList>
          <TabsTrigger value="anuncios">
            <Eye className="mr-2 h-4 w-4" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="tendencias">
            <TrendingUp className="mr-2 h-4 w-4" />
            Tendências
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        {/* Tab: Anúncios de Concorrentes */}
        <TabsContent value="anuncios" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por concorrente, título ou texto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={plataformaFiltro} onValueChange={setPlataformaFiltro}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="META">Meta</SelectItem>
                <SelectItem value="GOOGLE">Google</SelectItem>
                <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingAnuncios ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : anuncios && anuncios.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {anuncios.map((ad) => (
                <Card key={ad.id} className="overflow-hidden">
                  {ad.url_midia && (
                    <div className="aspect-video bg-muted overflow-hidden">
                      <img
                        src={ad.url_midia}
                        alt={ad.titulo || "Ad"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{ad.concorrente_nome}</span>
                      <div className="flex gap-1">
                        <Badge variant="outline" className={plataformaBadgeColor(ad.plataforma)}>
                          {ad.plataforma}
                        </Badge>
                        <Badge variant={ad.status === "ATIVO" ? "default" : "secondary"}>
                          {ad.status}
                        </Badge>
                      </div>
                    </div>
                    {ad.titulo && (
                      <p className="font-medium text-sm line-clamp-2">{ad.titulo}</p>
                    )}
                    {ad.texto_corpo && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{ad.texto_corpo}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>
                        {ad.data_detectado &&
                          format(new Date(ad.data_detectado), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {ad.url_destino && (
                        <a
                          href={ad.url_destino}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver destino
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum anúncio coletado ainda</p>
                <p className="text-sm mt-1">
                  Configure os concorrentes e clique em "Coletar Anúncios"
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Tendências */}
        <TabsContent value="tendencias" className="space-y-4">
          {loadingTendencias ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : tendencias && tendencias.length > 0 ? (
            <div className="space-y-3">
              {tendencias.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {t.fonte}
                          </Badge>
                          {t.categorias?.map((cat: string) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {t.relevancia_score > 2 && (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                              🔥 Relevante
                            </Badge>
                          )}
                        </div>
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline text-sm block"
                        >
                          {t.titulo}
                        </a>
                        {t.resumo && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{t.resumo}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {t.data_publicacao &&
                            format(new Date(t.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}
                          {t.empresas_relacionadas?.length > 0 && (
                            <span>• {t.empresas_relacionadas.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhuma tendência coletada</p>
                <p className="text-sm mt-1">Clique em "Coletar Tendências" para começar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Configuração */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Concorrentes Configurados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConfigs ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : configs && configs.length > 0 ? (
                <div className="space-y-3">
                  {configs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{c.nome_concorrente}</p>
                        <div className="flex gap-2 mt-1">
                          {c.facebook_page_name && (
                            <Badge variant="outline" className="text-xs">
                              Meta: {c.facebook_page_name}
                            </Badge>
                          )}
                          {c.linkedin_page_url && (
                            <Badge variant="outline" className="text-xs">LinkedIn</Badge>
                          )}
                          {c.google_advertiser_id && (
                            <Badge variant="outline" className="text-xs">Google</Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Nenhum concorrente configurado. Adicione via banco de dados na tabela{" "}
                    <code className="bg-muted px-1 rounded">concorrente_config</code>.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
