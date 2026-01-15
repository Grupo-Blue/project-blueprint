import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, TrendingUp, AlertTriangle, ArrowUpDown, RefreshCw, Download, Image, Video, FileText, BarChart3, ExternalLink, CloudDownload } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface CriativoPerformance {
  id_criativo: string;
  descricao: string | null;
  tipo: string;
  campanha_nome: string;
  impressoes: number;
  cliques: number;
  verba_investida: number;
  ctr: number;
  total_leads: number;
  mqls: number;
  vendas: number;
  valor_total_vendas: number;
  cpl: number;
  roas: number;
  url_preview?: string | null;
  url_midia?: string | null;
  id_anuncio_externo?: string | null;
  id_criativo_externo?: string | null;
  plataforma?: string | null;
  id_conta_externo?: string | null;
}

type OrdenacaoCampo = 'leads' | 'roas' | 'cpl' | 'verba' | 'vendas' | 'ctr' | 'impressoes';
type PeriodoFiltro = '7d' | '30d' | 'mes_atual' | 'mes_anterior' | 'todos';

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'IMAGE': case 'IMAGEM': return <Image className="h-4 w-4" />;
    case 'VIDEO': return <Video className="h-4 w-4" />;
    case 'CAROUSEL': case 'CARROSSEL': return <FileText className="h-4 w-4" />;
    default: return <BarChart3 className="h-4 w-4" />;
  }
};

const getExternalLink = (criativo: CriativoPerformance): { url: string; label: string } | null => {
  // Se tiver url_preview direto (shareable link do Facebook), usar ele
  if (criativo.url_preview) {
    return { url: criativo.url_preview, label: "Ver Preview" };
  }
  
  // Para Meta, montar link do Ads Manager com o ID do anúncio
  if (criativo.plataforma === "META") {
    const adId = criativo.id_anuncio_externo;
    if (adId) {
      const actId = criativo.id_conta_externo?.replace("act_", "") || "";
      return { 
        url: `https://www.facebook.com/adsmanager/manage/ads?act=${actId}&selected_ad_ids=${adId}`,
        label: "Abrir no Ads Manager"
      };
    }
    // Fallback: link genérico para o Ads Manager da conta
    if (criativo.id_conta_externo) {
      const actId = criativo.id_conta_externo.replace("act_", "");
      return {
        url: `https://www.facebook.com/adsmanager/manage/ads?act=${actId}`,
        label: "Abrir Ads Manager"
      };
    }
  } else if (criativo.plataforma === "GOOGLE") {
    const adId = criativo.id_anuncio_externo || criativo.id_criativo_externo;
    if (adId) {
      return { 
        url: `https://ads.google.com/aw/ads?adId=${adId}`,
        label: "Ver no Google Ads"
      };
    }
  }
  
  return null;
};

