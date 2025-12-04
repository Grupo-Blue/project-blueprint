import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, TrendingUp, DollarSign, CheckCircle2, Calendar, ExternalLink, Search, Clock, Building2, Flame, Zap, Activity, Tag, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronRight, Mail, Globe, Target, Wallet, ShoppingCart, MapPin, History } from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { ImportarUsuariosTokeniza } from "@/components/ImportarUsuariosTokeniza";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";

// Helpers
const getOrigemIcon = (source: string | null) => {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) return { icon: '📘', label: 'Facebook' };
  if (s.includes('google')) return { icon: '🔍', label: 'Google' };
  if (s.includes('instagram') || s.includes('ig')) return { icon: '📱', label: 'Instagram' };
  if (s.includes('email') || s.includes('mail')) return { icon: '📧', label: 'Email' };
  if (s.includes('linkedin')) return { icon: '💼', label: 'LinkedIn' };
  if (s.includes('tiktok')) return { icon: '🎵', label: 'TikTok' };
  if (s.includes('youtube')) return { icon: '📺', label: 'YouTube' };
  return { icon: '🔗', label: source };
};

const getUtmQuality = (lead: any) => {
  const hasSource = !!lead.utm_source;
  const hasMedium = !!lead.utm_medium;
  const hasCampaign = !!lead.utm_campaign;
  const hasContent = !!lead.utm_content;
  
  const total = [hasSource, hasMedium, hasCampaign, hasContent].filter(Boolean).length;
  
  if (total === 4) return { status: 'completo', badge: '🟢', label: 'Completo' };
  if (total >= 2) return { status: 'parcial', badge: '🟡', label: 'Parcial' };
  if (total >= 1) return { status: 'minimo', badge: '🟠', label: 'Mínimo' };
  return { status: 'ausente', badge: '🔴', label: 'Ausente' };
};

// Helper para identificar produto Blue
const getProdutoBlue = (nomeLead: string | null): string | null => {
  if (!nomeLead) return null;
  return nomeLead.toLowerCase().includes('consultoria') ? 'Consultoria' : 'IR Cripto';
};

