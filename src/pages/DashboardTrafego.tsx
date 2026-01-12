import { useState, useEffect } from "react";
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
  Link2Off,
  Loader2
} from "lucide-react";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { CampanhaFluxoDiagram } from "@/components/CampanhaFluxoDiagram";
import { MetricasAwareness } from "@/components/dashboard/MetricasAwareness";
import { UTMHealthWidget } from "@/components/dashboard/UTMHealthWidget";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { CampanhaCardMobile } from "@/components/dashboard/CampanhaCardMobile";
import { CriativoItemMobile } from "@/components/dashboard/CriativoItemMobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { AtualizacaoProgressoFloat } from "@/components/AtualizacaoProgressoFloat";
import { useAtualizarDadosEmpresa } from "@/hooks/useAtualizarDadosEmpresa";

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
  qtd_criativos_ativos?: number;
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

// Ícone Meta (Facebook)
const MetaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z"/>
  </svg>
);

// Ícone Google
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Helper para obter ícone da plataforma
const getPlataformaIcon = (plataforma?: string) => {
  if (plataforma === "META") {
    return <MetaIcon className="h-4 w-4 text-[#1877F2]" />;
  } else if (plataforma === "GOOGLE") {
    return <GoogleIcon className="h-4 w-4" />;
  }
  return null;
};

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
  const isMobile = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);
  const [criativoEditando, setCriativoEditando] = useState<Criativo | null>(null);
  const [urlEsperadaInput, setUrlEsperadaInput] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [filtroStatusCriativo, setFiltroStatusCriativo] = useState<string>("todos");
  const [ordenacaoCriativo, setOrdenacaoCriativo] = useState<string>("leads_desc");
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
        Nenhum criativo cadastrado para esta campanha
      </p>
    );
  }

  // Filtrar criativos pelo status
  const criativosFiltradosPorStatus = criativos.filter(criativo => {
    if (filtroStatusCriativo === "ativos") return criativo.ativo;
    if (filtroStatusCriativo === "inativos") return !criativo.ativo;
    return true; // todos
  });

  // Ordenar criativos
  const criativosFiltrados = [...criativosFiltradosPorStatus].sort((a, b) => {
    switch (ordenacaoCriativo) {
      case "leads_desc":
        return (b.leads || 0) - (a.leads || 0);
      case "leads_asc":
        return (a.leads || 0) - (b.leads || 0);
      case "cliques_desc":
        return (b.cliques || 0) - (a.cliques || 0);
      case "cliques_asc":
        return (a.cliques || 0) - (b.cliques || 0);
      case "verba_desc":
        return (b.verba_investida || 0) - (a.verba_investida || 0);
      case "verba_asc":
        return (a.verba_investida || 0) - (b.verba_investida || 0);
      case "cpl_desc":
        return (b.cpl || Infinity) - (a.cpl || Infinity);
      case "cpl_asc":
        return (a.cpl || Infinity) - (b.cpl || Infinity);
      case "ctr_desc":
        return (b.ctr || 0) - (a.ctr || 0);
      case "ctr_asc":
        return (a.ctr || 0) - (b.ctr || 0);
      default:
        return 0;
    }
  });

  const qtdAtivos = criativos.filter(c => c.ativo).length;
  const qtdInativos = criativos.filter(c => !c.ativo).length;

  return (
    <>
      <div className="space-y-3">
        {/* Filtros de status e ordenação */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select value={filtroStatusCriativo} onValueChange={setFiltroStatusCriativo}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos ({criativos.length})</SelectItem>
                <SelectItem value="ativos">Ativos ({qtdAtivos})</SelectItem>
                <SelectItem value="inativos">Inativos ({qtdInativos})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ordenar:</span>
            <Select value={ordenacaoCriativo} onValueChange={setOrdenacaoCriativo}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leads_desc">Mais Leads</SelectItem>
                <SelectItem value="leads_asc">Menos Leads</SelectItem>
                <SelectItem value="cliques_desc">Mais Cliques</SelectItem>
                <SelectItem value="cliques_asc">Menos Cliques</SelectItem>
                <SelectItem value="verba_desc">Maior Verba</SelectItem>
                <SelectItem value="verba_asc">Menor Verba</SelectItem>
                <SelectItem value="cpl_desc">Maior CPL</SelectItem>
                <SelectItem value="cpl_asc">Menor CPL</SelectItem>
                <SelectItem value="ctr_desc">Maior CTR</SelectItem>
                <SelectItem value="ctr_asc">Menor CTR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {criativosFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum criativo {filtroStatusCriativo === "ativos" ? "ativo" : "inativo"} encontrado
          </p>
        ) : isMobile ? (
          /* Layout Mobile - Cards compactos */
          <div className="space-y-2">
            {criativosFiltrados.map((criativo) => (
              <CriativoItemMobile
                key={criativo.id_criativo}
                criativo={criativo}
                urlEsperadaCampanha={urlEsperadaCampanha}
                onCopyId={handleCopyId}
                onEditUrl={handleAbrirModal}
              />
            ))}
          </div>
        ) : (
          /* Layout Desktop - Lista horizontal */
          <div className="space-y-2">
            {criativosFiltrados.map((criativo) => (
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
        )}
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
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const [ordenacao, setOrdenacao] = useState<string>("verba_desc");
  const [filtroStatusCampanha, setFiltroStatusCampanha] = useState<string>("ativas");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [syncingCreatives, setSyncingCreatives] = useState(false);
  const [campanhaFluxoOpen, setCampanhaFluxoOpen] = useState(false);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<{ id: string; nome: string } | null>(null);
  const [modalAtualizacaoOpen, setModalAtualizacaoOpen] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const periodoContext = usePeriodo();
  const { getDataReferencia, tipoFiltro } = periodoContext;
  const labelPeriodo = periodoContext.labelPeriodo;
  const isMobile = useIsMobile();
  
  // Hook para atualização unificada
  const {
    atualizarDados,
    isAtualizando,
    fases,
    duracaoTotal,
    concluido,
    sucesso,
    erro,
    resetState,
  } = useAtualizarDadosEmpresa();

  // Buscar última atualização quando empresa mudar ou atualização concluir
  useEffect(() => {
    const fetchUltimaAtualizacao = async () => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        setUltimaAtualizacao(null);
        return;
      }

      const { data } = await supabase
        .from("cronjob_execucao")
        .select("data_execucao")
        .eq("nome_cronjob", "atualizar-dados-empresa")
        .in("status", ["sucesso", "parcial"])
        .order("data_execucao", { ascending: false })
        .limit(1)
        .single();

      if (data?.data_execucao) {
        setUltimaAtualizacao(data.data_execucao);
      } else {
        setUltimaAtualizacao(null);
      }
    };

    fetchUltimaAtualizacao();
  }, [empresaSelecionada, concluido]);

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
    refetchInterval: 5 * 60 * 1000, // Auto-refresh a cada 5 minutos
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

      // Buscar quantidade de criativos para cada campanha (total e ativos)
      const campanhasAgregadas = Object.values(metricasAgregadas);
      const campanhasComCriativos = await Promise.all(
        campanhasAgregadas.map(async (m: any) => {
          // Buscar contagem total de criativos
          const { count: countTotal } = await supabase
            .from("criativo")
            .select("id_criativo", { count: "exact", head: true })
            .eq("id_campanha", m.id_campanha);

          // Buscar contagem de criativos ativos
          const { count: countAtivos } = await supabase
            .from("criativo")
            .select("id_criativo", { count: "exact", head: true })
            .eq("id_campanha", m.id_campanha)
            .eq("ativo", true);

          return {
            ...m,
            cpl: m.leads > 0 ? m.verba_investida / m.leads : null,
            cac: m.vendas > 0 ? m.verba_investida / m.vendas : null,
            ticket_medio: m.vendas > 0 ? (m.verba_investida * 3) / m.vendas : 0,
            qtd_criativos: countTotal || 0,
            qtd_criativos_ativos: countAtivos || 0,
          };
        })
      );

      return campanhasComCriativos as CampanhaMetrica[];
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 3 * 60 * 1000, // Auto-refresh a cada 3 minutos
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
    refetchInterval: 3 * 60 * 1000, // Auto-refresh a cada 3 minutos
  });

  // Funil de conversão baseado nos leads com stages do Pipedrive - usando COUNT para evitar limite de 1000
  const { data: funilData } = useQuery({
    queryKey: [
      "funil-conversao",
      empresaSelecionada,
      format(inicioMes, "yyyy-MM-dd"),
      format(fimMes, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const baseFilters = {
        gte: inicioMes.toISOString(),
        lte: fimMes.toISOString(),
        empresa: empresaSelecionada !== "todas" ? empresaSelecionada : null,
      };

      // MQL = todos os leads (count total)
      let mqlQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .gte("data_criacao", baseFilters.gte)
        .lte("data_criacao", baseFilters.lte);
      if (baseFilters.empresa) {
        mqlQuery = mqlQuery.eq("id_empresa", baseFilters.empresa);
      }
      const { count: mql } = await mqlQuery;

      // Levantou a mão = stages específicos ou levantou_mao = true ou venda_realizada = true
      let levantouMaoQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .gte("data_criacao", baseFilters.gte)
        .lte("data_criacao", baseFilters.lte)
        .or("stage_atual.in.(WhatsApp,Lead,Contato Iniciado,Negociação,Negociação ,Aguardando pagamento,Vendido),levantou_mao.eq.true,venda_realizada.eq.true");
      if (baseFilters.empresa) {
        levantouMaoQuery = levantouMaoQuery.eq("id_empresa", baseFilters.empresa);
      }
      const { count: levantouMao } = await levantouMaoQuery;

      // Negociação = Negociação ou etapas posteriores
      let negociacaoQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .gte("data_criacao", baseFilters.gte)
        .lte("data_criacao", baseFilters.lte)
        .or("stage_atual.in.(Negociação,Negociação ,Aguardando pagamento,Vendido),venda_realizada.eq.true");
      if (baseFilters.empresa) {
        negociacaoQuery = negociacaoQuery.eq("id_empresa", baseFilters.empresa);
      }
      const { count: negociacao } = await negociacaoQuery;

      // Aguardando Pagamento = Aguardando pagamento ou Vendido ou vendeu
      let aguardandoPagamentoQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .gte("data_criacao", baseFilters.gte)
        .lte("data_criacao", baseFilters.lte)
        .or("stage_atual.in.(Aguardando pagamento,Vendido),venda_realizada.eq.true");
      if (baseFilters.empresa) {
        aguardandoPagamentoQuery = aguardandoPagamentoQuery.eq("id_empresa", baseFilters.empresa);
      }
      const { count: aguardandoPagamento } = await aguardandoPagamentoQuery;

      // Vendas = venda_realizada = true ou stage_atual = 'Vendido'
      let vendasQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .gte("data_criacao", baseFilters.gte)
        .lte("data_criacao", baseFilters.lte)
        .or("venda_realizada.eq.true,stage_atual.eq.Vendido");
      if (baseFilters.empresa) {
        vendasQuery = vendasQuery.eq("id_empresa", baseFilters.empresa);
      }
      const { count: vendas } = await vendasQuery;

      return { 
        mql: mql || 0, 
        levantouMao: levantouMao || 0, 
        negociacao: negociacao || 0, 
        aguardandoPagamento: aguardandoPagamento || 0, 
        vendas: vendas || 0 
      };
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
  const funil = funilData || { mql: 0, levantouMao: 0, negociacao: 0, aguardandoPagamento: 0, vendas: 0 };

  // Taxas do funil de conversão
  const taxaLevantouMao = funil.mql > 0 ? (funil.levantouMao / funil.mql) * 100 : 0;
  const taxaNegociacao = funil.levantouMao > 0 ? (funil.negociacao / funil.levantouMao) * 100 : 0;
  const taxaAguardando = funil.negociacao > 0 ? (funil.aguardandoPagamento / funil.negociacao) * 100 : 0;
  const taxaVendaFunil = funil.aguardandoPagamento > 0 ? (funil.vendas / funil.aguardandoPagamento) * 100 : 0;
  const eficienciaFunil = funil.mql > 0 ? (funil.vendas / funil.mql) * 100 : 0;

  // Taxas antigas mantidas para compatibilidade com outros componentes
  const taxaMQL = totais.leads > 0 ? (totais.mqls / totais.leads) * 100 : 0;
  const taxaLevantada = totais.mqls > 0 ? (totais.levantadas / totais.mqls) * 100 : 0;
  const taxaReuniao = totais.levantadas > 0 ? (totais.reunioes / totais.levantadas) * 100 : 0;
  const taxaVenda = totais.reunioes > 0 ? (totais.vendas / totais.reunioes) * 100 : 0;


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
    <div className="min-h-screen bg-background p-3 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground">Dashboard Tráfego</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Análise de campanhas - {labelPeriodo}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2 sm:gap-3">
                {/* Botão Atualizar Tudo - chama o orquestrador */}
                {empresaSelecionada !== "todas" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setModalAtualizacaoOpen(true);
                      atualizarDados(empresaSelecionada);
                    }}
                    disabled={isAtualizando}
                    className="gap-1 sm:gap-2"
                  >
                    {isAtualizando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Atualizar Tudo</span>
                  </Button>
                )}
                
                {/* Botão para recarregar cache local */}
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
                  className="gap-1 sm:gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Recarregar</span>
                </Button>
              </div>
              {/* Última atualização */}
              {empresaSelecionada !== "todas" && ultimaAtualizacao && (
                <span className="text-xs text-muted-foreground">
                  Última atualização: {format(new Date(ultimaAtualizacao), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Floating de progresso da atualização */}
        {isAtualizando || (concluido && modalAtualizacaoOpen) ? (
          <AtualizacaoProgressoFloat
            onClose={() => {
              setModalAtualizacaoOpen(false);
              resetState();
            }}
            empresaNome={empresas?.find(e => e.id_empresa === empresaSelecionada)?.nome || "Empresa"}
            fases={fases}
            duracaoTotal={duracaoTotal}
            concluido={concluido}
            sucesso={sucesso}
            erro={erro}
          />
        ) : null}

        {/* KPIs Topo - Grid responsivo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4">
          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Verba Total
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold truncate">
                R$ {totais.verba.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{totais.leads}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                MQLs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{totais.mqls}</div>
              {mqlDistribuicao && !isMobile && (
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

          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Levantadas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{totais.levantadas}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Reuniões
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{totais.reunioes}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-0">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{totais.vendas}</div>
            </CardContent>
          </Card>

          <Card className="p-2 sm:p-0 col-span-2 sm:col-span-1">
            <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-6 sm:pt-4">
              <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                Eficiência do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-xl font-bold">{eficienciaFunil.toFixed(1)}%</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                {totais.vendas} / {totais.leads} leads
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Card CPL Orgânico - Responsivo */}
        {cplOrganicoData && (cplOrganicoData.investimento > 0 || cplOrganicoData.leads > 0) && (
          <Card>
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                <span className="hidden sm:inline">Custo por Lead Orgânico (Redes Sociais)</span>
                <span className="sm:hidden">CPL Orgânico</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 border">
                  <p className="text-[10px] sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Investimento</p>
                  <p className="text-sm sm:text-2xl font-bold truncate">
                    R$ {cplOrganicoData.investimento.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
                    Campanhas de alcance e engajamento
                  </p>
                </div>

                <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border">
                  <p className="text-[10px] sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">Leads Redes</p>
                  <p className="text-sm sm:text-2xl font-bold">{cplOrganicoData.leads}</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
                    Orgânicos (não pagos)
                  </p>
                </div>

                <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border">
                  <p className="text-[10px] sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">CPL Orgânico</p>
                  <p className="text-sm sm:text-2xl font-bold truncate">
                    {cplOrganicoData.leads > 0 
                      ? `R$ ${(cplOrganicoData.investimento / cplOrganicoData.leads).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      : "N/A"
                    }
                  </p>
                </div>

                <div className="p-2 sm:p-4 rounded-lg border bg-card col-span-2 lg:col-span-1">
                  <p className="text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-2">Por Rede Social</p>
                  <div className="grid grid-cols-3 lg:grid-cols-1 gap-0.5 sm:gap-1 text-[10px] sm:text-sm">
                    {cplOrganicoData.breakdown.instagram > 0 && (
                      <div className="flex justify-between">
                        <span>📱 IG</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.instagram}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.facebook > 0 && (
                      <div className="flex justify-between">
                        <span>📘 FB</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.facebook}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.linkedin > 0 && (
                      <div className="flex justify-between">
                        <span>💼 LI</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.linkedin}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.tiktok > 0 && (
                      <div className="flex justify-between">
                        <span>🎵 TT</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.tiktok}</span>
                      </div>
                    )}
                    {cplOrganicoData.breakdown.youtube > 0 && (
                      <div className="flex justify-between">
                        <span>📺 YT</span>
                        <span className="font-medium">{cplOrganicoData.breakdown.youtube}</span>
                      </div>
                    )}
                    {cplOrganicoData.leads === 0 && (
                      <p className="text-muted-foreground text-[9px] sm:text-xs col-span-3">Nenhum lead</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas de Awareness (Instagram/Metricool) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MetricasAwareness 
              empresaId={empresaSelecionada === "todas" ? null : empresaSelecionada} 
              dataInicio={inicioMes} 
              dataFim={fimMes} 
            />
          </div>
          <div className="lg:col-span-1">
            <UTMHealthWidget empresaId={empresaSelecionada === "todas" ? undefined : empresaSelecionada} />
          </div>
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
              {/* MQL (Todos os leads) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">MQL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{funil.mql}</span>
                    <Badge variant="outline">100%</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto rotate-90" />

              {/* Levantou a Mão */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium">Levantou a Mão</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaLevantouMao.toFixed(1)}%</span>
                    <Badge variant="outline">{funil.levantouMao} / {funil.mql}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(taxaLevantouMao, 100)}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto rotate-90" />

              {/* Negociação */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="font-medium">Negociação</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaNegociacao.toFixed(1)}%</span>
                    <Badge variant="outline">{funil.negociacao} / {funil.levantouMao}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(taxaNegociacao, 100)}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto rotate-90" />

              {/* Aguardando Pagamento */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-medium">Aguardando Pagamento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaAguardando.toFixed(1)}%</span>
                    <Badge variant="outline">{funil.aguardandoPagamento} / {funil.negociacao}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(taxaAguardando, 100)}%` }}
                  />
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto rotate-90" />

              {/* Vendas */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Vendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{taxaVendaFunil.toFixed(1)}%</span>
                    <Badge variant="outline">{funil.vendas} / {funil.aguardandoPagamento}</Badge>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${Math.min(taxaVendaFunil, 100)}%` }}
                  />
                </div>
              </div>

              {/* Taxa de Conversão Total */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Taxa de Conversão Total (MQL → Venda)</span>
                  <span className="text-lg font-bold text-green-600">{eficienciaFunil.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance por Campanha */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex flex-col gap-3">
              <CardTitle className="text-base sm:text-xl">Performance por Campanha</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={syncingCreatives} className="h-8 text-xs sm:text-sm">
                      <RefreshCw className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      {syncingCreatives ? "..." : "Atualizar"}
                      <ChevronDown className="ml-1 h-3 w-3" />
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
                  <SelectTrigger className="w-[90px] sm:w-[140px] h-8 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativas">Ativas</SelectItem>
                    <SelectItem value="inativas">Inativas</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger className="w-[110px] sm:w-[180px] h-8 text-xs sm:text-sm">
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
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              {campanhasOrdenadas?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhuma campanha encontrada
                </p>
              ) : isMobile ? (
                /* Mobile: Cards */
                campanhasOrdenadas?.map((campanha) => (
                  <CampanhaCardMobile
                    key={campanha.id_campanha}
                    campanha={campanha}
                    isExpanded={expandedCampaigns.has(campanha.id_campanha)}
                    onToggleExpand={() => toggleCampaign(campanha.id_campanha)}
                    onVerFluxo={() => {
                      setCampanhaSelecionada({ id: campanha.id_campanha, nome: campanha.nome });
                      setCampanhaFluxoOpen(true);
                    }}
                    renderCriativos={() => (
                      <CriativosQuery 
                        campanhaId={campanha.id_campanha} 
                        plataforma={campanha.plataforma || "OUTRO"}
                        urlEsperadaCampanha={campanha.url_esperada}
                      />
                    )}
                  />
                ))
              ) : (
                /* Desktop: Collapsible list */
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
                              {getPlataformaIcon(campanha.plataforma)}
                              <h3 className="font-semibold">{campanha.nome}</h3>
                              {campanha.qtd_criativos_ativos !== undefined && campanha.qtd_criativos_ativos < 2 && (
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge 
                                        variant={campanha.qtd_criativos_ativos !== undefined && campanha.qtd_criativos_ativos < 2 ? "destructive" : "secondary"}
                                      >
                                        {campanha.qtd_criativos} criativo{campanha.qtd_criativos !== 1 ? 's' : ''} ({campanha.qtd_criativos_ativos} ativo{campanha.qtd_criativos_ativos !== 1 ? 's' : ''})
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Total: {campanha.qtd_criativos} | Ativos: {campanha.qtd_criativos_ativos}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
                        <div className="border-t bg-muted/20 p-4">
                          {campanha.qtd_criativos_ativos !== undefined && campanha.qtd_criativos_ativos < 2 && (
                            <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                {campanha.qtd_criativos_ativos === 0 
                                  ? "⚠️ Nenhum criativo ativo - campanha pode estar pausada"
                                  : "⚠️ Apenas 1 criativo ativo - recomenda-se ter pelo menos 2 para teste A/B"
                                }
                              </p>
                            </div>
                          )}
                          <CriativosQuery 
                            campanhaId={campanha.id_campanha} 
                            plataforma={campanha.plataforma || "OUTRO"}
                            urlEsperadaCampanha={campanha.url_esperada}
                          />
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
