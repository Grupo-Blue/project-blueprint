import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ExportarListaModal } from "@/components/leads/ExportarListaModal";
import { ImportarLeadsModal } from "@/components/leads/ImportarLeadsModal";
import { HistoricoDisparos } from "@/components/leads/HistoricoDisparos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, TrendingUp, DollarSign, CheckCircle2, Calendar, ExternalLink, Search, Clock, Building2, Flame, Zap, Activity, Tag, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronRight, Mail, Globe, Target, Wallet, ShoppingCart, MapPin, History, AlertTriangle, Snowflake, Timer, X, Check, Download, ListFilter, Send, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getDiasNoStage, calcularScoreTemperatura, getPrioridade } from "@/lib/lead-scoring";
import { ImportarUsuariosTokeniza } from "@/components/ImportarUsuariosTokeniza";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { useIsMobile } from "@/hooks/use-mobile";
import { LeadCardMobile } from "@/components/leads/LeadCardMobile";
import { FiltrosMobileSheet } from "@/components/leads/FiltrosMobileSheet";
import { useLeadsRealtime } from "@/hooks/useLeadsRealtime";

// Helpers - Canal simplificado
const getCanal = (source: string | null) => {
  if (!source) return { icon: '🔗', label: 'Direto', color: 'text-muted-foreground' };
  const s = source.toLowerCase();
  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) return { icon: '📘', label: 'Facebook', color: 'text-blue-600' };
  if (s.includes('google')) return { icon: '🔍', label: 'Google', color: 'text-red-500' };
  if (s.includes('instagram') || s.includes('ig')) return { icon: '📱', label: 'Instagram', color: 'text-pink-500' };
  if (s.includes('email') || s.includes('mail')) return { icon: '📧', label: 'Email', color: 'text-emerald-600' };
  if (s.includes('linkedin')) return { icon: '💼', label: 'LinkedIn', color: 'text-blue-700' };
  if (s.includes('tiktok')) return { icon: '🎵', label: 'TikTok', color: 'text-foreground' };
  if (s.includes('youtube')) return { icon: '📺', label: 'YouTube', color: 'text-red-600' };
  return { icon: '🔗', label: 'Orgânico', color: 'text-muted-foreground' };
};

// Helper UTM Quality (para seção expandida)
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

// Mapeamento empresa -> slug para link Chatblue/WhatsApp
const EMPRESA_SLUG_MAP: Record<string, string> = {
  "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db": "blue-consult",
  "61b5ffeb-fbbc-47c1-8ced-152bb647ed20": "tokeniza",
  "6edd20a7-47ee-4c48-9719-c537a9869c66": "axia",
  "b1ffd679-0dce-4223-b516-dba7cd283bda": "mpuppe",
};

const getWhatsappLink = (lead: any): string => {
  const slug = EMPRESA_SLUG_MAP[lead.id_empresa] || "blue-consult";
  const telefone = (lead.telefone || "").replace(/\D/g, "");
  return `https://chat.grupoblue.com.br/open/${slug}/${telefone}`;
};

// getDiasNoStage, calcularScoreTemperatura e getPrioridade importados de @/lib/lead-scoring

// Helper para status principal simplificado
const getStatusPrincipal = (lead: any) => {
  if (lead.venda_realizada) return { label: 'Vendido', color: 'bg-green-600 text-white', icon: '💰' };
  if (lead.reuniao_realizada) return { label: 'Reunião OK', color: 'bg-purple-600 text-white', icon: '✅' };
  if (lead.tem_reuniao) return { label: 'Reunião', color: 'bg-purple-500 text-white', icon: '📅' };
  if (lead.levantou_mao) return { label: 'Engajado', color: 'bg-blue-500 text-white', icon: '🙋' };
  if (lead.is_mql) return { label: 'MQL', color: 'bg-blue-400 text-white', icon: '⭐' };
  return { label: 'Novo', color: 'bg-slate-200 text-slate-700', icon: '🆕' };
};