const Leads = () => {
  const { tipoFiltro, getDataReferencia } = usePeriodo();
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useUserEmpresas();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [scoreMinimo, setScoreMinimo] = useState<string>("");
  const [clienteStatusFilter, setClienteStatusFilter] = useState<string>("all");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [investidorFilter, setInvestidorFilter] = useState<string>("all");
  const [origemFilter, setOrigemFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Auto-selecionar empresa quando carregar (se tiver apenas 1)
  useEffect(() => {
    if (empresasPermitidas.length === 1) {
      setEmpresaFilter(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas]);

  const availableStages = [
    { value: "Lead", label: "Lead" },
    { value: "Contato Iniciado", label: "Contato Iniciado" },
    { value: "Negociação", label: "Negociação" },
    { value: "Aguardando pagamento", label: "Aguardando pagamento" },
    { value: "Vendido", label: "Vendido" },
    { value: "Perdido", label: "Perdido" },
  ];
  const ITEMS_PER_PAGE = 15;

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select(`
          *,
          empresa:id_empresa (
            nome
          ),
          lead_evento (
            etapa,
            data_evento,
            observacao
          ),
          cliente_notion:id_cliente_notion (
            nome,
            status_cliente,
            produtos_contratados,
            anos_fiscais
          )
        `)
        .or("merged.is.null,merged.eq.false")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Filtrar leads
  const filteredLeads = leads?.filter((lead) => {
    // Filtro de período - usar data_venda para vendas realizadas, senão data_criacao
    const leadDate = lead.venda_realizada && lead.data_venda 
      ? parseISO(lead.data_venda) 
      : parseISO(lead.data_criacao);
    
    const dataReferencia = getDataReferencia();
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);
    const matchesPeriodo = leadDate >= inicioMes && leadDate <= fimMes;

    const matchesSearch = 
      !searchTerm ||
      lead.nome_lead?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.organizacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead as any).empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "mql" && lead.is_mql) ||
      (statusFilter === "reuniao" && lead.tem_reuniao) ||
      (statusFilter === "venda" && lead.venda_realizada) ||
      (statusFilter === "perdido" && lead.stage_atual === "Perdido") ||
      (statusFilter === "nao_comprou" && !lead.venda_realizada) ||
      (statusFilter === "novo" && !lead.is_mql && lead.stage_atual !== "Perdido");

    const matchesStage = 
      stageFilter.length === 0 ||
      (lead.stage_atual && stageFilter.includes(lead.stage_atual));

    const matchesScore = 
      !scoreMinimo ||
      (lead.mautic_score !== null && lead.mautic_score !== undefined && lead.mautic_score >= parseInt(scoreMinimo));

    const matchesClienteStatus =
      clienteStatusFilter === "all" ||
      (clienteStatusFilter === "cliente" && lead.cliente_status === "cliente") ||
      (clienteStatusFilter === "ex_cliente" && lead.cliente_status === "ex_cliente") ||
      (clienteStatusFilter === "nao_cliente" && !lead.cliente_status);

    const matchesEmpresa = 
      empresaFilter === "all" || 
      lead.id_empresa === empresaFilter;

    const matchesInvestidor =
      investidorFilter === "all" ||
      (investidorFilter === "investidor" && (lead as any).tokeniza_investidor === true) ||
      (investidorFilter === "carrinho" && (lead as any).tokeniza_carrinho_abandonado === true) ||
      (investidorFilter === "nao_investidor" && !(lead as any).tokeniza_investidor && !(lead as any).tokeniza_carrinho_abandonado);

    // Helpers para identificar origem por rede social (apenas orgânicos)
    const utmSource = (lead.utm_source || '').toLowerCase();
    const isOrganic = !(lead as any).lead_pago;
    
    const isInstagramBio = isOrganic && (utmSource.includes('instagram') || utmSource.includes('linktree'));
    const isFacebookBio = isOrganic && (utmSource.includes('facebook') || utmSource.includes('fb')) && !utmSource.includes('ads');
    const isLinkedIn = isOrganic && utmSource.includes('linkedin');
    const isTikTokBio = isOrganic && utmSource.includes('tiktok');
    const isYouTube = isOrganic && utmSource.includes('youtube');
    const isTwitter = isOrganic && (utmSource.includes('twitter') || utmSource.includes('x.com'));
    
    const matchesOrigem =
      origemFilter === "all" ||
      (origemFilter === "pago" && (lead as any).lead_pago === true) ||
      (origemFilter === "organico" && (lead as any).origem_tipo === "ORGANICO") ||
      (origemFilter === "manual" && ((lead as any).origem_tipo === "MANUAL" || !(lead as any).origem_tipo)) ||
      (origemFilter === "instagram_bio" && isInstagramBio) ||
      (origemFilter === "facebook_bio" && isFacebookBio) ||
      (origemFilter === "linkedin" && isLinkedIn) ||
      (origemFilter === "tiktok_bio" && isTikTokBio) ||
      (origemFilter === "youtube" && isYouTube) ||
      (origemFilter === "twitter" && isTwitter);

    return matchesPeriodo && matchesSearch && matchesStatus && matchesStage && matchesScore && matchesClienteStatus && matchesEmpresa && matchesInvestidor && matchesOrigem;
  });

  // Ordenação
  const sortedLeads = filteredLeads ? [...filteredLeads].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aValue: any;
    let bValue: any;
    
    switch (sortColumn) {
      case "nome":
        aValue = a.nome_lead?.toLowerCase() || "";
        bValue = b.nome_lead?.toLowerCase() || "";
        break;
      case "organizacao":
        aValue = a.organizacao?.toLowerCase() || "";
        bValue = b.organizacao?.toLowerCase() || "";
        break;
      case "empresa":
        aValue = (a as any).empresa?.nome?.toLowerCase() || "";
        bValue = (b as any).empresa?.nome?.toLowerCase() || "";
        break;
      case "stage":
        aValue = a.stage_atual?.toLowerCase() || "";
        bValue = b.stage_atual?.toLowerCase() || "";
        break;
      case "score":
        aValue = a.mautic_score ?? -1;
        bValue = b.mautic_score ?? -1;
        break;
      case "data":
        aValue = new Date(a.data_criacao).getTime();
        bValue = new Date(b.data_criacao).getTime();
        break;
      case "valor":
        aValue = a.valor_venda || 0;
        bValue = b.valor_venda || 0;
        break;
      case "investido":
        aValue = (a as any).tokeniza_valor_investido || 0;
        bValue = (b as any).tokeniza_valor_investido || 0;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }) : [];

  // Paginação
  const totalPages = Math.ceil((sortedLeads?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLeads = sortedLeads?.slice(startIndex, endIndex);

  const handleFilterChange = (setter: (value: any) => void) => (value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortableTableHead = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead 
      onClick={() => handleSort(column)}
      className="cursor-pointer hover:bg-muted/50 select-none"
    >
      <div className="flex items-center gap-2">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

  const getEngajamento = (lastActive: string | null, score: number | null) => {
    if (!lastActive || score === null) return null;
    
    const diasInativo = differenceInDays(new Date(), new Date(lastActive));
    
    if (diasInativo <= 7 && score >= 50) {
      return { nivel: 'alto', label: 'Alto', icon: Flame, color: 'text-red-600' };
    } else if (diasInativo <= 30 && score >= 20) {
      return { nivel: 'medio', label: 'Médio', icon: Zap, color: 'text-yellow-600' };
    } else if (score > 0) {
      return { nivel: 'baixo', label: 'Baixo', icon: Activity, color: 'text-blue-600' };
    }
    
    return null;
  };

  // Helper para contar leads por rede social
  const countByRedeSocial = (leads: any[] | undefined) => {
    if (!leads) return { instagram: 0, facebook: 0, linkedin: 0, tiktok: 0, youtube: 0, twitter: 0 };
    
    return leads.reduce((acc, lead) => {
      const utmSource = (lead.utm_source || '').toLowerCase();
      const isOrganic = !(lead as any).lead_pago;
      
      if (isOrganic) {
        if (utmSource.includes('instagram') || utmSource.includes('linktree')) acc.instagram++;
        else if ((utmSource.includes('facebook') || utmSource.includes('fb')) && !utmSource.includes('ads')) acc.facebook++;
        else if (utmSource.includes('linkedin')) acc.linkedin++;
        else if (utmSource.includes('tiktok')) acc.tiktok++;
        else if (utmSource.includes('youtube')) acc.youtube++;
        else if (utmSource.includes('twitter') || utmSource.includes('x.com')) acc.twitter++;
      }
      
      return acc;
    }, { instagram: 0, facebook: 0, linkedin: 0, tiktok: 0, youtube: 0, twitter: 0 });
  };

  const redesSociais = countByRedeSocial(filteredLeads);
  const totalRedesSociais = redesSociais.instagram + redesSociais.facebook + redesSociais.linkedin + redesSociais.tiktok + redesSociais.youtube + redesSociais.twitter;

  // Calcular estatísticas
  const stats = {
    total: filteredLeads?.length || 0,
    novos: filteredLeads?.filter(l => !l.is_mql).length || 0,
    mqls: filteredLeads?.filter(l => l.is_mql).length || 0,
    reunioes: filteredLeads?.filter(l => l.tem_reuniao).length || 0,
    vendas: filteredLeads?.filter(l => l.venda_realizada).length || 0,
    valorTotal: filteredLeads?.filter(l => l.venda_realizada).reduce((sum, l) => sum + (l.valor_venda || 0), 0) || 0,
    investidores: filteredLeads?.filter(l => (l as any).tokeniza_investidor).length || 0,
    valorInvestido: filteredLeads?.reduce((sum, l) => sum + ((l as any).tokeniza_valor_investido || 0), 0) || 0,
    carrinhos: filteredLeads?.filter(l => (l as any).tokeniza_carrinho_abandonado).length || 0,
    leadsPagos: filteredLeads?.filter(l => (l as any).lead_pago).length || 0,
    leadsOrganicos: filteredLeads?.filter(l => (l as any).origem_tipo === 'ORGANICO').length || 0,
    leadsManuais: filteredLeads?.filter(l => (l as any).origem_tipo === 'MANUAL' || !(l as any).origem_tipo).length || 0,
    taxaConversaoMQL: filteredLeads?.length ? ((filteredLeads.filter(l => l.is_mql).length / filteredLeads.length) * 100).toFixed(1) : "0",
    taxaConversaoVenda: filteredLeads?.filter(l => l.is_mql).length ? 
      ((filteredLeads.filter(l => l.venda_realizada).length / filteredLeads.filter(l => l.is_mql).length) * 100).toFixed(1) : "0",
    redesSociais,
    totalRedesSociais,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie todos os leads sincronizados do Pipedrive
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <ImportarUsuariosTokeniza />
          <FiltroPeriodo />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              🎯 {stats.leadsPagos} pagos | 📧 {stats.leadsOrganicos} org | ✋ {stats.leadsManuais} man
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversaoVenda}%</div>
            <p className="text-xs text-muted-foreground">MQL → Venda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendas}</div>
            <p className="text-xs text-muted-foreground">{stats.reunioes} reuniões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats.valorTotal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investidores</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.investidores}</div>
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats.valorInvestido)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carrinhos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.carrinhos}</div>
            <p className="text-xs text-muted-foreground">abandonados</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads por Rede Social */}
      {stats.totalRedesSociais > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Leads por Rede Social (Orgânicos)
            </CardTitle>
            <CardDescription>
              Total: {stats.totalRedesSociais} leads de redes sociais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {stats.redesSociais.instagram > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
                  <span className="text-2xl mb-1">📱</span>
                  <span className="text-lg font-bold">{stats.redesSociais.instagram}</span>
                  <span className="text-xs text-muted-foreground">Instagram</span>
                </div>
              )}
              {stats.redesSociais.facebook > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-2xl mb-1">📘</span>
                  <span className="text-lg font-bold">{stats.redesSociais.facebook}</span>
                  <span className="text-xs text-muted-foreground">Facebook</span>
                </div>
              )}
              {stats.redesSociais.linkedin > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <span className="text-2xl mb-1">💼</span>
                  <span className="text-lg font-bold">{stats.redesSociais.linkedin}</span>
                  <span className="text-xs text-muted-foreground">LinkedIn</span>
                </div>
              )}
              {stats.redesSociais.tiktok > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
                  <span className="text-2xl mb-1">🎵</span>
                  <span className="text-lg font-bold">{stats.redesSociais.tiktok}</span>
                  <span className="text-xs text-muted-foreground">TikTok</span>
                </div>
              )}
              {stats.redesSociais.youtube > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-2xl mb-1">📺</span>
                  <span className="text-lg font-bold">{stats.redesSociais.youtube}</span>
                  <span className="text-xs text-muted-foreground">YouTube</span>
                </div>
              )}
              {stats.redesSociais.twitter > 0 && (
                <div className="flex flex-col items-center p-3 rounded-lg bg-slate-800/10 border border-slate-800/20">
                  <span className="text-2xl mb-1">🐦</span>
                  <span className="text-lg font-bold">{stats.redesSociais.twitter}</span>
                  <span className="text-xs text-muted-foreground">Twitter/X</span>
                </div>
              )}
              {stats.totalRedesSociais === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-4">
                  Nenhum lead de redes sociais no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <Select value={empresaFilter} onValueChange={handleFilterChange(setEmpresaFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <SelectValue placeholder="Empresa" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresasPermitidas.map((empresa) => (
                <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                  {empresa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email..."
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm)(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="novo">Novos</SelectItem>
              <SelectItem value="mql">MQLs</SelectItem>
              <SelectItem value="reuniao">Com Reunião</SelectItem>
              <SelectItem value="venda">Vendas</SelectItem>
              <SelectItem value="nao_comprou">Não Comprou</SelectItem>
              <SelectItem value="perdido">Perdidos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={investidorFilter} onValueChange={handleFilterChange(setInvestidorFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <SelectValue placeholder="Investidor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="investidor">💰 Investidores</SelectItem>
              <SelectItem value="carrinho">🛒 Carrinho</SelectItem>
              <SelectItem value="nao_investidor">Não Investidor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={origemFilter} onValueChange={handleFilterChange(setOrigemFilter)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <SelectValue placeholder="Origem" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Origens</SelectItem>
              <SelectItem value="pago">🎯 Pagos</SelectItem>
              <SelectItem value="organico">📧 Orgânicos</SelectItem>
              <SelectItem value="manual">✋ Manuais</SelectItem>
              <SelectItem value="instagram_bio">📸 Instagram Bio</SelectItem>
              <SelectItem value="facebook_bio">📘 Facebook Bio</SelectItem>
              <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
              <SelectItem value="tiktok_bio">🎵 TikTok Bio</SelectItem>
              <SelectItem value="youtube">📺 YouTube</SelectItem>
              <SelectItem value="twitter">🐦 Twitter/X</SelectItem>
            </SelectContent>
          </Select>

          <Select value={clienteStatusFilter} onValueChange={handleFilterChange(setClienteStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cliente">🟢 Clientes</SelectItem>
              <SelectItem value="ex_cliente">🟡 Ex-Clientes</SelectItem>
              <SelectItem value="nao_cliente">Não Clientes</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[150px] justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {stageFilter.length === 0 ? "Stage" : `${stageFilter.length} sel.`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-3">
              <div className="space-y-2">
                {availableStages.map((stage) => (
                  <div key={stage.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={stage.value}
                      checked={stageFilter.includes(stage.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleFilterChange(setStageFilter)([...stageFilter, stage.value]);
                        } else {
                          handleFilterChange(setStageFilter)(stageFilter.filter((s) => s !== stage.value));
                        }
                      }}
                    />
                    <label htmlFor={stage.value} className="text-sm cursor-pointer">{stage.label}</label>
                  </div>
                ))}
                {stageFilter.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => handleFilterChange(setStageFilter)([])}>
                    Limpar
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            type="number"
            placeholder="Score mín."
            value={scoreMinimo}
            onChange={(e) => handleFilterChange(setScoreMinimo)(e.target.value)}
            className="w-full sm:w-[100px]"
            min="0"
          />
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Leads ({sortedLeads?.length || 0})</CardTitle>
              <CardDescription>Clique na linha para expandir detalhes</CardDescription>
            </div>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">Pág {currentPage}/{totalPages}</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <SortableTableHead column="nome">Lead / Email</SortableTableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Investidor</TableHead>
                  <SortableTableHead column="empresa">Empresa</SortableTableHead>
                  <TableHead>Stage / Status</TableHead>
                  <SortableTableHead column="score">Score</SortableTableHead>
                  <SortableTableHead column="data">Data</SortableTableHead>
                  <SortableTableHead column="valor">Valor</SortableTableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads?.map((lead) => {
                  const isExpanded = expandedRows.has(lead.id_lead);
                  const origem = getOrigemIcon(lead.utm_source);
                  const utmQuality = getUtmQuality(lead);
                  const engajamento = getEngajamento(lead.mautic_last_active, lead.mautic_score);
                  const diasNoFunil = differenceInDays(new Date(), new Date(lead.data_criacao));
                  
                  return (
                    <Collapsible key={lead.id_lead} open={isExpanded} onOpenChange={() => toggleRowExpansion(lead.id_lead)} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(lead.id_lead)}>
                          <TableCell className="w-8">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          
                          {/* Lead / Email */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{lead.nome_lead || "Sem nome"}</span>
                              {lead.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {lead.email.length > 25 ? lead.email.substring(0, 25) + '...' : lead.email}
                                </span>
                              )}
                              {lead.organizacao && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {lead.organizacao}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Origem */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {/* Badge de tipo de origem */}
                              {(lead as any).lead_pago ? (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs w-fit">
                                  🎯 Pago
                                </Badge>
                              ) : (lead as any).origem_tipo === 'ORGANICO' ? (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs w-fit">
                                  📧 Orgânico
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs w-fit">
                                  ✋ Manual
                                </Badge>
                              )}
                              {/* Badge Instagram Bio - quando utm_source contém instagram ou linktree */}
                              {lead.utm_source && (lead.utm_source.toLowerCase().includes('instagram') || lead.utm_source.toLowerCase().includes('linktree')) && !(lead as any).lead_pago && (
                                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs w-fit">
                                  📲 Instagram Bio
                                </Badge>
                              )}
                              {/* Badge de canal */}
                              {origem && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="cursor-help text-xs w-fit">
                                        {origem.icon} {origem.label}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{lead.utm_medium || 'N/A'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>

                          {/* Campanha */}
                          <TableCell>
                            {lead.utm_campaign ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs max-w-[100px] truncate">{lead.utm_campaign}</span>
                                      <span>{utmQuality.badge}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{lead.utm_campaign}</p>
                                    <p className="text-xs text-muted-foreground">UTMs: {utmQuality.label}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Investidor Tokeniza */}
                          <TableCell>
                            {(lead as any).tokeniza_investidor ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 cursor-help">
                                      💰 {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((lead as any).tokeniza_valor_investido || 0)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-1">
                                      <p>{(lead as any).tokeniza_qtd_investimentos || 0} investimentos</p>
                                      {(lead as any).tokeniza_primeiro_investimento && (
                                        <p>Desde: {format(new Date((lead as any).tokeniza_primeiro_investimento), "dd/MM/yyyy")}</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (lead as any).tokeniza_carrinho_abandonado ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 cursor-help">
                                      🛒 {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((lead as any).tokeniza_valor_carrinho || 0)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Carrinho abandonado</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Empresa */}
                          <TableCell className="font-medium text-sm">
                            {(lead as any).empresa?.nome || "N/A"}
                          </TableCell>

                          {/* Stage / Status */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {lead.stage_atual && <Badge variant="outline" className="text-xs">{lead.stage_atual}</Badge>}
                              {lead.cliente_status === "cliente" && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">🟢</Badge>}
                              {lead.cliente_status === "ex_cliente" && <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">🟡</Badge>}
                              {lead.is_mql && !lead.venda_realizada && <Badge variant="default" className="text-xs">MQL</Badge>}
                              {lead.venda_realizada && <Badge className="bg-green-600 text-xs">Venda</Badge>}
                            </div>
                          </TableCell>

                          {/* Score */}
                          <TableCell className="text-center">
                            {lead.mautic_score !== null ? (
                              <div className="flex flex-col items-center">
                                <span className="font-semibold">{lead.mautic_score}</span>
                                {engajamento && (
                                  <Badge variant="outline" className={`${engajamento.color} text-xs`}>
                                    <engajamento.icon className="h-3 w-3" />
                                  </Badge>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>

                          {/* Data */}
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(lead.data_criacao), "dd/MM/yy")}
                              <div className="text-xs text-muted-foreground">{diasNoFunil}d</div>
                            </div>
                          </TableCell>

                          {/* Valor */}
                          <TableCell className="text-right">
                            {lead.valor_venda ? (
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-semibold">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.valor_venda)}
                                </span>
                                {(lead as any).tokeniza_projeto_nome ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    📦 {(lead as any).tokeniza_projeto_nome}
                                  </span>
                                ) : (lead as any).empresa?.nome?.toLowerCase().includes('blue') && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    📋 {getProdutoBlue(lead.nome_lead)}
                                  </span>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>

                          {/* Ações */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {lead.url_pipedrive && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Content */}
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={11} className="py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                                {/* UTMs */}
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> UTMs
                                  </h4>
                                  <div className="text-xs space-y-1 bg-background p-2 rounded">
                                    <p><span className="text-muted-foreground">Source:</span> {lead.utm_source || '-'}</p>
                                    <p><span className="text-muted-foreground">Medium:</span> {lead.utm_medium || '-'}</p>
                                    <p><span className="text-muted-foreground">Campaign:</span> {lead.utm_campaign || '-'}</p>
                                    <p><span className="text-muted-foreground">Content:</span> {lead.utm_content || '-'}</p>
                                    <p><span className="text-muted-foreground">Term:</span> {lead.utm_term || '-'}</p>
                                  </div>
                                </div>

                                {/* Mautic */}
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm flex items-center gap-2">
                                    <Activity className="h-4 w-4" /> Mautic
                                  </h4>
                                  <div className="text-xs space-y-1 bg-background p-2 rounded">
                                    <p><span className="text-muted-foreground">Score:</span> {lead.mautic_score ?? '-'}</p>
                                    <p><span className="text-muted-foreground">Page Hits:</span> {lead.mautic_page_hits ?? '-'}</p>
                                    <p><span className="text-muted-foreground">1ª Visita:</span> {lead.mautic_first_visit ? format(new Date(lead.mautic_first_visit), "dd/MM/yy") : '-'}</p>
                                    <p><span className="text-muted-foreground">Última:</span> {lead.mautic_last_active ? format(new Date(lead.mautic_last_active), "dd/MM/yy") : '-'}</p>
                                    {lead.mautic_tags && Array.isArray(lead.mautic_tags) && lead.mautic_tags.length > 0 && (
                                      <p><span className="text-muted-foreground">Tags:</span> {(lead.mautic_tags as string[]).join(', ')}</p>
                                    )}
                                    {lead.cidade_mautic && (
                                      <p className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {lead.cidade_mautic}{lead.estado_mautic ? ` - ${lead.estado_mautic}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Tokeniza */}
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Tokeniza
                                  </h4>
                                  <div className="text-xs space-y-1 bg-background p-2 rounded">
                                    {(lead as any).tokeniza_investidor ? (
                                      <>
                                        <p className="text-green-600 font-medium">💰 Investidor Confirmado</p>
                                        <p><span className="text-muted-foreground">Valor:</span> {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((lead as any).tokeniza_valor_investido || 0)}</p>
                                        <p><span className="text-muted-foreground">Qtd:</span> {(lead as any).tokeniza_qtd_investimentos || 0} investimentos</p>
                                        {(lead as any).tokeniza_primeiro_investimento && (
                                          <p><span className="text-muted-foreground">Primeiro:</span> {format(new Date((lead as any).tokeniza_primeiro_investimento), "dd/MM/yy")}</p>
                                        )}
                                        {(lead as any).tokeniza_ultimo_investimento && (
                                          <p><span className="text-muted-foreground">Último:</span> {format(new Date((lead as any).tokeniza_ultimo_investimento), "dd/MM/yy")}</p>
                                        )}
                                      </>
                                    ) : (lead as any).tokeniza_carrinho_abandonado ? (
                                      <>
                                        <p className="text-yellow-600 font-medium">🛒 Carrinho Abandonado</p>
                                        <p><span className="text-muted-foreground">Valor:</span> {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((lead as any).tokeniza_valor_carrinho || 0)}</p>
                                      </>
                                    ) : (
                                      <p className="text-muted-foreground">Sem dados Tokeniza</p>
                                    )}
                                  </div>
                                </div>

                                {/* Histórico de Eventos */}
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm flex items-center gap-2">
                                    <History className="h-4 w-4" /> Histórico
                                  </h4>
                                  <div className="text-xs space-y-1 bg-background p-2 rounded max-h-32 overflow-y-auto">
                                    {(lead as any).lead_evento && (lead as any).lead_evento.length > 0 ? (
                                      (lead as any).lead_evento
                                        .sort((a: any, b: any) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime())
                                        .slice(0, 5)
                                        .map((evento: any, idx: number) => (
                                          <div key={idx} className="flex justify-between items-center border-b border-border/50 pb-1">
                                            <span>{evento.etapa}</span>
                                            <span className="text-muted-foreground">{format(new Date(evento.data_evento), "dd/MM")}</span>
                                          </div>
                                        ))
                                    ) : (
                                      <p className="text-muted-foreground">Sem eventos</p>
                                    )}
                                    {/* Cliente Notion info */}
                                    {(lead as any).cliente_notion && (
                                      <div className="mt-2 pt-2 border-t border-border">
                                        <p className="font-medium">{lead.cliente_status === "cliente" ? "🟢 Cliente" : "🟡 Ex-Cliente"}</p>
                                        {(lead as any).cliente_notion.produtos_contratados?.length > 0 && (
                                          <p><span className="text-muted-foreground">Produtos:</span> {(lead as any).cliente_notion.produtos_contratados.join(', ')}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
                {!sortedLeads || sortedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nenhum lead encontrado com os filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginatedLeads?.map((lead) => {
              const origem = getOrigemIcon(lead.utm_source);
              const utmQuality = getUtmQuality(lead);
              
              return (
                <Card key={lead.id_lead} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">{lead.nome_lead || "Sem nome"}</p>
                      {lead.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {(lead as any).tokeniza_investidor && <span>💰</span>}
                      {(lead as any).tokeniza_carrinho_abandonado && <span>🛒</span>}
                      {lead.cliente_status === "cliente" && <span>🟢</span>}
                      {lead.cliente_status === "ex_cliente" && <span>🟡</span>}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {origem && <Badge variant="outline" className="text-xs">{origem.icon} {origem.label}</Badge>}
                    {lead.utm_campaign && <Badge variant="secondary" className="text-xs">{lead.utm_campaign.substring(0, 15)} {utmQuality.badge}</Badge>}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {lead.stage_atual && <Badge variant="outline" className="text-xs">{lead.stage_atual}</Badge>}
                    {lead.is_mql && <Badge className="text-xs">MQL</Badge>}
                    {lead.venda_realizada && <Badge className="bg-green-600 text-xs">Venda</Badge>}
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex gap-3">
                      <span>Score: {lead.mautic_score ?? '-'}</span>
                      <span>{format(new Date(lead.data_criacao), "dd/MM")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.valor_venda && (
                        <span className="font-semibold">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lead.valor_venda)}
                        </span>
                      )}
                      {lead.url_pipedrive && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, sortedLeads?.length || 0)} de {sortedLeads?.length || 0}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
