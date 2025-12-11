import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Sparkles, 
  ExternalLink,
  Eye,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Users,
  Zap,
  Settings2,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { MetricaComInfo } from "@/components/ui/MetricaComInfo";
import { Skeleton } from "@/components/ui/skeleton";
import { LandingPageConfigManager } from "./LandingPageConfigManager";

interface LandingPageAnalyticsProps {
  idEmpresa: string;
}

interface PageConfig {
  url_pattern: string;
  categoria: string;
  ignorar_conversao: boolean;
}

interface MetricaAgregada {
  url: string;
  sessoes: number;
  conversoes: number;
  taxa_conversao: number;
  bounce_rate: number | null;
  tempo_medio: number | null;
}

interface Insight {
  categoria: string;
  descoberta: string;
  impacto: string;
}

interface Recomendacao {
  pagina: string;
  acao: string;
  prioridade: string;
}

interface PadraoSucesso {
  elemento: string;
  padrao: string;
  exemplos?: string[];
}

export function LandingPageAnalytics({ idEmpresa }: LandingPageAnalyticsProps) {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [showConfig, setShowConfig] = useState(false);

  // Buscar configurações de páginas
  const { data: pageConfigs } = useQuery({
    queryKey: ['landingpage-config', idEmpresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landingpage_config')
        .select('url_pattern, categoria, ignorar_conversao')
        .eq('id_empresa', idEmpresa);
      if (error) throw error;
      return data as PageConfig[];
    },
    enabled: !!idEmpresa
  });

  // Função para verificar se URL corresponde ao padrão (suporta *)
  const urlMatchesPattern = (url: string, pattern: string): boolean => {
    const escapedPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(url);
  };

  // Função para obter categoria de uma URL
  const getCategoriaUrl = (url: string): { categoria: string; ignorar: boolean } => {
    if (!pageConfigs) return { categoria: 'landing_page', ignorar: false };
    
    for (const config of pageConfigs) {
      if (urlMatchesPattern(url, config.url_pattern)) {
        return { categoria: config.categoria, ignorar: config.ignorar_conversao };
      }
    }
    return { categoria: 'landing_page', ignorar: false };
  };

  // Buscar métricas agregadas
  const { data: metricas, isLoading: loadingMetricas } = useQuery({
    queryKey: ['lp-metricas', idEmpresa],
    queryFn: async () => {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);

      const { data, error } = await supabase
        .from('landingpage_metricas')
        .select('*')
        .eq('id_empresa', idEmpresa)
        .gte('data', dataInicio.toISOString().split('T')[0]);

      if (error) throw error;

      // Agregar por URL
      const agregado = new Map<string, MetricaAgregada>();
      for (const m of data || []) {
        const existing = agregado.get(m.url) || {
          url: m.url,
          sessoes: 0,
          conversoes: 0,
          taxa_conversao: 0,
          bounce_rate: null,
          tempo_medio: null
        };
        existing.sessoes += m.sessoes || 0;
        existing.conversoes += m.conversoes || 0;
        agregado.set(m.url, existing);
      }

      // Calcular taxas
      const resultado = Array.from(agregado.values()).map(m => ({
        ...m,
        taxa_conversao: m.sessoes > 0 ? (m.conversoes / m.sessoes) * 100 : 0
      }));

      return resultado.sort((a, b) => b.sessoes - a.sessoes);
    },
    enabled: !!idEmpresa
  });

  // Filtrar métricas baseado na categoria e ignorar
  const metricasFiltradas = metricas?.filter(m => {
    const { categoria, ignorar } = getCategoriaUrl(m.url);
    if (ignorar) return false; // Sempre exclui páginas ignoradas
    if (filtroCategoria === "todas") return true;
    return categoria === filtroCategoria;
  }) || [];

  // Buscar conteúdo extraído
  const { data: conteudos } = useQuery({
    queryKey: ['lp-conteudo', idEmpresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landingpage_conteudo')
        .select('*')
        .eq('id_empresa', idEmpresa);

      if (error) throw error;
      return data;
    },
    enabled: !!idEmpresa
  });

  // Buscar última análise
  const { data: ultimaAnalise, isLoading: loadingAnalise } = useQuery({
    queryKey: ['lp-analise', idEmpresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landingpage_analise')
        .select('*')
        .eq('id_empresa', idEmpresa)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!idEmpresa
  });

  // Buscar estatísticas de leads enriquecidos com GA4
  const { data: statsLeadsGA4 } = useQuery({
    queryKey: ['leads-ga4-stats', idEmpresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead')
        .select('id_lead, ga4_categoria_jornada, ga4_engajamento_score')
        .eq('id_empresa', idEmpresa);

      if (error) throw error;

      const total = data?.length || 0;
      const comEnriquecimento = data?.filter(l => l.ga4_categoria_jornada).length || 0;
      const semEnriquecimento = total - comEnriquecimento;
      
      // Contagem por categoria
      const categorias: Record<string, number> = {};
      data?.forEach(l => {
        if (l.ga4_categoria_jornada) {
          categorias[l.ga4_categoria_jornada] = (categorias[l.ga4_categoria_jornada] || 0) + 1;
        }
      });

      // Score médio
      const scoresValidos = data?.filter(l => l.ga4_engajamento_score !== null).map(l => l.ga4_engajamento_score as number) || [];
      const scoreMedio = scoresValidos.length > 0 
        ? scoresValidos.reduce((s, v) => s + v, 0) / scoresValidos.length 
        : 0;

      return {
        total,
        comEnriquecimento,
        semEnriquecimento,
        categorias,
        scoreMedio
      };
    },
    enabled: !!idEmpresa
  });

  // Mutação para coletar métricas GA4
  const coletarMetricasMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('coletar-metricas-ga4', {
        body: { id_empresa: idEmpresa }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Métricas GA4 coletadas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['lp-metricas', idEmpresa] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao coletar métricas');
    }
  });

  // Mutação para extrair conteúdo
  const extrairConteudoMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('extrair-conteudo-lp', {
        body: { id_empresa: idEmpresa }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Conteúdo extraído de ${data.processadas} páginas`);
      queryClient.invalidateQueries({ queryKey: ['lp-conteudo', idEmpresa] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao extrair conteúdo');
    }
  });

  // Mutação para analisar com IA
  const analisarMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const { data, error } = await supabase.functions.invoke('analisar-performance-lp', {
        body: { id_empresa: idEmpresa }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Análise IA concluída!');
      queryClient.invalidateQueries({ queryKey: ['lp-analise', idEmpresa] });
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro na análise');
      setIsAnalyzing(false);
    }
  });

  // Mutação para enriquecer leads com GA4
  const enriquecerLeadsGA4Mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('enriquecer-leads-ga4', {
        body: { id_empresa: idEmpresa }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.enriquecidos} leads enriquecidos com dados GA4`);
      queryClient.invalidateQueries({ queryKey: ['leads-ga4-stats', idEmpresa] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enriquecer leads');
    }
  });

  // Mapeamento de domínios por empresa
  const getDomainByEmpresa = (empresaId: string): string => {
    const domains: Record<string, string> = {
      '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db': 'https://blueconsult.com.br', // Blue
      '61b5ffeb-fbbc-47c1-8ced-152bb647ed20': 'https://tokeniza.com.br', // Tokeniza
    };
    return domains[empresaId] || '';
  };

  const getFullUrl = (url: string): string => {
    // Se já é URL completa, retorna
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Caso contrário, adiciona o domínio da empresa
    const domain = getDomainByEmpresa(idEmpresa);
    if (domain) {
      return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname || url;
    } catch {
      // Se não é URL completa, já é o path
      return url;
    }
  };

  const getConteudo = (url: string) => {
    return conteudos?.find(c => c.url === url);
  };

  // Badge de categoria para exibição
  const getCategoriaBadge = (url: string) => {
    const { categoria } = getCategoriaUrl(url);
    const configs: Record<string, { label: string; className: string }> = {
      landing_page: { label: "LP", className: "bg-green-500 text-white" },
      oferta: { label: "Oferta", className: "bg-blue-500 text-white" },
      sistema: { label: "Sistema", className: "bg-gray-500 text-white" },
      conteudo: { label: "Conteúdo", className: "bg-purple-500 text-white" },
    };
    return configs[categoria] || configs.landing_page;
  };

  const topPerformers = metricasFiltradas.filter(m => m.sessoes >= 10).sort((a, b) => b.taxa_conversao - a.taxa_conversao).slice(0, 5);
  const bottomPerformers = metricasFiltradas.filter(m => m.sessoes >= 10).sort((a, b) => a.taxa_conversao - b.taxa_conversao).slice(0, 5);

  const totalSessoes = metricasFiltradas.reduce((s, m) => s + m.sessoes, 0);
  const totalConversoes = metricasFiltradas.reduce((s, m) => s + m.conversoes, 0);
  const taxaGeralConversao = totalSessoes > 0 ? (totalConversoes / totalSessoes) * 100 : 0;
  
  // Contagem por categoria (antes de filtrar)
  const contagemCategorias = metricas?.reduce((acc, m) => {
    const { categoria, ignorar } = getCategoriaUrl(m.url);
    if (!ignorar) {
      acc[categoria] = (acc[categoria] || 0) + 1;
    } else {
      acc.ignoradas = (acc.ignoradas || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  if (loadingMetricas) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Análise de Landing Pages
            </CardTitle>
            <CardDescription>
              Performance e otimização de copy baseada em dados GA4
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={showConfig ? "default" : "outline"}
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => coletarMetricasMutation.mutate()}
              disabled={coletarMetricasMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${coletarMetricasMutation.isPending ? 'animate-spin' : ''}`} />
              {coletarMetricasMutation.isPending ? 'Coletando...' : 'Atualizar GA4'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => extrairConteudoMutation.mutate()}
              disabled={extrairConteudoMutation.isPending}
            >
              <Eye className={`h-4 w-4 mr-2 ${extrairConteudoMutation.isPending ? 'animate-spin' : ''}`} />
              {extrairConteudoMutation.isPending ? 'Extraindo...' : 'Extrair Copy'}
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => enriquecerLeadsGA4Mutation.mutate()}
              disabled={enriquecerLeadsGA4Mutation.isPending || !metricas?.length}
            >
              <Users className={`h-4 w-4 mr-2 ${enriquecerLeadsGA4Mutation.isPending ? 'animate-spin' : ''}`} />
              {enriquecerLeadsGA4Mutation.isPending ? 'Enriquecendo...' : 'Enriquecer Leads'}
            </Button>
            <Button 
              size="sm"
              onClick={() => analisarMutation.mutate()}
              disabled={isAnalyzing || !metricas?.length}
            >
              <Sparkles className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Analisando...' : 'Analisar com IA'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Painel de Configuração */}
        {showConfig && (
          <div className="mb-6">
            <LandingPageConfigManager idEmpresa={idEmpresa} />
          </div>
        )}

        {/* Filtro de Categoria */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({metricasFiltradas.length})</SelectItem>
                <SelectItem value="landing_page">Landing Pages ({contagemCategorias.landing_page || 0})</SelectItem>
                <SelectItem value="oferta">Ofertas ({contagemCategorias.oferta || 0})</SelectItem>
                <SelectItem value="conteudo">Conteúdo ({contagemCategorias.conteudo || 0})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contagemCategorias.ignoradas > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              {contagemCategorias.ignoradas} páginas de sistema ignoradas
            </Badge>
          )}
        </div>

        {/* KPIs Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Páginas Analisadas</div>
            <div className="text-2xl font-bold">{metricasFiltradas.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Sessões (30d)</div>
            <div className="text-2xl font-bold">{totalSessoes.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Conversões (30d)</div>
            <div className="text-2xl font-bold">{totalConversoes.toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <MetricaComInfo 
              label="Taxa Conversão" 
              info="Conversões dividido por sessões nos últimos 30 dias"
              className="text-sm text-muted-foreground"
            />
            <div className="text-2xl font-bold">{taxaGeralConversao.toFixed(2)}%</div>
          </Card>
          <Card className="p-4">
            <MetricaComInfo 
              label="Leads Enriquecidos" 
              info="Leads com categoria de jornada e score de engajamento GA4"
              className="text-sm text-muted-foreground"
            />
            <div className="text-2xl font-bold flex items-center gap-2">
              {statsLeadsGA4?.comEnriquecimento || 0}
              {statsLeadsGA4?.semEnriquecimento > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{statsLeadsGA4.semEnriquecimento} pendentes
                </Badge>
              )}
            </div>
          </Card>
          <Card className="p-4">
            <MetricaComInfo 
              label="Score Médio" 
              info="Score de engajamento médio dos leads (0-100)"
              className="text-sm text-muted-foreground"
            />
            <div className="text-2xl font-bold flex items-center gap-2">
              {statsLeadsGA4?.scoreMedio.toFixed(0) || 0}
              <Zap className={`h-4 w-4 ${(statsLeadsGA4?.scoreMedio || 0) >= 70 ? 'text-green-500' : (statsLeadsGA4?.scoreMedio || 0) >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="ranking">
          <TabsList>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="insights">
              Insights IA
              {ultimaAnalise && <Badge variant="secondary" className="ml-2">Novo</Badge>}
            </TabsTrigger>
            <TabsTrigger value="recomendacoes">Recomendações</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Performers */}
              <div>
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Top 5 - Maior Conversão
                </h3>
                <div className="space-y-2">
                  {topPerformers.map((lp, idx) => {
                    const conteudo = getConteudo(lp.url);
                    const catBadge = getCategoriaBadge(lp.url);
                    return (
                      <Card key={lp.url} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{idx + 1}º</Badge>
                              <Badge className={`${catBadge.className} text-xs`}>{catBadge.label}</Badge>
                              <a 
                                href={getFullUrl(lp.url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline truncate flex items-center gap-1"
                              >
                                {formatUrl(lp.url)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            {conteudo?.titulo_h1 && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                H1: {conteudo.titulo_h1}
                              </p>
                            )}
                          </div>
                          <Badge className="bg-green-100 text-green-800 ml-2">
                            {lp.taxa_conversao.toFixed(2)}%
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{lp.sessoes.toLocaleString()} sessões</span>
                          <span>{lp.conversoes} conversões</span>
                        </div>
                      </Card>
                    );
                  })}
                  {topPerformers.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem dados suficientes (mín. 10 sessões)</p>
                  )}
                </div>
              </div>

              {/* Bottom Performers */}
              <div>
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Bottom 5 - Menor Conversão
                </h3>
                <div className="space-y-2">
                  {bottomPerformers.map((lp, idx) => {
                    const conteudo = getConteudo(lp.url);
                    const catBadge = getCategoriaBadge(lp.url);
                    return (
                      <Card key={lp.url} className="p-3 border-destructive/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">{idx + 1}º</Badge>
                              <Badge className={`${catBadge.className} text-xs`}>{catBadge.label}</Badge>
                              <a 
                                href={getFullUrl(lp.url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline truncate flex items-center gap-1"
                              >
                                {formatUrl(lp.url)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            {conteudo?.titulo_h1 && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                H1: {conteudo.titulo_h1}
                              </p>
                            )}
                          </div>
                          <Badge variant="destructive" className="ml-2">
                            {lp.taxa_conversao.toFixed(2)}%
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{lp.sessoes.toLocaleString()} sessões</span>
                          <span>{lp.conversoes} conversões</span>
                        </div>
                      </Card>
                    );
                  })}
                  {bottomPerformers.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem dados suficientes (mín. 10 sessões)</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tabela completa */}
            {metricasFiltradas.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium mb-3">Todas as Páginas</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>URL</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>H1</TableHead>
                        <TableHead className="text-right">Sessões</TableHead>
                        <TableHead className="text-right">Conversões</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metricasFiltradas.slice(0, 20).map(lp => {
                        const conteudo = getConteudo(lp.url);
                        const catBadge = getCategoriaBadge(lp.url);
                        return (
                          <TableRow key={lp.url}>
                            <TableCell className="max-w-[200px] truncate">
                              <a 
                                href={getFullUrl(lp.url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {formatUrl(lp.url)}
                              </a>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${catBadge.className} text-xs`}>{catBadge.label}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate text-muted-foreground">
                              {conteudo?.titulo_h1 || '-'}
                            </TableCell>
                            <TableCell className="text-right">{lp.sessoes.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{lp.conversoes}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={lp.taxa_conversao >= taxaGeralConversao ? 'default' : 'secondary'}>
                                {lp.taxa_conversao.toFixed(2)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            {loadingAnalise ? (
              <Skeleton className="h-40 w-full" />
            ) : ultimaAnalise ? (
              <div className="space-y-6">
                {/* Análise Geral */}
                {ultimaAnalise.analise_texto && (
                  <Card className="p-4 bg-muted/30">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Resumo da Análise
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {ultimaAnalise.analise_texto}
                    </p>
                  </Card>
                )}

                {/* Insights */}
                {Array.isArray(ultimaAnalise.insights) && ultimaAnalise.insights.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Insights Identificados
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {(ultimaAnalise.insights as unknown as Insight[]).map((insight, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-start gap-2">
                            <Badge variant={
                              insight.impacto === 'alto' ? 'default' : 
                              insight.impacto === 'medio' ? 'secondary' : 'outline'
                            }>
                              {insight.impacto}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">{insight.categoria}</p>
                              <p className="text-sm text-muted-foreground">{insight.descoberta}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Padrões de Sucesso */}
                {Array.isArray(ultimaAnalise.padroes_identificados) && ultimaAnalise.padroes_identificados.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Padrões de Sucesso
                    </h3>
                    <div className="space-y-3">
                      {(ultimaAnalise.padroes_identificados as unknown as PadraoSucesso[]).map((padrao, idx) => (
                        <Card key={idx} className="p-3 border-green-200 bg-green-50/30">
                          <p className="text-sm font-medium">{padrao.elemento}</p>
                          <p className="text-sm text-muted-foreground">{padrao.padrao}</p>
                          {padrao.exemplos && padrao.exemplos.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {padrao.exemplos.map((ex, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{ex}</Badge>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Análise realizada em: {new Date(ultimaAnalise.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma análise IA realizada ainda
                </p>
                <Button onClick={() => analisarMutation.mutate()} disabled={!metricas?.length}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Análise IA
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recomendacoes" className="mt-4">
            {ultimaAnalise && Array.isArray(ultimaAnalise.recomendacoes) && ultimaAnalise.recomendacoes.length > 0 ? (
              <div className="space-y-3">
                {(ultimaAnalise.recomendacoes as unknown as Recomendacao[]).map((rec, idx) => (
                  <Card key={idx} className={`p-4 ${
                    rec.prioridade === 'alta' ? 'border-red-200 bg-red-50/30' :
                    rec.prioridade === 'media' ? 'border-yellow-200 bg-yellow-50/30' :
                    'border-gray-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`h-5 w-5 mt-0.5 ${
                        rec.prioridade === 'alta' ? 'text-red-500' :
                        rec.prioridade === 'media' ? 'text-yellow-500' :
                        'text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            rec.prioridade === 'alta' ? 'destructive' :
                            rec.prioridade === 'media' ? 'default' : 'secondary'
                          }>
                            Prioridade {rec.prioridade}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{rec.pagina}</span>
                        </div>
                        <p className="text-sm">{rec.acao}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Execute a análise IA para receber recomendações personalizadas
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
