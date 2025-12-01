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
import { Users, TrendingUp, DollarSign, CheckCircle2, Calendar, ExternalLink, Search, Clock, Building2, Flame, Zap, Activity, Tag, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";

const Leads = () => {
  const { tipoFiltro, semanaSelecionada, getDataReferencia } = usePeriodo();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [scoreMinimo, setScoreMinimo] = useState<string>("");
  const [clienteStatusFilter, setClienteStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const availableStages = [
    { value: "Lead", label: "Lead" },
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
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar dados da semana se filtro for por semana
  const { data: semanaData } = useQuery({
    queryKey: ["semana", semanaSelecionada],
    queryFn: async () => {
      if (!semanaSelecionada) return null;
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .eq("id_semana", semanaSelecionada)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: tipoFiltro === "semana_especifica" && !!semanaSelecionada,
  });

  // Filtrar leads
  const filteredLeads = leads?.filter((lead) => {
    // Filtro de período
    const leadDate = parseISO(lead.data_criacao);
    let matchesPeriodo = true;

    if (tipoFiltro === "semana_especifica" && semanaData) {
      const dataInicio = parseISO(semanaData.data_inicio);
      const dataFim = parseISO(semanaData.data_fim);
      matchesPeriodo = leadDate >= dataInicio && leadDate <= dataFim;
    } else {
      const dataReferencia = getDataReferencia();
      const inicioMes = startOfMonth(dataReferencia);
      const fimMes = endOfMonth(dataReferencia);
      matchesPeriodo = leadDate >= inicioMes && leadDate <= fimMes;
    }

    const matchesSearch = 
      !searchTerm ||
      lead.nome_lead?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.organizacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    return matchesPeriodo && matchesSearch && matchesStatus && matchesStage && matchesScore && matchesClienteStatus;
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

  // Resetar para primeira página quando filtros mudarem
  const handleFilterChange = (setter: (value: any) => void) => (value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  // Função para alternar ordenação
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Se é uma nova coluna, ordena ascendente
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Resetar para primeira página
  };

  // Componente de header de tabela com ordenação
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

  // Função auxiliar para determinar engajamento baseado em última atividade
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

  // Calcular estatísticas baseadas nos leads filtrados
  const stats = {
    total: filteredLeads?.length || 0,
    novos: filteredLeads?.filter(l => !l.is_mql).length || 0,
    mqls: filteredLeads?.filter(l => l.is_mql).length || 0,
    mqlsPorScore: filteredLeads?.filter(l => l.is_mql && (l.mautic_score || 0) >= 50).length || 0,
    mqlsPorPageHits: filteredLeads?.filter(l => l.is_mql && (l.mautic_page_hits || 0) >= 10).length || 0,
    mqlsPorAmbos: filteredLeads?.filter(l => l.is_mql && (l.mautic_score || 0) >= 50 && (l.mautic_page_hits || 0) >= 10).length || 0,
    reunioes: filteredLeads?.filter(l => l.tem_reuniao).length || 0,
    vendas: filteredLeads?.filter(l => l.venda_realizada).length || 0,
    valorTotal: filteredLeads?.reduce((sum, l) => sum + (l.valor_venda || 0), 0) || 0,
    taxaConversaoMQL: filteredLeads?.length ? ((filteredLeads.filter(l => l.is_mql).length / filteredLeads.length) * 100).toFixed(1) : "0",
    taxaConversaoVenda: filteredLeads?.filter(l => l.is_mql).length ? 
      ((filteredLeads.filter(l => l.venda_realizada).length / filteredLeads.filter(l => l.is_mql).length) * 100).toFixed(1) : "0",
  };

  // Calcular tempo médio no funil baseado nos leads filtrados
  const tempoMedioFunil = filteredLeads?.filter(l => l.venda_realizada && l.data_venda).reduce((acc, l) => {
    const dias = differenceInDays(new Date(l.data_venda!), new Date(l.data_criacao));
    return acc + dias;
  }, 0) || 0;
  const tempoMedio = filteredLeads?.filter(l => l.venda_realizada).length 
    ? Math.round(tempoMedioFunil / filteredLeads.filter(l => l.venda_realizada).length)
    : 0;

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
        <FiltroPeriodo />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.novos} novos • {stats.mqls} MQLs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualificação MQL</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mqls}</div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground mt-1 cursor-help">
                    {stats.mqlsPorScore} score • {stats.mqlsPorPageHits} engajamento
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-medium">Critérios de MQL:</p>
                    <p>Score ≥ 50: {stats.mqlsPorScore} leads</p>
                    <p>Page Hits ≥ 10: {stats.mqlsPorPageHits} leads</p>
                    <p>Ambos: {stats.mqlsPorAmbos} leads</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversaoVenda}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              MQL → Venda • {stats.taxaConversaoMQL}% Lead → MQL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Fechadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.reunioes} com reunião agendada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }).format(stats.valorTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo médio: {tempoMedio} dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, organização ou empresa..."
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm)(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Leads</SelectItem>
              <SelectItem value="novo">Novos</SelectItem>
              <SelectItem value="mql">MQLs</SelectItem>
              <SelectItem value="reuniao">Com Reunião</SelectItem>
              <SelectItem value="venda">Vendas</SelectItem>
              <SelectItem value="nao_comprou">Não Comprou</SelectItem>
              <SelectItem value="perdido">Perdidos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={clienteStatusFilter} onValueChange={handleFilterChange(setClienteStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status Cliente" />
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
              <Button variant="outline" className="w-full sm:w-[200px] justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {stageFilter.length === 0 ? "Filtrar por stage" : `${stageFilter.length} selecionado(s)`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-4">
              <div className="space-y-4">
                <div className="font-medium text-sm">Selecione os stages</div>
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
                    <label
                      htmlFor={stage.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {stage.label}
                    </label>
                  </div>
                ))}
                {stageFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => handleFilterChange(setStageFilter)([])}
                  >
                    Limpar seleção
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            type="number"
            placeholder="Score mínimo"
            value={scoreMinimo}
            onChange={(e) => handleFilterChange(setScoreMinimo)(e.target.value)}
            className="w-full sm:w-[150px]"
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
              <CardDescription>
                Leads sincronizados do Pipedrive com informações detalhadas. Clique nos headers para ordenar.
              </CardDescription>
            </div>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="nome">Lead / Organização</SortableTableHead>
                  <SortableTableHead column="empresa">Empresa</SortableTableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableTableHead column="score">Score / Engajamento</SortableTableHead>
                  <SortableTableHead column="data">Criado em</SortableTableHead>
                  <SortableTableHead column="valor">Valor</SortableTableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads?.map((lead) => {
                  const diasNoFunil = differenceInDays(new Date(), new Date(lead.data_criacao));
                  const engajamento = getEngajamento(lead.mautic_last_active, lead.mautic_score);
                  const temDadosMautic = lead.mautic_score !== null || lead.mautic_tags || lead.cidade_mautic;
                  
                  return (
                    <TableRow key={lead.id_lead}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{lead.nome_lead || "Lead sem nome"}</span>
                          {lead.organizacao && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {lead.organizacao}
                            </span>
                          )}
                          {temDadosMautic && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {lead.mautic_tags && Array.isArray(lead.mautic_tags) && lead.mautic_tags.length > 0 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs cursor-help">
                                        <Tag className="h-3 w-3 mr-1" />
                                        {lead.mautic_tags.length} {lead.mautic_tags.length === 1 ? 'tag' : 'tags'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{lead.mautic_tags.join(', ')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {lead.cidade_mautic && (
                                <Badge variant="secondary" className="text-xs">
                                  {lead.cidade_mautic}{lead.estado_mautic ? ` - ${lead.estado_mautic}` : ''}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {(lead as any).empresa?.nome || "N/A"}
                      </TableCell>
                      <TableCell>
                        {lead.stage_atual ? (
                          <Badge variant="outline">{lead.stage_atual}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {/* Badge de Cliente/Ex-Cliente */}
                          {lead.cliente_status === "cliente" && (lead as any).cliente_notion && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 cursor-help">
                                    🟢 Cliente
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1 text-xs">
                                    {(lead as any).cliente_notion?.produtos_contratados?.length > 0 && (
                                      <p><strong>Produtos:</strong> {(lead as any).cliente_notion.produtos_contratados.join(', ')}</p>
                                    )}
                                    {(lead as any).cliente_notion?.anos_fiscais?.length > 0 && (
                                      <p><strong>Anos Fiscais:</strong> {(lead as any).cliente_notion.anos_fiscais.join(', ')}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {lead.cliente_status === "ex_cliente" && (lead as any).cliente_notion && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 cursor-help">
                                    🟡 Ex-Cliente
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1 text-xs">
                                    {(lead as any).cliente_notion?.produtos_contratados?.length > 0 && (
                                      <p><strong>Produtos:</strong> {(lead as any).cliente_notion.produtos_contratados.join(', ')}</p>
                                    )}
                                    {(lead as any).cliente_notion?.anos_fiscais?.length > 0 && (
                                      <p><strong>Anos Fiscais:</strong> {(lead as any).cliente_notion.anos_fiscais.join(', ')}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {lead.stage_atual === "Perdido" && (
                            <Badge variant="destructive">Perdido</Badge>
                          )}
                          {lead.stage_atual !== "Perdido" && !lead.is_mql && (
                            <Badge variant="secondary">Novo</Badge>
                          )}
                          {lead.stage_atual !== "Perdido" && lead.is_mql && (
                            <Badge variant="default">MQL</Badge>
                          )}
                          {lead.stage_atual !== "Perdido" && lead.tem_reuniao && (
                            <Badge variant="outline">Reunião</Badge>
                          )}
                          {lead.venda_realizada && (
                            <Badge className="bg-green-600">Venda</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.mautic_score !== null && lead.mautic_score !== undefined ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold text-lg">{lead.mautic_score}</span>
                            {engajamento && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className={`${engajamento.color} cursor-help`}>
                                      <engajamento.icon className="h-3 w-3 mr-1" />
                                      {engajamento.label}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      Última atividade: {lead.mautic_last_active 
                                        ? format(new Date(lead.mautic_last_active), "dd/MM/yyyy", { locale: ptBR })
                                        : 'N/A'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(lead.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {diasNoFunil} {diasNoFunil === 1 ? "dia" : "dias"} no funil
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {lead.valor_venda ? (
                          <span className="font-semibold">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(lead.valor_venda)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.url_pipedrive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={lead.url_pipedrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              Abrir no Pipedrive
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!sortedLeads || sortedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== "all" || scoreMinimo
                        ? "Nenhum lead encontrado com os filtros aplicados"
                        : "Nenhum lead encontrado"
                      }
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Exibindo {startIndex + 1} a {Math.min(endIndex, sortedLeads?.length || 0)} de {sortedLeads?.length || 0} leads
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Mostrar apenas algumas páginas (primeira, última, atual e vizinhas)
                    const showPage = 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    const showEllipsis = 
                      (page === currentPage - 2 && currentPage > 3) ||
                      (page === currentPage + 2 && currentPage < totalPages - 2);

                    if (showEllipsis) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }

                    if (!showPage) return null;

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