const RelatorioCreativos = () => {
  const { empresaSelecionada } = useEmpresa();
  const [criativoSelecionado, setCriativoSelecionado] = useState<string | null>(null);
  const [criativoPreview, setCriativoPreview] = useState<CriativoPerformance | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ campo: OrdenacaoCampo; direcao: 'asc' | 'desc' }>({ campo: 'verba', direcao: 'desc' });
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [mostrarSemLeads, setMostrarSemLeads] = useState(false);

  const getDatasDoPeríodo = () => {
    const hoje = new Date();
    switch (periodo) {
      case '7d': return { inicio: subDays(hoje, 7), fim: hoje };
      case '30d': return { inicio: subDays(hoje, 30), fim: hoje };
      case 'mes_atual': return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) };
      case 'mes_anterior': const m = subMonths(hoje, 1); return { inicio: startOfMonth(m), fim: endOfMonth(m) };
      default: return { inicio: null, fim: null };
    }
  };

  const { inicio: dataInicio, fim: dataFim } = getDatasDoPeríodo();

  const { data: leadsCriativo } = useQuery({
    queryKey: ["leads-criativo", criativoSelecionado],
    queryFn: async () => {
      if (!criativoSelecionado) return [];
      const { data } = await supabase.from("lead").select("*").eq("id_criativo", criativoSelecionado).order("data_criacao", { ascending: false });
      return data || [];
    },
    enabled: !!criativoSelecionado,
  });

  const { data: criativos, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["criativos-performance-v2", empresaSelecionada, periodo, mostrarSemLeads],
    queryFn: async () => {
      if (!empresaSelecionada) return [];

      const { data: criativosData } = await supabase.from("criativo").select(`id_criativo, descricao, tipo, url_preview, url_midia, id_anuncio_externo, id_criativo_externo, campanha:id_campanha(nome, conta_anuncio:id_conta(id_empresa, id_externo, plataforma))`).eq("ativo", true);
      const criativosDaEmpresa = (criativosData || []).filter((c) => c.campanha?.conta_anuncio?.id_empresa === empresaSelecionada);
      if (criativosDaEmpresa.length === 0) return [];

      const ids = criativosDaEmpresa.map((c) => c.id_criativo);

      let qMetricas = supabase.from("criativo_metricas_dia").select("*").in("id_criativo", ids);
      if (dataInicio && dataFim) qMetricas = qMetricas.gte("data", format(dataInicio, "yyyy-MM-dd")).lte("data", format(dataFim, "yyyy-MM-dd"));
      const { data: metricasData } = await qMetricas;

      const metricasPorCriativo: Record<string, { impressoes: number; cliques: number; verba: number }> = {};
      (metricasData || []).forEach((m) => {
        if (!metricasPorCriativo[m.id_criativo]) metricasPorCriativo[m.id_criativo] = { impressoes: 0, cliques: 0, verba: 0 };
        metricasPorCriativo[m.id_criativo].impressoes += m.impressoes || 0;
        metricasPorCriativo[m.id_criativo].cliques += m.cliques || 0;
        metricasPorCriativo[m.id_criativo].verba += m.verba_investida || 0;
      });

      let qLeads = supabase.from("lead").select("id_criativo, stage_atual, is_mql, venda_realizada, valor_venda").in("id_criativo", ids);
      if (dataInicio && dataFim) qLeads = qLeads.gte("data_criacao", format(dataInicio, "yyyy-MM-dd")).lte("data_criacao", format(dataFim, "yyyy-MM-dd"));
      const { data: leadsData } = await qLeads;

      const leadsPorCriativo: Record<string, { total: number; mqls: number; vendas: number; valor: number }> = {};
      (leadsData || []).forEach((l) => {
        if (!l.id_criativo) return;
        if (!leadsPorCriativo[l.id_criativo]) leadsPorCriativo[l.id_criativo] = { total: 0, mqls: 0, vendas: 0, valor: 0 };
        leadsPorCriativo[l.id_criativo].total += 1;
        if (l.is_mql) leadsPorCriativo[l.id_criativo].mqls += 1;
        if (l.venda_realizada) { leadsPorCriativo[l.id_criativo].vendas += 1; leadsPorCriativo[l.id_criativo].valor += l.valor_venda || 0; }
      });

      const result: CriativoPerformance[] = criativosDaEmpresa.map((c) => {
        const m = metricasPorCriativo[c.id_criativo] || { impressoes: 0, cliques: 0, verba: 0 };
        const l = leadsPorCriativo[c.id_criativo] || { total: 0, mqls: 0, vendas: 0, valor: 0 };
        return {
          id_criativo: c.id_criativo, descricao: c.descricao, tipo: c.tipo, campanha_nome: c.campanha?.nome || "-",
          impressoes: m.impressoes, cliques: m.cliques, verba_investida: m.verba,
          ctr: m.impressoes > 0 ? (m.cliques / m.impressoes) * 100 : 0,
          total_leads: l.total, mqls: l.mqls, vendas: l.vendas, valor_total_vendas: l.valor,
          cpl: l.total > 0 ? m.verba / l.total : 0,
          roas: m.verba > 0 ? l.valor / m.verba : 0,
          url_preview: c.url_preview,
          url_midia: c.url_midia,
          id_anuncio_externo: c.id_anuncio_externo,
          id_criativo_externo: c.id_criativo_externo,
          plataforma: c.campanha?.conta_anuncio?.plataforma,
          id_conta_externo: c.campanha?.conta_anuncio?.id_externo,
        };
      });

      return mostrarSemLeads ? result : result.filter((c) => c.total_leads > 0 || c.verba_investida > 0);
    },
    enabled: !!empresaSelecionada,
    refetchInterval: 5 * 60 * 1000,
  });

  const criativosOrdenados = [...(criativos || [])].sort((a, b) => {
    const getVal = (c: CriativoPerformance) => {
      switch (ordenacao.campo) {
        case 'leads': return c.total_leads; case 'roas': return c.roas; case 'cpl': return c.cpl;
        case 'verba': return c.verba_investida; case 'vendas': return c.valor_total_vendas;
        case 'ctr': return c.ctr; case 'impressoes': return c.impressoes; default: return c.verba_investida;
      }
    };
    return ordenacao.direcao === 'desc' ? getVal(b) - getVal(a) : getVal(a) - getVal(b);
  });

  const criativosSemLeads = (criativos || []).filter((c) => c.verba_investida > 0 && c.total_leads === 0);
  const verbaPerdida = criativosSemLeads.reduce((s, c) => s + c.verba_investida, 0);

  const stats = {
    total: criativos?.length || 0,
    investido: criativos?.reduce((s, c) => s + c.verba_investida, 0) || 0,
    leads: criativos?.reduce((s, c) => s + c.total_leads, 0) || 0,
    vendas: criativos?.reduce((s, c) => s + c.vendas, 0) || 0,
    receita: criativos?.reduce((s, c) => s + c.valor_total_vendas, 0) || 0,
    roas: (() => { const i = criativos?.reduce((s, c) => s + c.verba_investida, 0) || 0; const r = criativos?.reduce((s, c) => s + c.valor_total_vendas, 0) || 0; return i > 0 ? r / i : 0; })(),
  };

  const alternarOrdenacao = (campo: OrdenacaoCampo) => setOrdenacao({ campo, direcao: ordenacao.campo === campo && ordenacao.direcao === 'desc' ? 'asc' : 'desc' });
  const formatNumber = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0);
  const exportarPDF = () => { const doc = new jsPDF(); doc.text("Relatório de Criativos", 20, 20); doc.text(`Criativos: ${stats.total} | Investido: R$ ${stats.investido.toFixed(2)} | ROAS: ${stats.roas.toFixed(2)}x`, 20, 30); doc.save("relatorio-criativos.pdf"); };

  const criativosSemPreview = (criativos || []).filter((c) => !c.url_preview && !c.url_midia).length;

  const sincronizarPreviews = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("atualizar-preview-criativos", {
        body: { max_criativos: 50, apenas_ativos: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.estatisticas?.atualizados || 0} previews atualizados`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  if (isLoading) return <div className="p-6 space-y-6"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Relatório de Criativos</h1><p className="text-muted-foreground">Performance completa com métricas de funil e ROAS</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7d">Últimos 7 dias</SelectItem><SelectItem value="30d">Últimos 30 dias</SelectItem><SelectItem value="mes_atual">Mês atual</SelectItem><SelectItem value="mes_anterior">Mês anterior</SelectItem><SelectItem value="todos">Todo período</SelectItem></SelectContent></Select>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md"><Switch id="sem-leads" checked={mostrarSemLeads} onCheckedChange={setMostrarSemLeads} /><Label htmlFor="sem-leads" className="text-sm">Sem leads</Label></div>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          {criativosSemPreview > 0 && (
            <Button variant="outline" size="sm" onClick={() => sincronizarPreviews.mutate()} disabled={sincronizarPreviews.isPending}>
              <CloudDownload className={`h-4 w-4 mr-1 ${sincronizarPreviews.isPending ? "animate-spin" : ""}`} />
              Sincronizar Previews ({criativosSemPreview})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportarPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      {criativosSemLeads.length > 0 && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Verba sem conversão</AlertTitle><AlertDescription>{criativosSemLeads.length} criativos gastaram R$ {verbaPerdida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} sem leads.</AlertDescription></Alert>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[{ label: "Criativos", value: stats.total }, { label: "Investido", value: `R$ ${formatNumber(stats.investido)}` }, { label: "Leads", value: stats.leads }, { label: "Vendas", value: stats.vendas }, { label: "Receita", value: `R$ ${formatNumber(stats.receita)}` }, { label: "ROAS", value: `${stats.roas.toFixed(2)}x`, icon: stats.roas >= 1 ? <TrendingUp className="h-4 w-4 text-green-500" /> : null }].map((s, i) => (
          <Card key={i}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-1">{s.value}{s.icon}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex justify-between"><span>Performance por Criativo</span>{dataUpdatedAt && <span className="text-xs font-normal text-muted-foreground">Atualizado {format(new Date(dataUpdatedAt), "HH:mm")}</span>}</CardTitle></CardHeader>
        <CardContent>
          {criativosOrdenados.length === 0 ? <div className="text-center py-8 text-muted-foreground">Nenhum criativo encontrado.</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Criativo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('impressoes')}>Impressões {ordenacao.campo === 'impressoes' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('ctr')}>CTR {ordenacao.campo === 'ctr' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('verba')}>Verba {ordenacao.campo === 'verba' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('leads')}>Leads {ordenacao.campo === 'leads' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">MQLs</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('vendas')}>Vendas {ordenacao.campo === 'vendas' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => alternarOrdenacao('roas')}>ROAS {ordenacao.campo === 'roas' && <ArrowUpDown className="h-3 w-3 inline" />}</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criativosOrdenados.map((c) => (
                    <TableRow key={c.id_criativo} className={c.verba_investida > 0 && c.total_leads === 0 ? "bg-destructive/10" : ""}>
                      <TableCell><div className="flex flex-col cursor-pointer hover:text-primary" onClick={() => setCriativoPreview(c)}><span className="font-medium truncate max-w-[180px]">{c.descricao || c.id_criativo.slice(0, 8)}</span><span className="text-xs text-muted-foreground truncate">{c.campanha_nome}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="gap-1">{getTipoIcon(c.tipo)}{c.tipo}</Badge></TableCell>
                      <TableCell className="text-right">{formatNumber(c.impressoes)}</TableCell>
                      <TableCell className="text-right"><Badge variant={c.ctr >= 1 ? "default" : "secondary"}>{c.ctr.toFixed(2)}%</Badge></TableCell>
                      <TableCell className="text-right">R$ {c.verba_investida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium">{c.total_leads}</TableCell>
                      <TableCell className="text-right">{c.cpl > 0 ? `R$ ${c.cpl.toFixed(2)}` : "-"}</TableCell>
                      <TableCell className="text-right">{c.mqls}</TableCell>
                      <TableCell className="text-right">{c.vendas > 0 ? <div><span className="font-medium">{c.vendas}</span><br /><span className="text-xs text-muted-foreground">R$ {c.valor_total_vendas.toLocaleString("pt-BR")}</span></div> : "-"}</TableCell>
                      <TableCell className="text-right"><Badge variant={c.roas >= 1 ? "default" : "secondary"} className={c.roas >= 3 ? "bg-green-500" : c.roas >= 1 ? "bg-blue-500" : ""}>{c.roas.toFixed(2)}x</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => setCriativoSelecionado(c.id_criativo)} disabled={c.total_leads === 0}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!criativoSelecionado} onOpenChange={() => setCriativoSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Leads do Criativo</DialogTitle></DialogHeader>
          {leadsCriativo && leadsCriativo.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Entrada</TableHead><TableHead>Venda</TableHead></TableRow></TableHeader>
              <TableBody>{leadsCriativo.map((l) => (<TableRow key={l.id_lead}><TableCell>{l.nome_lead || "-"}</TableCell><TableCell>{l.email || "-"}</TableCell><TableCell><Badge variant="outline">{l.stage_atual || "Novo"}</Badge></TableCell><TableCell>{l.data_criacao ? format(new Date(l.data_criacao), "dd/MM/yyyy") : "-"}</TableCell><TableCell>{l.venda_realizada ? <span className="text-green-600">R$ {(l.valor_venda || 0).toLocaleString("pt-BR")}</span> : "-"}</TableCell></TableRow>))}</TableBody>
            </Table>
          ) : <div className="text-center py-8 text-muted-foreground">Nenhum lead encontrado.</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!criativoPreview} onOpenChange={() => setCriativoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTipoIcon(criativoPreview?.tipo || "")} 
              {criativoPreview?.descricao || "Criativo"}
              <Badge variant="outline" className="ml-2">{criativoPreview?.tipo}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <span>Campanha: {criativoPreview?.campanha_nome}</span>
              {criativoPreview?.plataforma && (
                <Badge variant="secondary">{criativoPreview.plataforma}</Badge>
              )}
            </div>
            
            {(() => {
              const mediaUrl = criativoPreview?.url_midia;
              const previewUrl = criativoPreview?.url_preview;
              const tipo = criativoPreview?.tipo;
              const isVideo = tipo === "VIDEO";
              const isCarrossel = tipo === "CARROSSEL" || tipo === "CAROUSEL";
              const directMediaUrl = mediaUrl && !mediaUrl.includes('fb.me') && !mediaUrl.includes('facebook.com');
              
              // Para imagens com URL direta
              if (directMediaUrl && !isVideo && !isCarrossel) {
                return (
                  <div className="flex justify-center bg-muted rounded-lg p-4 min-h-[300px]">
                    <img 
                      src={mediaUrl} 
                      alt={criativoPreview?.descricao || "Criativo"} 
                      className="max-h-[500px] object-contain rounded-lg" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                  </div>
                );
              }
              
              // Para vídeos com URL direta que não seja do Facebook
              if (directMediaUrl && isVideo) {
                return (
                  <div className="flex justify-center bg-muted rounded-lg p-4 min-h-[300px]">
                    <video 
                      src={mediaUrl} 
                      controls 
                      className="max-h-[500px] rounded-lg"
                      poster="/placeholder.svg"
                    >
                      Seu navegador não suporta vídeo.
                    </video>
                  </div>
                );
              }
              
              // Para vídeos e carrosséis sem URL direta - mostrar placeholder informativo
              if (isVideo || isCarrossel) {
                return (
                  <div className="flex flex-col items-center justify-center bg-muted rounded-lg p-8 min-h-[200px] text-muted-foreground">
                    <div className="text-center">
                      {isVideo ? (
                        <Video className="h-20 w-20 mx-auto mb-4 opacity-50" />
                      ) : (
                        <FileText className="h-20 w-20 mx-auto mb-4 opacity-50" />
                      )}
                      <p className="font-medium mb-2">
                        {isVideo ? "Vídeo" : "Carrossel"} - Preview externo
                      </p>
                      <p className="text-xs mb-4 max-w-[300px]">
                        {isVideo 
                          ? "Vídeos do Meta/Google não podem ser incorporados diretamente. Use o link abaixo para visualizar."
                          : "Carrosséis precisam ser visualizados na plataforma de origem."
                        }
                      </p>
                    </div>
                  </div>
                );
              }
              
              // Fallback para outros tipos sem mídia
              return (
                <div className="flex items-center justify-center bg-muted rounded-lg p-8 min-h-[200px] text-muted-foreground">
                  <div className="text-center">
                    <Image className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Preview não disponível</p>
                    <p className="text-xs mt-1">A mídia do criativo não foi coletada</p>
                  </div>
                </div>
              );
            })()}

            {/* Link externo para visualizar na plataforma */}
            {criativoPreview && (() => {
              const externalLink = getExternalLink(criativoPreview);
              if (!externalLink) return null;
              
              return (
                <div className="flex justify-center">
                  <Button asChild variant="outline">
                    <a href={externalLink.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {externalLink.label}
                    </a>
                  </Button>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center"><div className="text-xs text-muted-foreground">Impressões</div><div className="text-lg font-bold">{formatNumber(criativoPreview?.impressoes || 0)}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">CTR</div><div className="text-lg font-bold">{(criativoPreview?.ctr || 0).toFixed(2)}%</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">Leads</div><div className="text-lg font-bold">{criativoPreview?.total_leads || 0}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">ROAS</div><div className="text-lg font-bold">{(criativoPreview?.roas || 0).toFixed(2)}x</div></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2">
              <div className="text-center"><div className="text-xs text-muted-foreground">Verba</div><div className="text-lg font-bold">R$ {(criativoPreview?.verba_investida || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">CPL</div><div className="text-lg font-bold">{criativoPreview?.cpl ? `R$ ${criativoPreview.cpl.toFixed(2)}` : "-"}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">Vendas</div><div className="text-lg font-bold">{criativoPreview?.vendas || 0}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">Receita</div><div className="text-lg font-bold">R$ {(criativoPreview?.valor_total_vendas || 0).toLocaleString("pt-BR")}</div></div>
            </div>

            {criativoPreview && criativoPreview.total_leads > 0 && (
              <div className="pt-2 border-t">
                <Button variant="outline" className="w-full" onClick={() => { setCriativoPreview(null); setCriativoSelecionado(criativoPreview.id_criativo); }}>
                  <Eye className="h-4 w-4 mr-2" />Ver {criativoPreview.total_leads} Leads Gerados
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioCreativos;
