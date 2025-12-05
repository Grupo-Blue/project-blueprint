import { useState } from "react";
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
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ImportarUsuariosTokeniza } from "@/components/ImportarUsuariosTokeniza";
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
  const { empresaSelecionada, empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [scoreMinimo, setScoreMinimo] = useState<string>("");
  const [clienteStatusFilter, setClienteStatusFilter] = useState<string>("all");
  const [investidorFilter, setInvestidorFilter] = useState<string>("all");
  const [origemFilter, setOrigemFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
      lead.stage_atual?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "mql" && lead.is_mql) ||
      (statusFilter === "reuniao" && lead.tem_reuniao) ||
      (statusFilter === "venda" && lead.venda_realizada) ||
      (statusFilter === "levantou" && lead.levantou_mao);
    
    const matchesStage =
      stageFilter.length === 0 ||
      stageFilter.includes(lead.stage_atual || "");
    
    const matchesScore =
      !scoreMinimo ||
      (lead.mautic_score !== null && lead.mautic_score >= parseInt(scoreMinimo));

    const matchesClienteStatus =
      clienteStatusFilter === "all" ||
      (clienteStatusFilter === "cliente" && lead.cliente_notion?.status_cliente === "Cliente") ||
      (clienteStatusFilter === "ex_cliente" && lead.cliente_notion?.status_cliente === "Ex-cliente") ||
      (clienteStatusFilter === "sem_vinculo" && !lead.cliente_notion);

    // Filtro de empresa usando contexto global
    const matchesEmpresa =
      !empresaSelecionada || empresaSelecionada === "todas" ||
      lead.id_empresa === empresaSelecionada;

    // Filtro de investidor Tokeniza
    const matchesInvestidor =
      investidorFilter === "all" ||
      (investidorFilter === "investidor" && lead.tokeniza_investidor === true) ||
      (investidorFilter === "carrinho" && lead.tokeniza_carrinho_abandonado === true) ||
      (investidorFilter === "nao_investidor" && !lead.tokeniza_investidor && !lead.tokeniza_carrinho_abandonado);

    // Filtro de origem
    const matchesOrigem =
      origemFilter === "all" ||
      (origemFilter === "pago" && lead.lead_pago === true) ||
      (origemFilter === "organico" && lead.lead_pago === false);

    return matchesPeriodo && matchesSearch && matchesStatus && matchesStage && matchesScore && matchesClienteStatus && matchesEmpresa && matchesInvestidor && matchesOrigem;
  });

  // Ordenar leads
  const sortedLeads = [...(filteredLeads || [])].sort((a, b) => {
    if (!sortColumn) return 0;

    let valueA: any;
    let valueB: any;

    switch (sortColumn) {
      case "nome":
        valueA = a.nome_lead || "";
        valueB = b.nome_lead || "";
        break;
      case "data":
        valueA = new Date(a.data_criacao).getTime();
        valueB = new Date(b.data_criacao).getTime();
        break;
      case "valor":
        valueA = a.valor_venda || 0;
        valueB = b.valor_venda || 0;
        break;
      case "score":
        valueA = a.mautic_score || 0;
        valueB = b.mautic_score || 0;
        break;
      case "investimento":
        valueA = a.tokeniza_valor_investido || 0;
        valueB = b.tokeniza_valor_investido || 0;
        break;
      default:
        return 0;
    }

    if (sortDirection === "asc") {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });

  // Paginação
  const totalPages = Math.ceil((sortedLeads?.length || 0) / ITEMS_PER_PAGE);
  const paginatedLeads = sortedLeads?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Estatísticas
  const stats = {
    total: filteredLeads?.length || 0,
    mqls: filteredLeads?.filter(l => l.is_mql).length || 0,
    reunioes: filteredLeads?.filter(l => l.tem_reuniao).length || 0,
    vendas: filteredLeads?.filter(l => l.venda_realizada).length || 0,
    valorTotal: filteredLeads?.reduce((sum, l) => sum + (l.valor_venda || 0), 0) || 0,
    investidores: filteredLeads?.filter(l => l.tokeniza_investidor).length || 0,
    carrinhosAbandonados: filteredLeads?.filter(l => l.tokeniza_carrinho_abandonado && !l.tokeniza_investidor).length || 0,
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (loadingEmpresas || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Gestão e acompanhamento de leads do CRM
          </p>
        </div>
        <ImportarUsuariosTokeniza />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MQLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.mqls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reuniões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.reunioes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.vendas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats.valorTotal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3" /> Investidores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.investidores}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Carrinhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.carrinhosAbandonados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, organização, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mql">MQLs</SelectItem>
                <SelectItem value="levantou">Levantou Mão</SelectItem>
                <SelectItem value="reuniao">Com Reunião</SelectItem>
                <SelectItem value="venda">Vendas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={setOrigemFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="organico">Orgânico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={investidorFilter} onValueChange={setInvestidorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Investidor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="investidor">Investidores</SelectItem>
                <SelectItem value="carrinho">Carrinho Abandonado</SelectItem>
                <SelectItem value="nao_investidor">Não Investidor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("nome")}>
                    <div className="flex items-center">Lead <SortIcon column="nome" /></div>
                  </TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("score")}>
                    <div className="flex items-center">Score <SortIcon column="score" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("data")}>
                    <div className="flex items-center">Data <SortIcon column="data" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("valor")}>
                    <div className="flex items-center justify-end">Valor <SortIcon column="valor" /></div>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads?.map((lead) => (
                  <Collapsible key={lead.id_lead} asChild open={expandedRows.has(lead.id_lead)}>
                    <>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleRowExpansion(lead.id_lead)}>
                              {expandedRows.has(lead.id_lead) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{lead.nome_lead || "Sem nome"}</span>
                            {lead.email && <span className="text-xs text-muted-foreground">{lead.email}</span>}
                            {lead.organizacao && <span className="text-xs text-muted-foreground">{lead.organizacao}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {lead.utm_source && (
                              <Badge variant="outline" className="text-xs w-fit">
                                {getOrigemIcon(lead.utm_source)?.icon} {lead.utm_source}
                              </Badge>
                            )}
                            <span className="text-xs">{getUtmQuality(lead).badge} UTM</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.stage_atual === "Vendido" ? "default" : "secondary"}>
                            {lead.stage_atual || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {lead.is_mql && <Badge variant="outline" className="text-xs">MQL</Badge>}
                            {lead.levantou_mao && <Badge variant="outline" className="text-xs">🙋</Badge>}
                            {lead.tem_reuniao && <Badge variant="outline" className="text-xs">📅</Badge>}
                            {lead.venda_realizada && <Badge className="text-xs bg-green-600">💰</Badge>}
                            {lead.tokeniza_investidor && <Badge className="text-xs bg-amber-600">Investidor</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.mautic_score !== null ? (
                            <Badge variant={lead.mautic_score >= 50 ? "default" : "secondary"}>
                              {lead.mautic_score}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{format(parseISO(lead.data_criacao), "dd/MM/yy")}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {lead.valor_venda ? (
                            <span className="font-semibold text-green-600">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.valor_venda)}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {lead.url_pipedrive && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              {/* UTMs */}
                              <div>
                                <h4 className="font-semibold mb-2">UTM Parameters</h4>
                                <div className="space-y-1 text-xs">
                                  <p><span className="text-muted-foreground">Source:</span> {lead.utm_source || "-"}</p>
                                  <p><span className="text-muted-foreground">Medium:</span> {lead.utm_medium || "-"}</p>
                                  <p><span className="text-muted-foreground">Campaign:</span> {lead.utm_campaign || "-"}</p>
                                  <p><span className="text-muted-foreground">Content:</span> {lead.utm_content || "-"}</p>
                                </div>
                              </div>
                              {/* Mautic */}
                              <div>
                                <h4 className="font-semibold mb-2">Mautic Data</h4>
                                <div className="space-y-1 text-xs">
                                  <p><span className="text-muted-foreground">Score:</span> {lead.mautic_score || "-"}</p>
                                  <p><span className="text-muted-foreground">Page Hits:</span> {lead.mautic_page_hits || "-"}</p>
                                  <p><span className="text-muted-foreground">Location:</span> {lead.cidade_mautic || "-"}, {lead.estado_mautic || "-"}</p>
                                </div>
                              </div>
                              {/* Tokeniza */}
                              <div>
                                <h4 className="font-semibold mb-2">Tokeniza</h4>
                                <div className="space-y-1 text-xs">
                                  <p><span className="text-muted-foreground">Investidor:</span> {lead.tokeniza_investidor ? "Sim" : "Não"}</p>
                                  <p><span className="text-muted-foreground">Valor Investido:</span> {lead.tokeniza_valor_investido ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.tokeniza_valor_investido) : "-"}</p>
                                  <p><span className="text-muted-foreground">Projeto:</span> {lead.tokeniza_projeto_nome || "-"}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = i + 1;
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
                  {totalPages > 5 && <PaginationEllipsis />}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