const Leads = () => {
  const { tipoFiltro, getDataReferencia } = usePeriodo();
  const { empresaSelecionada, empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Hook de realtime para novos leads
  useLeadsRealtime();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [scoreMinimo, setScoreMinimo] = useState<string>("");
  const [clienteStatusFilter, setClienteStatusFilter] = useState<string>("all");
  const [investidorFilter, setInvestidorFilter] = useState<string>("all");
  const [origemFilter, setOrigemFilter] = useState<string>("all");
  const [parados7DiasFilter, setParados7DiasFilter] = useState(false);
  const [alertaLeadIds, setAlertaLeadIds] = useState<string[] | null>(null);
  const [alertaTipo, setAlertaTipo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>("data_entrada");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Ler filtro de alerta da URL
  useEffect(() => {
    const alertaParam = searchParams.get("alerta");
    const idsParam = searchParams.get("ids");
    if (alertaParam && idsParam) {
      setAlertaTipo(alertaParam);
      setAlertaLeadIds(idsParam.split(","));
      // Limpar outros filtros
      setStatusFilter("all");
      setStageFilter([]);
      setScoreMinimo("");
      setClienteStatusFilter("all");
      setInvestidorFilter("all");
      setOrigemFilter("all");
      setParados7DiasFilter(false);
      setSearchTerm("");
      setCurrentPage(1);
    }
  }, [searchParams]);

  const ITEMS_PER_PAGE = 15;

  // Query para contagem total de leads por empresa (sem limite de 1000)
  const { data: leadsCountData } = useQuery({
    queryKey: ["leads-count", empresaSelecionada],
    queryFn: async () => {
      let countQuery = supabase
        .from("lead")
        .select("*", { count: "exact", head: true })
        .or("merged.is.null,merged.eq.false")
        .not("nome_lead", "like", "%(cópia)%");
      
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        countQuery = countQuery.eq("id_empresa", empresaSelecionada);
      }
      
      const { count, error } = await countQuery;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 2 * 60 * 1000, // Auto-refresh a cada 2 minutos
  });

  // Query para buscar todas as vendas do período (para cálculo correto do valor total)
  const dataReferencia = getDataReferencia();
  const inicioMesPeriodo = startOfMonth(dataReferencia);
  const fimMesPeriodo = endOfMonth(dataReferencia);
  
  const { data: vendasDoMes } = useQuery({
    queryKey: ["vendas-mes", empresaSelecionada, format(inicioMesPeriodo, "yyyy-MM-dd"), format(fimMesPeriodo, "yyyy-MM-dd")],
    queryFn: async () => {
      // Excluir "(cópia)" e merged para evitar duplicatas
      let vendasQuery = supabase
        .from("lead")
        .select("id_lead, nome_lead, email, valor_venda, data_venda, url_pipedrive")
        .eq("venda_realizada", true)
        .or("merged.is.null,merged.eq.false")
        .not("nome_lead", "like", "%(cópia)%")
        .gte("data_venda", inicioMesPeriodo.toISOString())
        .lte("data_venda", fimMesPeriodo.toISOString());
      
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        vendasQuery = vendasQuery.eq("id_empresa", empresaSelecionada);
      }
      
      const { data, error } = await vendasQuery;
      if (error) throw error;
      
      // Calcular soma e contagem
      const valorTotal = data?.reduce((sum, v) => sum + (v.valor_venda || 0), 0) || 0;
      const qtdVendas = data?.length || 0;
      
      return { valorTotal, qtdVendas, vendas: data || [] };
    },
    refetchInterval: 2 * 60 * 1000, // Auto-refresh a cada 2 minutos
  });

  const { data: leads, isLoading, isError: leadsError } = useQuery({
    queryKey: ["leads", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
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
        .not("nome_lead", "like", "%(cópia)%")
        .order("data_criacao", { ascending: false })
        .limit(1000);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    retry: 2,
    refetchInterval: 2 * 60 * 1000,
  });

  // Query para contar disparos ENVIADOS por lead
  const { data: disparosPorLead } = useQuery({
    queryKey: ["disparos-por-lead", empresaSelecionada],
    queryFn: async () => {
      // Primeiro buscar IDs dos disparos que foram de fato enviados
      const { data: disparosEnviados, error: errDisparos } = await supabase
        .from("disparo_whatsapp")
        .select("id, data_envio")
        .eq("enviado", true);
      if (errDisparos) throw errDisparos;
      if (!disparosEnviados || disparosEnviados.length === 0) return {};

      const idsEnviados = disparosEnviados.map(d => d.id);
      const dataEnvioMap: Record<string, string> = {};
      for (const d of disparosEnviados) {
        dataEnvioMap[d.id] = d.data_envio || "";
      }

      const { data, error } = await supabase
        .from("disparo_whatsapp_lead")
        .select("id_lead, id_disparo")
        .in("id_disparo", idsEnviados);
      if (error) throw error;

      // Agrupa por id_lead: { count, ultimo (data_envio mais recente) }
      const map: Record<string, { count: number; ultimo: string }> = {};
      for (const row of data || []) {
        const dataEnvio = dataEnvioMap[row.id_disparo] || "";
        if (!map[row.id_lead]) {
          map[row.id_lead] = { count: 0, ultimo: dataEnvio };
        }
        map[row.id_lead].count++;
        if (dataEnvio > map[row.id_lead].ultimo) {
          map[row.id_lead].ultimo = dataEnvio;
        }
      }
      return map;
    },
    refetchInterval: 5 * 60 * 1000,
  });

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

  // Filtrar leads (sem filtro de período - mostra todos os leads independente do mês)
  const filteredLeads = leads?.filter((lead) => {
    // Se há filtro de alerta ativo, filtrar exclusivamente por IDs
    if (alertaLeadIds && alertaLeadIds.length > 0) {
      const matchesEmpresa =
        !empresaSelecionada || empresaSelecionada === "todas" ||
        lead.id_empresa === empresaSelecionada;
      return alertaLeadIds.includes(lead.id_lead) && matchesEmpresa;
    }

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
      (statusFilter === "levantou" && lead.levantou_mao) ||
      (statusFilter === "nao_vendido" && !lead.venda_realizada);
    
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

    const matchesEmpresa =
      !empresaSelecionada || empresaSelecionada === "todas" ||
      lead.id_empresa === empresaSelecionada;

    const matchesInvestidor =
      investidorFilter === "all" ||
      (investidorFilter === "investidor" && lead.tokeniza_investidor === true) ||
      (investidorFilter === "carrinho" && lead.tokeniza_carrinho_abandonado === true) ||
      (investidorFilter === "nao_investidor" && !lead.tokeniza_investidor && !lead.tokeniza_carrinho_abandonado);

    const matchesOrigem =
      origemFilter === "all" ||
      (origemFilter === "pago" && lead.lead_pago === true) ||
      (origemFilter === "organico" && lead.lead_pago === false);

    // Filtro parados +7 dias
    const matchesParados7Dias = !parados7DiasFilter || (() => {
      const dias = getDiasNoStage(lead);
      const stagesFinais = ['Vendido', 'Perdido'];
      return dias > 7 && !stagesFinais.includes(lead.stage_atual || '') && !lead.venda_realizada;
    })();

    return matchesSearch && matchesStatus && matchesStage && matchesScore && matchesClienteStatus && matchesEmpresa && matchesInvestidor && matchesOrigem && matchesParados7Dias;
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
      case "entrada":
        valueA = new Date(a.data_criacao).getTime();
        valueB = new Date(b.data_criacao).getTime();
        break;
      case "valor":
        valueA = a.valor_venda || 0;
        valueB = b.valor_venda || 0;
        break;
      case "prioridade":
        valueA = getPrioridade(a).nivel;
        valueB = getPrioridade(b).nivel;
        break;
      case "dias":
        valueA = getDiasNoStage(a);
        valueB = getDiasNoStage(b);
        break;
      case "temperatura":
        valueA = calcularScoreTemperatura(a);
        valueB = calcularScoreTemperatura(b);
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

  // Quick Wins - Métricas de Ação
  const quickWins = {
    carrinhosParaRecuperar: filteredLeads?.filter(l => l.tokeniza_carrinho_abandonado && !l.tokeniza_investidor && !l.venda_realizada) || [],
    leadsParados7Dias: filteredLeads?.filter(l => {
      const dias = getDiasNoStage(l);
      const stagesFinais = ['Vendido', 'Perdido'];
      return dias > 7 && !stagesFinais.includes(l.stage_atual || '') && !l.venda_realizada;
    }) || [],
    reunioesAgendadas: filteredLeads?.filter(l => l.tem_reuniao && !l.venda_realizada) || [],
    emNegociacao: filteredLeads?.filter(l => ['Negociação', 'Aguardando pagamento'].includes(l.stage_atual || '') && !l.venda_realizada) || [],
  };

  const valorCarrinhos = quickWins.carrinhosParaRecuperar.reduce((sum, l) => sum + (l.tokeniza_valor_carrinho || 0), 0);
  const valorNegociacao = quickWins.emNegociacao.reduce((sum, l) => sum + (l.valor_venda || 0), 0);

  // Estatísticas gerais
  // Usa leadsCountData para total real quando sem filtros de busca/status
  // Usa vendasDoMes para valor total de vendas (evita limite de 1000)
  const hasActiveFilters = searchTerm || statusFilter !== "all" || stageFilter.length > 0 || 
    scoreMinimo || clienteStatusFilter !== "all" || investidorFilter !== "all" || 
    origemFilter !== "all" || parados7DiasFilter;
  
  const stats = {
    total: hasActiveFilters ? (filteredLeads?.length || 0) : (leadsCountData || filteredLeads?.length || 0),
    mqls: filteredLeads?.filter(l => l.is_mql).length || 0,
    reunioes: filteredLeads?.filter(l => l.tem_reuniao).length || 0,
    vendas: hasActiveFilters 
      ? (filteredLeads?.filter(l => l.venda_realizada).length || 0) 
      : (vendasDoMes?.qtdVendas || filteredLeads?.filter(l => l.venda_realizada).length || 0),
    valorTotal: hasActiveFilters
      ? (filteredLeads?.filter(l => l.venda_realizada).reduce((sum, l) => sum + (l.valor_venda || 0), 0) || 0)
      : (vendasDoMes?.valorTotal || 0),
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

  // Função para exportar vendas do mês em CSV
  const exportarVendas = () => {
    if (!vendasDoMes?.vendas || vendasDoMes.vendas.length === 0) return;
    
    const headers = ["Nome", "Email", "Valor", "Data da Venda", "Link Pipedrive"];
    const rows = vendasDoMes.vendas.map(v => [
      v.nome_lead || "",
      v.email || "",
      v.valor_venda?.toString() || "0",
      v.data_venda ? format(parseISO(v.data_venda), "dd/MM/yyyy") : "",
      v.url_pipedrive || ""
    ]);
    
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${format(inicioMesPeriodo, "yyyy-MM")}.csv`;
    link.click();
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

  if (leadsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">Erro ao carregar leads. Tente recarregar a página.</p>
          <Button onClick={() => window.location.reload()} variant="outline">Recarregar</Button>
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setImportModalOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar Leads
          </Button>
          <Button onClick={() => setExportModalOpen(true)} variant="outline">
            <Send className="h-4 w-4 mr-2" />
            Exportar Lista
          </Button>
          <ImportarUsuariosTokeniza />
        </div>
      </div>

      {/* Banner de alerta ativo */}
      {alertaTipo && alertaLeadIds && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/50">
          <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Exibindo {alertaLeadIds.length} lead(s) do alerta: {
                alertaTipo === "sla" ? "Sem primeira resposta" :
                alertaTipo === "orfao" ? "Sem proprietário" :
                alertaTipo === "levantada" ? "Levantou mão sem reunião" : alertaTipo
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAlertaTipo(null);
              setAlertaLeadIds(null);
              setSearchParams({});
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtro
          </Button>
        </div>
      )}

      {/* Quick Wins Cards - Ações Prioritárias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cn(
          "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
          quickWins.carrinhosParaRecuperar.length > 0 ? "border-l-orange-500 bg-orange-50/50" : "border-l-slate-200"
        )} onClick={() => setInvestidorFilter("carrinho")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
              Carrinhos para Recuperar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{quickWins.carrinhosParaRecuperar.length}</div>
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valorCarrinhos)}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
          parados7DiasFilter ? "border-l-red-600 bg-red-100 ring-2 ring-red-500" : quickWins.leadsParados7Dias.length > 0 ? "border-l-red-500 bg-red-50/50" : "border-l-slate-200"
        )} onClick={() => setParados7DiasFilter(!parados7DiasFilter)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Parados +7 dias
              {parados7DiasFilter && <Badge variant="secondary" className="ml-auto text-xs">Filtrado</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{quickWins.leadsParados7Dias.length}</div>
            <p className="text-xs text-muted-foreground">
              {parados7DiasFilter ? "Clique para remover filtro" : "Leads para ligar"}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
          quickWins.reunioesAgendadas.length > 0 ? "border-l-purple-500 bg-purple-50/50" : "border-l-slate-200"
        )} onClick={() => setStatusFilter("reuniao")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Reuniões Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{quickWins.reunioesAgendadas.length}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-l-4 cursor-pointer hover:shadow-md transition-shadow",
          quickWins.emNegociacao.length > 0 ? "border-l-emerald-500 bg-emerald-50/50" : "border-l-slate-200"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Em Negociação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{quickWins.emNegociacao.length}</div>
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valorNegociacao)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Métricas Gerais */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">MQLs</div>
          <div className="text-xl font-bold text-blue-600">{stats.mqls}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Reuniões</div>
          <div className="text-xl font-bold text-purple-600">{stats.reunioes}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Vendas</div>
          <div className="text-xl font-bold text-green-600">{stats.vendas}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Valor Total</div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5" 
              onClick={exportarVendas}
              title="Exportar vendas"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-lg font-bold">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats.valorTotal)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Investidores</div>
          <div className="text-xl font-bold text-amber-600">{stats.investidores}</div>
        </Card>
      </div>

      {/* Filters - Mobile vs Desktop */}
      {isMobile ? (
        <FiltrosMobileSheet
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          origemFilter={origemFilter}
          setOrigemFilter={setOrigemFilter}
          investidorFilter={investidorFilter}
          setInvestidorFilter={setInvestidorFilter}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          availableStages={[...new Set(leads?.map(l => l.stage_atual).filter(Boolean) as string[])].sort()}
        />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="nao_vendido">Não Vendido</SelectItem>
                  <SelectItem value="mql">MQLs</SelectItem>
                  <SelectItem value="levantou">Engajados</SelectItem>
                  <SelectItem value="reuniao">Com Reunião</SelectItem>
                  <SelectItem value="venda">Vendas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="organico">Orgânico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={investidorFilter} onValueChange={setInvestidorFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Investidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="investidor">Investidores</SelectItem>
                  <SelectItem value="carrinho">Carrinho Aband.</SelectItem>
                  <SelectItem value="nao_investidor">Não Investidor</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Filtro Multi-Select de Stage */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between">
                    <span className="truncate">
                      {stageFilter.length === 0 
                        ? "Todos Stages" 
                        : stageFilter.length === 1 
                          ? stageFilter[0] 
                          : `${stageFilter.length} stages`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <span className="text-sm font-medium">Filtrar por Stage</span>
                    {stageFilter.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => setStageFilter([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[250px] overflow-y-auto space-y-1">
                    {(() => {
                      // Extrair stages únicos dos leads
                      const uniqueStages = [...new Set(leads?.map(l => l.stage_atual).filter(Boolean) as string[])].sort();
                      return uniqueStages.map((stage) => (
                        <div
                          key={stage}
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => {
                            setStageFilter(prev => 
                              prev.includes(stage) 
                                ? prev.filter(s => s !== stage) 
                                : [...prev, stage]
                            );
                          }}
                        >
                          <Checkbox 
                            checked={stageFilter.includes(stage)} 
                            className="pointer-events-none"
                          />
                          <span className="text-sm flex-1">{stage}</span>
                          {stageFilter.includes(stage) && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table - Mobile vs Desktop */}
      {isMobile ? (
        /* Mobile Card List */
        <div className="space-y-3">
          {paginatedLeads?.map((lead) => (
            <LeadCardMobile
              key={lead.id_lead}
              lead={lead}
              isExpanded={expandedRows.has(lead.id_lead)}
              onToggleExpand={() => toggleRowExpansion(lead.id_lead)}
              disparoInfo={disparosPorLead?.[lead.id_lead]}
            />
          ))}
          
          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table */
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("nome")}>
                      <div className="flex items-center">Lead <SortIcon column="nome" /></div>
                    </TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("entrada")}>
                      <div className="flex items-center">Entrada <SortIcon column="entrada" /></div>
                    </TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("temperatura")}>
                      <div className="flex items-center">Prioridade <SortIcon column="temperatura" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("dias")}>
                      <div className="flex items-center">Dias <SortIcon column="dias" /></div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("valor")}>
                      <div className="flex items-center justify-end">Valor <SortIcon column="valor" /></div>
                    </TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads?.map((lead) => {
                    const prioridade = getPrioridade(lead);
                    const PrioridadeIcon = prioridade.icon;
                    const dias = getDiasNoStage(lead);
                    const canal = getCanal(lead.utm_source);
                    const statusPrincipal = getStatusPrincipal(lead);
                    const isCarrinhoAbandonado = lead.tokeniza_carrinho_abandonado && !lead.tokeniza_investidor;
                    const scoreTemp = prioridade.score;

                    return (
                      <Collapsible key={lead.id_lead} asChild open={expandedRows.has(lead.id_lead)}>
                        <>
                          <TableRow className={cn(
                            "hover:bg-muted/50",
                            isCarrinhoAbandonado && "bg-orange-50/70 border-l-4 border-l-orange-500"
                          )}>
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
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn("text-sm font-medium", canal.color)}>
                                {canal.icon} {canal.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {format(parseISO(lead.data_criacao), "dd/MM/yy")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={lead.stage_atual === "Vendido" ? "default" : "secondary"} className="text-xs">
                                {lead.stage_atual || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold w-fit",
                                prioridade.bgColor, prioridade.color
                              )}>
                                <PrioridadeIcon className="h-3 w-3" />
                                {prioridade.label}
                                <span className="font-mono text-[11px] opacity-80">{scoreTemp}°</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                "text-sm font-medium",
                                dias > 7 ? "text-red-600" : dias > 3 ? "text-yellow-600" : "text-muted-foreground"
                              )}>
                                {dias > 7 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                {dias}d
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge className={cn("text-xs", statusPrincipal.color)}>
                                  {statusPrincipal.icon} {statusPrincipal.label}
                                </Badge>
                                {lead.cliente_notion?.status_cliente === 'Cliente' && (
                                  <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
                                    ✅ Cliente
                                  </Badge>
                                )}
                                {lead.cliente_notion?.status_cliente === 'Ex-cliente' && (
                                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-300">
                                    👤 Ex-Cliente
                                  </Badge>
                                )}
                                {lead.tokeniza_investidor && (
                                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                    💰
                                  </Badge>
                                )}
                                {isCarrinhoAbandonado && (
                                  <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                    🛒
                                  </Badge>
                                )}
                                {disparosPorLead?.[lead.id_lead] && (
                                  <Badge variant="outline" className="text-xs bg-sky-100 text-sky-700 border-sky-300" title={`Último: ${format(parseISO(disparosPorLead[lead.id_lead].ultimo), "dd/MM/yy")}`}>
                                    <Send className="h-3 w-3 mr-0.5" />
                                    {disparosPorLead[lead.id_lead].count}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {lead.valor_venda ? (
                                <span className="font-semibold text-green-600">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.valor_venda)}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {lead.telefone && (
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={getWhatsappLink(lead)} target="_blank" rel="noopener noreferrer" title="Abrir no Chatblue">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-600">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                      </svg>
                                    </a>
                                  </Button>
                                )}
                                {lead.url_pipedrive && (
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Seção Expandida - 4 Colunas */}
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={10} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                  {/* Coluna 1: Histórico */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                      <History className="h-4 w-4" /> Histórico
                                    </h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Criado:</span>
                                        <span>{format(parseISO(lead.data_criacao), "dd/MM/yy")}</span>
                                      </div>
                                      {lead.data_mql && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">MQL:</span>
                                          <span>{format(parseISO(lead.data_mql), "dd/MM/yy")}</span>
                                        </div>
                                      )}
                                      {lead.data_levantou_mao && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Engajou:</span>
                                          <span>{format(parseISO(lead.data_levantou_mao), "dd/MM/yy")}</span>
                                        </div>
                                      )}
                                      {lead.data_reuniao && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Reunião:</span>
                                          <span>{format(parseISO(lead.data_reuniao), "dd/MM/yy")}</span>
                                        </div>
                                      )}
                                      {lead.data_venda && (
                                        <div className="flex justify-between text-green-600 font-medium">
                                          <span>Venda:</span>
                                          <span>{format(parseISO(lead.data_venda), "dd/MM/yy")}</span>
                                        </div>
                                      )}
                                      {lead.lead_evento && lead.lead_evento.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                          <span className="text-muted-foreground text-[10px] uppercase">Eventos:</span>
                                          {lead.lead_evento.slice(0, 3).map((evento: any, idx: number) => (
                                            <div key={idx} className="flex justify-between text-[11px]">
                                              <span className="text-muted-foreground truncate max-w-[80px]">{evento.etapa}</span>
                                              <span>{format(parseISO(evento.data_evento), "dd/MM")}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Coluna 2: Tracking/UTMs */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                      <Target className="h-4 w-4" /> Tracking
                                    </h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center gap-1 mb-2">
                                        <span className="text-muted-foreground">Qualidade:</span>
                                        <span>{getUtmQuality(lead).badge} {getUtmQuality(lead).label}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Source:</span>
                                        <span className="truncate max-w-[100px]">{lead.utm_source || "-"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Medium:</span>
                                        <span className="truncate max-w-[100px]">{lead.utm_medium || "-"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Campaign:</span>
                                        <span className="truncate max-w-[100px]">{lead.utm_campaign || "-"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Content:</span>
                                        <span className="truncate max-w-[100px]">{lead.utm_content || "-"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Coluna 3: Engajamento */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                      <Activity className="h-4 w-4" /> Engajamento
                                    </h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Score:</span>
                                        <Badge variant={lead.mautic_score >= 50 ? "default" : "secondary"} className="text-[10px]">
                                          {lead.mautic_score || 0}
                                        </Badge>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Page Hits:</span>
                                        <span>{lead.mautic_page_hits || 0}</span>
                                      </div>
                                      {lead.mautic_first_visit && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">1ª Visita:</span>
                                          <span>{format(parseISO(lead.mautic_first_visit), "dd/MM/yy")}</span>
                                        </div>
                                      )}
                                      {(lead.cidade_mautic || lead.estado_mautic) && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Local:</span>
                                          <span>{lead.cidade_mautic || ""}{lead.cidade_mautic && lead.estado_mautic ? ", " : ""}{lead.estado_mautic || ""}</span>
                                        </div>
                                      )}
                                      {lead.mautic_tags && Array.isArray(lead.mautic_tags) && lead.mautic_tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {lead.mautic_tags.slice(0, 3).map((tag: any, idx: number) => (
                                            <Badge key={idx} variant="outline" className="text-[9px] px-1">
                                              {typeof tag === 'string' ? tag : tag.tag}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {(lead.chatwoot_contact_id || lead.chatwoot_conversas_total > 0) && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                          <span className="text-muted-foreground text-[10px] uppercase">Atendimento:</span>
                                          <div className="flex justify-between mt-1">
                                            <span className="text-muted-foreground">Status:</span>
                                            <Badge variant="outline" className={cn(
                                              "text-[10px]",
                                              lead.chatwoot_status_atendimento === 'open' ? "bg-green-100 text-green-700" :
                                              lead.chatwoot_status_atendimento === 'resolved' ? "bg-blue-100 text-blue-700" : ""
                                            )}>
                                              {lead.chatwoot_status_atendimento || '-'}
                                            </Badge>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Conversas:</span>
                                            <span>{lead.chatwoot_conversas_total || 0}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Coluna 4: Dados Extra */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                      <Wallet className="h-4 w-4" /> Dados Extra
                                    </h4>
                                    <div className="space-y-1 text-xs">
                                      {lead.telefone && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Telefone:</span>
                                          <span className="font-medium">{lead.telefone}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Investidor:</span>
                                        <span className={lead.tokeniza_investidor ? "text-green-600 font-medium" : ""}>
                                          {lead.tokeniza_investidor ? "✓ Sim" : "Não"}
                                        </span>
                                      </div>
                                      {lead.tokeniza_valor_investido > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Investido:</span>
                                          <span className="text-green-600 font-medium">
                                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.tokeniza_valor_investido)}
                                          </span>
                                        </div>
                                      )}
                                      {isCarrinhoAbandonado && lead.tokeniza_valor_carrinho > 0 && (
                                        <div className="flex justify-between text-orange-600">
                                          <span>🛒 Carrinho:</span>
                                          <span className="font-medium">
                                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.tokeniza_valor_carrinho)}
                                          </span>
                                        </div>
                                      )}
                                      {lead.cliente_notion && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                          <span className="text-muted-foreground text-[10px] uppercase">Cliente Notion:</span>
                                          <div className="flex justify-between mt-1">
                                            <span className="text-muted-foreground">Status:</span>
                                            <Badge variant="outline" className={cn(
                                              "text-[10px]",
                                              lead.cliente_notion.status_cliente === "Cliente" ? "bg-green-100 text-green-700" : "bg-slate-100"
                                            )}>
                                              {lead.cliente_notion.status_cliente}
                                            </Badge>
                                          </div>
                                        </div>
                                      )}
                                      {lead.organizacao && (
                                        <div className="flex justify-between mt-1">
                                          <span className="text-muted-foreground">Org:</span>
                                          <span className="truncate max-w-[100px]">{lead.organizacao}</span>
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
                </TableBody>
              </Table>
            </div>

            {/* Desktop Pagination */}
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
      )}

      {/* Histórico de Disparos */}
      <HistoricoDisparos />

      {/* Modal de Exportação */}
      <ExportarListaModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        leads={leads || []}
      />

      {/* Modal de Importação */}
      <ImportarLeadsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />
    </div>
  );
};

export default Leads;
