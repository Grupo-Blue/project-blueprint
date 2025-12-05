import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  TrendingUp, 
  Target, 
  Users, 
  MousePointer,
  DollarSign,
  Zap,
  ArrowRight,
  Eye,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Image,
  Video,
  Grid3x3,
  FileQuestion,
  Copy,
  ExternalLink,
  RefreshCw,
  Download,
  GitBranch,
  AlertTriangle,
  Pencil,
  Link2,
  Link2Off
} from "lucide-react";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { CampanhaFluxoDiagram } from "@/components/CampanhaFluxoDiagram";
import { MetricasAwareness } from "@/components/dashboard/MetricasAwareness";

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
  qtd_criativos?: number;
  plataforma?: string;
  url_esperada?: string | null;
}

interface Criativo {
  id_criativo: string;
  id_criativo_externo: string;
  tipo: string;
  descricao: string | null;
  ativo: boolean;
  url_midia: string | null;
  url_final: string | null;
  url_esperada: string | null;
  url_preview: string | null;
  leads?: number;
  cliques?: number;
  impressoes?: number;
  verba_investida?: number;
  cpl?: number | null;
  ctr?: number | null;
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

// Componente para renderizar criativos de uma campanha
function CriativosQuery({ campanhaId, plataforma, urlEsperadaCampanha }: { campanhaId: string; plataforma: string; urlEsperadaCampanha?: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [criativoEditando, setCriativoEditando] = useState<Criativo | null>(null);
  const [urlEsperadaInput, setUrlEsperadaInput] = useState("");
  const [salvando, setSalvando] = useState(false);
  
  const { data: criativos, isLoading } = useQuery({
    queryKey: ["criativos-campanha", campanhaId],
    queryFn: async () => {
      const { data: criativos, error: criativosError } = await supabase
        .from("criativo")
        .select("*")
        .eq("id_campanha", campanhaId);

      if (criativosError) throw criativosError;

      // Buscar métricas dos criativos
      const criativosComMetricas = await Promise.all(
        (criativos || []).map(async (criativo) => {
          // Buscar leads do criativo
          const { count: leadsCount } = await supabase
            .from("lead")
            .select("id_lead", { count: "exact", head: true })
            .eq("id_criativo", criativo.id_criativo);

          // Buscar métricas diárias do criativo
          const { data: metricas } = await supabase
            .from("criativo_metricas_dia")
            .select("cliques, impressoes, verba_investida")
            .eq("id_criativo", criativo.id_criativo);

          const totaisMetricas = (metricas || []).reduce(
            (acc, m) => ({
              cliques: acc.cliques + (m.cliques || 0),
              impressoes: acc.impressoes + (m.impressoes || 0),
              verba_investida: acc.verba_investida + (m.verba_investida || 0),
            }),
            { cliques: 0, impressoes: 0, verba_investida: 0 }
          );

          const cpl = (leadsCount || 0) > 0 ? totaisMetricas.verba_investida / (leadsCount || 0) : null;
          const ctr = totaisMetricas.impressoes > 0 ? (totaisMetricas.cliques / totaisMetricas.impressoes) * 100 : null;

          return {
            ...criativo,
            leads: leadsCount || 0,
            cpl,
            ctr,
            ...totaisMetricas,
          };
        })
      );

      return criativosComMetricas as Criativo[];
    },
  });

  const handleCopyId = (idExterno: string) => {
    navigator.clipboard.writeText(idExterno);
    toast({
      title: "ID copiado!",
      description: "Use este ID no parâmetro utm_content dos seus anúncios",
    });
  };

  const handleAbrirModal = (criativo: Criativo) => {
    setCriativoEditando(criativo);
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
        title: "URL salva!",
        description: urlEsperadaInput.trim() 
          ? "URL específica do criativo configurada"
          : "Criativo voltará a herdar URL da campanha",
      });

      queryClient.invalidateQueries({ queryKey: ["criativos-campanha", campanhaId] });
      setModalOpen(false);
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

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!criativos || criativos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum criativo cadastrado
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {criativos.map((criativo) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyId(criativo.id_criativo_externo)}
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
            
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="font-medium">{criativo.leads || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="font-medium">{criativo.cliques || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Verba</p>
                <p className="font-medium">
                  R$ {(criativo.verba_investida || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">CPL</p>
                <p className="font-medium">
                  {criativo.cpl ? `R$ ${criativo.cpl.toFixed(2)}` : "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="font-medium">
                  {criativo.ctr ? `${criativo.ctr.toFixed(2)}%` : "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Badge variant={criativo.ativo ? "secondary" : "outline"}>
                {criativo.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbrirModal(criativo)}
                      className="h-8 w-8 p-0"
                    >
                      {criativo.url_esperada ? (
                        <Pencil className="h-4 w-4 text-blue-600" />
                      ) : urlEsperadaCampanha ? (
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Link2Off className="h-4 w-4 text-amber-600" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {criativo.url_esperada 
                      ? "URL própria configurada" 
                      : urlEsperadaCampanha 
                        ? "Herdando URL da campanha" 
                        : "Sem URL configurada"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {criativo.url_midia && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Ver mídia"
                    >
                      <Image className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" side="left">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-center">Prévia da mídia (pode não carregar)</p>
                      <div className="relative bg-muted rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                        <img 
                          src={criativo.url_midia} 
                          alt="Prévia do criativo"
                          className="max-w-full max-h-[300px] object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="hidden flex-col items-center justify-center gap-2 p-4 text-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Imagem bloqueada pelo Facebook</p>
                          <p className="text-xs text-muted-foreground">Use "Ver no Facebook" para visualizar</p>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {criativo.url_preview && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(criativo.url_preview!, '_blank')}
                        className="gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver no Facebook
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Abre o criativo no Facebook (pode requerer login)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        ))}
      </div>

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
                {urlEsperadaCampanha ? (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm font-mono break-all">
                      {urlEsperadaCampanha}
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
                ) : urlEsperadaCampanha ? (
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
    </>
  );
}

export default function DashboardTrafego() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<string>("verba_desc");
  const [filtroStatusCampanha, setFiltroStatusCampanha] = useState<string>("ativas");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [syncingCreatives, setSyncingCreatives] = useState(false);
  const [campanhaFluxoOpen, setCampanhaFluxoOpen] = useState(false);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<{ id: string; nome: string } | null>(null);
  const { getDataReferencia, tipoFiltro } = usePeriodo();

  // Usar data do filtro selecionado
  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  // Query para distribuição de MQLs por critério
  const { data: mqlDistribuicao } = useQuery({
    queryKey: ["mql-distribuicao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("lead")
        .select("mautic_score, mautic_page_hits, is_mql, id_empresa");

      if (empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mqls = data?.filter(l => l.is_mql) || [];
      
      return {
        total: mqls.length,
        porScore: mqls.filter(l => (l.mautic_score || 0) >= 50).length,
        porPageHits: mqls.filter(l => (l.mautic_page_hits || 0) >= 10).length,
        porAmbos: mqls.filter(l => (l.mautic_score || 0) >= 50 && (l.mautic_page_hits || 0) >= 10).length,
      };
    },
  });

  const { data: campanhasMetricas, isLoading, refetch: refetchCampanhas } = useQuery({
    queryKey: ["campanhas-metricas", tipoFiltro, inicioMes.toISOString(), fimMes.toISOString(), empresaSelecionada, filtroStatusCampanha],
    queryFn: async () => {
      // Buscar métricas diárias de campanhas no período
      const { data: metricasDia, error: metricasError } = await supabase
        .from("campanha_metricas_dia")
        .select(`
          id_campanha,
          leads,
          verba_investida,
          cliques,
          impressoes,
          data
        `)
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"));
      
      if (metricasError) throw metricasError;
      if (!metricasDia || metricasDia.length === 0) return [];

      // Buscar dados das campanhas
      const campanhaIds = [...new Set(metricasDia.map(m => m.id_campanha))];
      const { data: campanhas, error: campanhasError } = await supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          ativa,
          url_esperada,
          conta_anuncio:id_conta (id_empresa, plataforma)
        `)
        .in("id_campanha", campanhaIds);
      
      if (campanhasError) throw campanhasError;

      // Criar mapa de campanhas
      const campanhaMap = new Map(campanhas?.map(c => [c.id_campanha, c]) || []);

      // Filtrar por empresa
      let filteredCampanhaIds = campanhaIds;
      if (empresaSelecionada !== "todas") {
        filteredCampanhaIds = campanhaIds.filter(id => {
          const camp = campanhaMap.get(id);
          return (camp as any)?.conta_anuncio?.id_empresa === empresaSelecionada;
        });
      }

      // Filtrar por status da campanha
      if (filtroStatusCampanha !== "todas") {
        const statusFiltro = filtroStatusCampanha === "ativas";
        filteredCampanhaIds = filteredCampanhaIds.filter(id => {
          const camp = campanhaMap.get(id);
          return camp?.ativa === statusFiltro;
        });
      }

      // Agregar métricas por campanha
      const metricasAgregadas: Record<string, any> = {};
      metricasDia.filter(m => filteredCampanhaIds.includes(m.id_campanha)).forEach(m => {
        if (!metricasAgregadas[m.id_campanha]) {
          const camp = campanhaMap.get(m.id_campanha);
          metricasAgregadas[m.id_campanha] = {
            id_campanha: m.id_campanha,
            nome: camp?.nome || "Campanha sem nome",
            plataforma: (camp as any)?.conta_anuncio?.plataforma || "OUTRO",
            url_esperada: camp?.url_esperada || null,
            leads: 0,
            verba_investida: 0,
            reunioes: 0,
            mqls: 0,
            levantadas: 0,
            vendas: 0,
            ticket_medio: 0,
            cac: 0,
          };
        }
        metricasAgregadas[m.id_campanha].leads += m.leads || 0;
        metricasAgregadas[m.id_campanha].verba_investida += Number(m.verba_investida || 0);
      });

      // Buscar quantidade de criativos para cada campanha
      const campanhasAgregadas = Object.values(metricasAgregadas);
      const campanhasComCriativos = await Promise.all(
        campanhasAgregadas.map(async (m: any) => {
          const { count } = await supabase
            .from("criativo")
            .select("id_criativo", { count: "exact", head: true })
            .eq("id_campanha", m.id_campanha)
            .eq("ativo", true);

          return {
            ...m,
            cpl: m.leads > 0 ? m.verba_investida / m.leads : null,
            cac: m.vendas > 0 ? m.verba_investida / m.vendas : null,
            ticket_medio: m.vendas > 0 ? (m.verba_investida * 3) / m.vendas : 0,
            qtd_criativos: count || 0,
          };
        })
      );

      return campanhasComCriativos as CampanhaMetrica[];
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Buscar totais gerais da empresa da tabela empresa_metricas_dia
  const { data: totaisGerais } = useQuery({
    queryKey: [
      "totais-gerais-empresa",
      empresaSelecionada,
      tipoFiltro,
      format(inicioMes, "yyyy-MM-dd"),
      format(fimMes, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      let query = supabase
        .from("empresa_metricas_dia")
        .select("*")
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"));

      if (empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data: metricasDiarias, error } = await query;
      if (error) throw error;

      // Agregar todas as métricas diárias
      const totais = (metricasDiarias || []).reduce((acc, m) => ({
        verba: acc.verba + Number(m.verba_investida || 0),
        leads: acc.leads + (m.leads_total || 0),
        mqls: acc.mqls + (m.mqls || 0),
        levantadas: acc.levantadas + (m.levantadas || 0),
        reunioes: acc.reunioes + (m.reunioes || 0),
        vendas: acc.vendas + (m.vendas || 0),
      }), { verba: 0, leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 });

      return totais;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Query para CPL Orgânico (investimento awareness vs leads de redes sociais)
  const { data: cplOrganicoData } = useQuery({
    queryKey: [
      "cpl-organico",
      empresaSelecionada,
      inicioMes.toISOString(),
      fimMes.toISOString(),
    ],
    queryFn: async () => {
      // Buscar contas da empresa (ou todas)
      let contasQuery = supabase.from("conta_anuncio").select("id_conta, id_empresa");
      if (empresaSelecionada !== "todas") {
        contasQuery = contasQuery.eq("id_empresa", empresaSelecionada);
      }

      const { data: contas } = await contasQuery;
      if (!contas || contas.length === 0) return { investimento: 0, leads: 0, breakdown: { instagram: 0, facebook: 0, linkedin: 0, tiktok: 0, youtube: 0, twitter: 0 } };

      // Buscar campanhas de awareness
      const { data: campanhas } = await supabase
        .from("campanha")
        .select("id_campanha, objetivo")
        .in("id_conta", contas.map(c => c.id_conta))
        .in("objetivo", ["REACH", "AWARENESS", "ENGAGEMENT", "POST_ENGAGEMENT", "VIDEO_VIEWS", "BRAND_AWARENESS"]);

      let investimentoAwareness = 0;
      if (campanhas && campanhas.length > 0) {
        const { data: metricas } = await supabase
          .from("campanha_metricas_dia")
          .select("verba_investida")
          .in("id_campanha", campanhas.map(c => c.id_campanha))
          .gte("data", format(inicioMes, "yyyy-MM-dd"))
          .lte("data", format(fimMes, "yyyy-MM-dd"));

        investimentoAwareness = metricas?.reduce((acc, m) => acc + Number(m.verba_investida || 0), 0) || 0;
      }

      // Buscar leads orgânicos de todas as redes sociais
      let leadsQuery = supabase
        .from("lead")
        .select("utm_source")
        .eq("lead_pago", false)
        .gte("data_criacao", inicioMes.toISOString())
        .lte("data_criacao", fimMes.toISOString());

      if (empresaSelecionada !== "todas") {
        leadsQuery = leadsQuery.eq("id_empresa", empresaSelecionada);
      }

      const { data: leads } = await leadsQuery;

      // Contar por rede social
      const breakdown = { instagram: 0, facebook: 0, linkedin: 0, tiktok: 0, youtube: 0, twitter: 0 };
      (leads || []).forEach((lead: any) => {
        const source = (lead.utm_source || '').toLowerCase();
        if (source.includes('instagram') || source.includes('linktree')) breakdown.instagram++;
        else if ((source.includes('facebook') || source.includes('fb')) && !source.includes('ads')) breakdown.facebook++;
        else if (source.includes('linkedin')) breakdown.linkedin++;
        else if (source.includes('tiktok')) breakdown.tiktok++;
        else if (source.includes('youtube')) breakdown.youtube++;
        else if (source.includes('twitter') || source.includes('x.com')) breakdown.twitter++;
      });

      const totalLeads = Object.values(breakdown).reduce((a, b) => a + b, 0);

      return { investimento: investimentoAwareness, leads: totalLeads, breakdown };
    },
  });

  const totais = totaisGerais || { verba: 0, leads: 0, mqls: 0, levantadas: 0, reunioes: 0, vendas: 0 };

  const taxaMQL = totais.leads > 0 ? (totais.mqls / totais.leads) * 100 : 0;
  const taxaLevantada = totais.mqls > 0 ? (totais.levantadas / totais.mqls) * 100 : 0;
  const taxaReuniao = totais.levantadas > 0 ? (totais.reunioes / totais.levantadas) * 100 : 0;
  const taxaVenda = totais.reunioes > 0 ? (totais.vendas / totais.reunioes) * 100 : 0;
  const eficienciaFunil = totais.leads > 0 ? (totais.vendas / totais.leads) * 100 : 0;

  // Determinar label do período
  const getLabelPeriodo = () => {
    switch (tipoFiltro) {
      case "mes_atual":
        return "Mês Atual";
      case "mes_anterior":
        return "Mês Anterior";
      case "data_especifica":
        return format(dataReferencia, "MMMM/yyyy", { locale: ptBR });
      default:
        return "Período";
    }
  };

  const labelPeriodo = getLabelPeriodo();

  const handleCopyId = (idExterno: string) => {
    navigator.clipboard.writeText(idExterno);
    toast({
      title: "ID copiado!",
      description: "Use este ID no parâmetro utm_content dos seus anúncios",
    });
  };

  const handleRefresh = async () => {
    window.location.reload();
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
        window.location.reload();
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

  const toggleCampaign = (campanhaId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campanhaId)) {
      newExpanded.delete(campanhaId);
    } else {
      newExpanded.add(campanhaId);
    }
    setExpandedCampaigns(newExpanded);
  };

  // Ordenar campanhas conforme o filtro selecionado
  const campanhasOrdenadas = campanhasMetricas?.slice().sort((a, b) => {
    switch (ordenacao) {
      case "verba_desc":
        return b.verba_investida - a.verba_investida;
      case "verba_asc":
        return a.verba_investida - b.verba_investida;
      case "leads_desc":
        return b.leads - a.leads;
      case "leads_asc":
        return a.leads - b.leads;
      case "cpl_desc":
        return (b.cpl || 0) - (a.cpl || 0);
      case "cpl_asc":
        return (a.cpl || 0) - (b.cpl || 0);
      case "criativos_desc":
        return (b.qtd_criativos || 0) - (a.qtd_criativos || 0);
      case "criativos_asc":
        return (a.qtd_criativos || 0) - (b.qtd_criativos || 0);
      case "nome_asc":
        return a.nome.localeCompare(b.nome);
      case "nome_desc":
        return b.nome.localeCompare(a.nome);
      default:
        return 0;
    }
  });

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Dashboard Tráfego</h1>
              <p className="text-muted-foreground mt-2">
                Análise detalhada de campanhas e funil - {labelPeriodo}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <FiltroPeriodo />
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["campanhas-metricas"] });
                  queryClient.invalidateQueries({ queryKey: ["totais-gerais-empresa"] });
                  queryClient.invalidateQueries({ queryKey: ["mql-distribuicao"] });
                  queryClient.invalidateQueries({ queryKey: ["cpl-organico"] });
                  refetchCampanhas();
                  toast({ title: "Dados atualizados!", description: "Cache limpo e dados recarregados" });
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs Topo */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Verba Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                R$ {totais.verba.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {mqlDistribuicao && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground mt-1 cursor-help">
                        {mqlDistribuicao.porScore} score • {mqlDistribuicao.porPageHits} engajamento
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">Critérios de MQL:</p>
                        <p>Score ≥ 50: {mqlDistribuicao.porScore} leads</p>
                        <p>Page Hits ≥ 10: {mqlDistribuicao.porPageHits} leads</p>
                        <p>Ambos: {mqlDistribuicao.porAmbos} leads</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Eficiência do Funil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{eficienciaFunil.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totais.vendas} / {totais.leads} leads
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Card CPL Orgânico */}
        {cplOrganicoData && (cplOrganicoData.investimento > 0 || cplOrganicoData.leads > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Custo por Lead Orgânico (Redes Sociais)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 border">
                  <p className="text-sm text-muted-foreground mb-1">Investimento Awareness</p>
                  <p className="text-2xl font-bold">
                    R$ {cplOrganicoData.investimento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Campanhas de alcance e engajamento
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border">
                  <p className="text-sm text-muted-foreground mb-1">Leads de Redes Sociais</p>
                  <p className="text-2xl font-bold">{cplOrganicoData.leads}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Orgânicos (não pagos)
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border">
                  <p className="text-sm text-muted-foreground mb-1">CPL Orgânico</p>
                  <p className="text-2xl font-bold">
                    {cplOrganicoData.leads > 0 
                      ? `R$ ${(cplOrganicoData.investimento / cplOrganicoData.leads).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "N/A"
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awareness ÷ Leads orgânicos
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground mb-2">Por Rede Social</p>
                  <div className="space-y-1 text-sm">
                    {cplOrganicoData.breakdown.instagram > 0 && (
                      <div className="flex justify-between">
                        <span>📱 Instagram</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.instagram}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.facebook > 0 && (
                      <div className="flex justify-between">
                        <span>📘 Facebook</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.facebook}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.linkedin > 0 && (
                      <div className="flex justify-between">
                        <span>💼 LinkedIn</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.linkedin}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.tiktok > 0 && (
                      <div className="flex justify-between">
                        <span>🎵 TikTok</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.tiktok}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.youtube > 0 && (
                      <div className="flex justify-between">
                        <span>📺 YouTube</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.youtube}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.twitter > 0 && (
                      <div className="flex justify-between">
                        <span>🐦 Twitter/X</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.twitter}</span>
                      </div>
                    )}
                    {cplOrganicoData.leads === 0 && (
                      <p className="text-muted-foreground text-xs">Nenhum lead de redes sociais</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas de Awareness (Instagram/Metricool) */}
        <MetricasAwareness 
          empresaId={empresaSelecionada === "todas" ? null : empresaSelecionada} 
          dataInicio={inicioMes} 
          dataFim={fimMes} 
        />

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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Performance por Campanha</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={syncingCreatives}>
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
                <Select value={filtroStatusCampanha} onValueChange={setFiltroStatusCampanha}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativas">Ativas</SelectItem>
                    <SelectItem value="inativas">Inativas</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">Ordenar por:</span>
                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verba_desc">Maior Verba</SelectItem>
                    <SelectItem value="verba_asc">Menor Verba</SelectItem>
                    <SelectItem value="leads_desc">Mais Leads</SelectItem>
                    <SelectItem value="leads_asc">Menos Leads</SelectItem>
                    <SelectItem value="cpl_desc">Maior CPL</SelectItem>
                    <SelectItem value="cpl_asc">Menor CPL</SelectItem>
                    <SelectItem value="criativos_desc">Mais Criativos</SelectItem>
                    <SelectItem value="criativos_asc">Menos Criativos</SelectItem>
                    <SelectItem value="nome_asc">Nome (A-Z)</SelectItem>
                    <SelectItem value="nome_desc">Nome (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campanhasOrdenadas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha encontrada
                </p>
              ) : (
                campanhasOrdenadas?.map((campanha) => (
                  <Collapsible
                    key={campanha.id_campanha}
                    open={expandedCampaigns.has(campanha.id_campanha)}
                    onOpenChange={() => toggleCampaign(campanha.id_campanha)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <div className="p-4 bg-card hover:bg-muted/50 transition-colors">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                  {expandedCampaigns.has(campanha.id_campanha) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <h3 className="font-semibold">{campanha.nome}</h3>
                              {campanha.qtd_criativos !== undefined && campanha.qtd_criativos < 2 && (
                                <Badge variant="destructive" className="ml-2">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Alerta
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCampanhaSelecionada({ id: campanha.id_campanha, nome: campanha.nome });
                                  setCampanhaFluxoOpen(true);
                                }}
                              >
                                <GitBranch className="h-4 w-4 mr-2" />
                                Ver Fluxo
                              </Button>
                              <Badge variant="outline">
                                CPL: R$ {campanha.cpl?.toFixed(2) || "N/A"}
                              </Badge>
                              {campanha.qtd_criativos !== undefined && (
                                <Badge 
                                  variant={campanha.qtd_criativos < 2 ? "destructive" : "secondary"}
                                >
                                  {campanha.qtd_criativos} criativo{campanha.qtd_criativos !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
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

                      <CollapsibleContent>
                        <div className="border-t bg-muted/20">
                          {campanha.qtd_criativos === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                              <p className="font-medium text-destructive">
                                ⚠️ Nenhum criativo ativo - campanha pode estar pausada ou sem material
                              </p>
                            </div>
                          ) : campanha.qtd_criativos === 1 ? (
                            <div className="p-4">
                              <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                  ⚠️ Apenas 1 criativo ativo - recomenda-se ter pelo menos 2 criativos para teste A/B
                                </p>
                              </div>
                              <CriativosQuery 
                                campanhaId={campanha.id_campanha} 
                                plataforma={campanha.plataforma || "OUTRO"}
                                urlEsperadaCampanha={campanha.url_esperada}
                              />
                            </div>
                          ) : (
                            <div className="p-4">
                              <CriativosQuery 
                                campanhaId={campanha.id_campanha} 
                                plataforma={campanha.plataforma || "OUTRO"}
                                urlEsperadaCampanha={campanha.url_esperada}
                              />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))
              )}
            </div>
          </CardContent>
        </Card>
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
