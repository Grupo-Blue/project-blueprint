import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, FileText, Eye, Users, Building2, Bitcoin, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2, BarChart3, FolderUp, ChevronDown, ChevronRight, Package, XCircle, Ban, RefreshCw, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IRPFDashboardInsights } from "@/components/irpf/IRPFDashboardInsights";
import { IRPFFilters } from "@/components/irpf/IRPFFilters";
import { VincularLeadDialog } from "@/components/irpf/VincularLeadDialog";
import { ComparativoAnual } from "@/components/irpf/ComparativoAnual";

interface IRPFDeclaracao {
  id: string;
  cpf: string;
  nome_contribuinte: string;
  exercicio: number;
  ano_calendario: number;
  status_processamento: string;
  data_importacao: string;
  arquivo_origem?: string;
  id_cliente_notion?: string;
  id_lead?: string;
}

interface IRPFBemDireito {
  id: string;
  numero_bem: number;
  grupo_codigo: string;
  grupo_descricao?: string;
  codigo_bem: string;
  codigo_descricao?: string;
  discriminacao: string;
  valor_ano_anterior: number;
  valor_ano_atual: number;
  cripto_codigo?: string;
  cripto_tipo?: string;
  participacao_cnpj?: string;
  participacao_razao_social?: string;
}

interface IRPFDividaOnus {
  id: string;
  numero_divida?: number;
  codigo: string;
  codigo_descricao?: string;
  discriminacao: string;
  situacao_ano_anterior: number;
  situacao_ano_atual: number;
  credor_nome?: string;
}

const BLUE_EMPRESA_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";

export default function IRPFImportacoes() {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [selectedDeclaracao, setSelectedDeclaracao] = useState<IRPFDeclaracao | null>(null);
  const [detailsTab, setDetailsTab] = useState("bens");
  const [mainTab, setMainTab] = useState("declaracoes");
  const [exercicioFilter, setExercicioFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Declarações ──
  const { data: declaracoes, isLoading } = useQuery({
    queryKey: ['irpf-declaracoes', BLUE_EMPRESA_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_declaracao')
        .select('*')
        .eq('id_empresa', BLUE_EMPRESA_ID)
        .order('data_importacao', { ascending: false });
      if (error) throw error;
      return data as IRPFDeclaracao[];
    },
  });

  const { data: bensDeclaracao } = useQuery({
    queryKey: ['irpf-bens', selectedDeclaracao?.id],
    queryFn: async () => {
      if (!selectedDeclaracao) return [];
      const { data, error } = await supabase
        .from('irpf_bem_direito')
        .select('*')
        .eq('id_declaracao', selectedDeclaracao.id)
        .order('numero_bem');
      if (error) throw error;
      return data as IRPFBemDireito[];
    },
    enabled: !!selectedDeclaracao,
  });

  const { data: dividasDeclaracao } = useQuery({
    queryKey: ['irpf-dividas', selectedDeclaracao?.id],
    queryFn: async () => {
      if (!selectedDeclaracao) return [];
      const { data, error } = await supabase
        .from('irpf_divida_onus')
        .select('*')
        .eq('id_declaracao', selectedDeclaracao.id)
        .order('numero_divida');
      if (error) throw error;
      return data as IRPFDividaOnus[];
    },
    enabled: !!selectedDeclaracao,
  });

  // ── Lotes de importação (apenas ativos OU com erros pendentes) ──
  const { data: lotes, refetch: refetchLotes } = useQuery({
    queryKey: ['irpf-lotes-visiveis', BLUE_EMPRESA_ID],
    queryFn: async () => {
      // Buscar lotes recentes E em qualquer status; filtrar abaixo
      const { data: lotesRaw, error } = await supabase
        .from('irpf_importacao_lote')
        .select('*')
        .eq('id_empresa', BLUE_EMPRESA_ID)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!lotesRaw || lotesRaw.length === 0) return [];

      // Para cada lote, contar quantos arquivos ainda existem na fila (erros + pendentes + processando)
      const ids = lotesRaw.map(l => l.id);
      const { data: fila } = await supabase
        .from('irpf_importacao_fila')
        .select('id_lote, status')
        .in('id_lote', ids);

      const filaMap = new Map<string, { erros: number; pendentes: number; processando: number }>();
      (fila || []).forEach(f => {
        const cur = filaMap.get(f.id_lote) || { erros: 0, pendentes: 0, processando: 0 };
        if (f.status === 'erro') cur.erros++;
        else if (f.status === 'pendente') cur.pendentes++;
        else if (f.status === 'processando') cur.processando++;
        filaMap.set(f.id_lote, cur);
      });

      // Mostrar apenas: lote ativo (pendente/processando) OU lote com erros pendentes na fila
      return lotesRaw
        .map(l => ({ ...l, _filaInfo: filaMap.get(l.id) || { erros: 0, pendentes: 0, processando: 0 } }))
        .filter(l => {
          const isActive = l.status === 'processando' || l.status === 'pendente';
          const hasErros = l._filaInfo.erros > 0;
          return isActive || hasErros;
        });
    },
  });

  // Polling for active lotes
  const hasActiveLote = lotes?.some(l => l.status === 'processando' || l.status === 'pendente');

  useEffect(() => {
    if (!hasActiveLote) return;
    const interval = setInterval(() => {
      refetchLotes();
      queryClient.invalidateQueries({ queryKey: ['irpf-declaracoes'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasActiveLote, refetchLotes, queryClient]);

  // ── Upload handler (paralelo, sem limite prático) ──
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    const skipped = files.length - pdfFiles.length;
    if (skipped > 0) toast.warning(`${skipped} arquivo(s) ignorados (apenas PDF é aceito)`);
    if (pdfFiles.length === 0) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(true);
    setUploadProgress({ current: 0, total: pdfFiles.length });

    if (pdfFiles.length > 100) {
      toast.info(`Iniciando upload de ${pdfFiles.length} PDFs em paralelo. Não feche esta aba até terminar.`);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Create lote
      const { data: lote, error: loteError } = await supabase
        .from('irpf_importacao_lote')
        .insert({
          id_empresa: BLUE_EMPRESA_ID,
          total_arquivos: pdfFiles.length,
          created_by: user.id,
        })
        .select()
        .single();

      if (loteError || !lote) throw new Error('Erro ao criar lote: ' + loteError?.message);

      // 2. Upload paralelo (concorrência 6) com contador atômico
      const CONCURRENCY = 6;
      let completed = 0;
      let failed = 0;

      const uploadOne = async (file: File) => {
        const safeName = file.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_+/g, '_');
        const storagePath = `${lote.id}/${crypto.randomUUID()}_${safeName}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('irpf-uploads')
            .upload(storagePath, file);

          if (uploadError) {
            await supabase.from('irpf_importacao_fila').insert({
              id_lote: lote.id,
              nome_arquivo: file.name,
              storage_path: storagePath,
              status: 'erro',
              erro_mensagem: `Erro no upload: ${uploadError.message}`,
            });
            failed++;
          } else {
            await supabase.from('irpf_importacao_fila').insert({
              id_lote: lote.id,
              nome_arquivo: file.name,
              storage_path: storagePath,
              status: 'pendente',
            });
          }
        } catch (err) {
          console.error(`Falha upload ${file.name}:`, err);
          failed++;
        } finally {
          completed++;
          setUploadProgress({ current: completed, total: pdfFiles.length });
        }
      };

      // Worker pool simples
      const queue = [...pdfFiles];
      const workers = Array.from({ length: Math.min(CONCURRENCY, pdfFiles.length) }, async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (file) await uploadOne(file);
        }
      });
      await Promise.all(workers);

      // 3. Disparar processamento (self-chaining no backend)
      try {
        const resp = await supabase.functions.invoke('processar-irpf-lote', {
          body: { id_lote: lote.id },
        });
        if (resp.error) console.error('Erro ao disparar processamento:', resp.error);
      } catch (err) {
        console.error('Erro ao disparar processamento:', err);
      }

      const successCount = pdfFiles.length - failed;
      if (failed > 0) {
        toast.warning(`${successCount} enviados, ${failed} falharam no upload. Processamento iniciado.`);
      } else {
        toast.success(`${successCount} arquivo(s) na fila! Processamento em segundo plano.`);
      }
      refetchLotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar arquivos');
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  // ── Filters ──
  const exerciciosDisponiveis = useMemo(() => {
    if (!declaracoes) return [];
    return [...new Set(declaracoes.map(d => d.exercicio))].sort((a, b) => b - a);
  }, [declaracoes]);

  const declaracoesFiltradas = useMemo(() => {
    if (!declaracoes) return [];
    return declaracoes.filter(dec => {
      if (exercicioFilter !== "todos" && dec.exercicio.toString() !== exercicioFilter) return false;
      if (statusFilter !== "todos" && dec.status_processamento !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!dec.nome_contribuinte.toLowerCase().includes(search) && !dec.cpf.includes(search)) return false;
      }
      return true;
    });
  }, [declaracoes, exercicioFilter, statusFilter, searchTerm]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido': return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Concluído</Badge>;
      case 'processando': return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Processando</Badge>;
      case 'erro': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getGrupoBadge = (grupoCodigo: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      '01': { cls: 'text-blue-600', label: 'Imóveis' },
      '02': { cls: 'text-gray-600', label: 'Veículos' },
      '03': { cls: 'text-purple-600', label: 'Participações' },
      '04': { cls: 'text-green-600', label: 'Aplicações' },
      '06': { cls: 'text-cyan-600', label: 'Depósitos' },
      '07': { cls: 'text-indigo-600', label: 'Fundos' },
      '08': { cls: 'text-orange-600', label: 'Criptoativos' },
    };
    const g = map[grupoCodigo];
    return g ? <Badge variant="outline" className={g.cls}>{g.label}</Badge> : <Badge variant="outline">Outros</Badge>;
  };

  const stats = {
    total: declaracoes?.length || 0,
    concluidas: declaracoes?.filter(d => d.status_processamento === 'concluido').length || 0,
    comCripto: 0,
    vinculados: declaracoes?.filter(d => d.id_lead).length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Importações IRPF</h1>
          <p className="text-muted-foreground">Gerencie declarações de Imposto de Renda importadas</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="pdf-upload"
            disabled={isUploading}
          />
          <label htmlFor="pdf-upload">
            <Button asChild disabled={isUploading}>
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando {uploadProgress.current}/{uploadProgress.total}...
                  </>
                ) : (
                  <>
                    <FolderUp className="w-4 h-4 mr-2" />
                    Importar PDFs
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Upload progress */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enviando arquivos para processamento...</span>
                <span>{uploadProgress.current} de {uploadProgress.total}</span>
              </div>
              <Progress value={uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground">
                Após o envio, o processamento continuará em segundo plano. Você pode sair desta tela.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lotes de importação */}
      {lotes && lotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Lotes de Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lotes.map((lote) => (
                <LoteItem key={lote.id} lote={lote} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principais */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="declaracoes">
            <FileText className="w-4 h-4 mr-2" />
            Declarações
          </TabsTrigger>
          <TabsTrigger value="insights">
            <BarChart3 className="w-4 h-4 mr-2" />
            Insights Financeiros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="declaracoes" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Importadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.concluidas}</p>
                    <p className="text-sm text-muted-foreground">Processadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600">
                    <Bitcoin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.comCripto}</p>
                    <p className="text-sm text-muted-foreground">Com Criptoativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.vinculados}</p>
                    <p className="text-sm text-muted-foreground">Vinculados a Lead</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <IRPFFilters
                exercicioFilter={exercicioFilter}
                setExercicioFilter={setExercicioFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                exercicios={exerciciosDisponiveis}
              />
            </CardContent>
          </Card>

          {/* Lista de Declarações */}
          <Card>
            <CardHeader>
              <CardTitle>
                Declarações Importadas
                {declaracoesFiltradas.length !== declaracoes?.length && (
                  <Badge variant="secondary" className="ml-2">
                    {declaracoesFiltradas.length} de {declaracoes?.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : declaracoesFiltradas.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma declaração encontrada</p>
                  {declaracoes?.length === 0 && (
                    <p className="text-sm">Clique em "Importar PDFs" para começar</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contribuinte</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Exercício</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vinculações</TableHead>
                      <TableHead>Importado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {declaracoesFiltradas.map((dec) => (
                      <TableRow key={dec.id}>
                        <TableCell className="font-medium">{dec.nome_contribuinte}</TableCell>
                        <TableCell>{dec.cpf}</TableCell>
                        <TableCell><Badge variant="outline">{dec.exercicio}</Badge></TableCell>
                        <TableCell>{getStatusBadge(dec.status_processamento)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {dec.id_cliente_notion && (
                              <Badge variant="secondary" className="text-xs">
                                <Users className="w-3 h-3 mr-1" /> Notion
                              </Badge>
                            )}
                            {dec.id_lead && (
                              <Badge variant="secondary" className="text-xs">
                                <TrendingUp className="w-3 h-3 mr-1" /> Lead
                              </Badge>
                            )}
                            {!dec.id_lead && (
                              <VincularLeadDialog
                                declaracaoId={dec.id}
                                empresaSelecionada={BLUE_EMPRESA_ID}
                                cpfDeclaracao={dec.cpf}
                                nomeContribuinte={dec.nome_contribuinte}
                                onVinculado={() => {}}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(dec.data_importacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedDeclaracao(dec)}>
                                <Eye className="w-4 h-4 mr-1" /> Ver Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{dec.nome_contribuinte} - Exercício {dec.exercicio}</DialogTitle>
                              </DialogHeader>
                              <Tabs value={detailsTab} onValueChange={setDetailsTab}>
                                <TabsList>
                                  <TabsTrigger value="bens">Bens e Direitos</TabsTrigger>
                                  <TabsTrigger value="dividas">Dívidas e Ônus</TabsTrigger>
                                  <TabsTrigger value="comparativo">Comparativo Anual</TabsTrigger>
                                </TabsList>
                                <TabsContent value="bens" className="mt-4">
                                  {bensDeclaracao?.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-6">Nenhum bem ou direito declarado</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {bensDeclaracao?.map((bem) => (
                                        <Card key={bem.id}>
                                          <CardContent className="pt-4">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-muted-foreground">#{bem.numero_bem}</span>
                                                {getGrupoBadge(bem.grupo_codigo)}
                                                {bem.cripto_codigo && <Badge className="bg-orange-500">{bem.cripto_codigo}</Badge>}
                                              </div>
                                              <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Valor Atual</p>
                                                <p className="font-bold text-green-600">{formatCurrency(bem.valor_ano_atual)}</p>
                                              </div>
                                            </div>
                                            <p className="text-sm mb-2"><strong>{bem.codigo_descricao || bem.grupo_descricao}</strong></p>
                                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{bem.discriminacao}</p>
                                            {bem.participacao_razao_social && (
                                              <div className="mt-2 flex items-center gap-2 text-sm">
                                                <Building2 className="w-4 h-4" />
                                                {bem.participacao_razao_social}
                                                <span className="text-muted-foreground">({bem.participacao_cnpj})</span>
                                              </div>
                                            )}
                                            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                                              <span>Ano Anterior: {formatCurrency(bem.valor_ano_anterior)}</span>
                                              <span>Variação: {formatCurrency(bem.valor_ano_atual - bem.valor_ano_anterior)}</span>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>
                                <TabsContent value="dividas" className="mt-4">
                                  {dividasDeclaracao?.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-6">Nenhuma dívida ou ônus declarado</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {dividasDeclaracao?.map((divida) => (
                                        <Card key={divida.id}>
                                          <CardContent className="pt-4">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-muted-foreground">#{divida.numero_divida}</span>
                                                <Badge variant="outline">{divida.codigo_descricao || divida.codigo}</Badge>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Saldo Atual</p>
                                                <p className="font-bold text-red-600">{formatCurrency(divida.situacao_ano_atual)}</p>
                                              </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{divida.discriminacao}</p>
                                            {divida.credor_nome && (
                                              <p className="mt-2 text-sm">Credor: <strong>{divida.credor_nome}</strong></p>
                                            )}
                                            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                                              <span>Ano Anterior: {formatCurrency(divida.situacao_ano_anterior)}</span>
                                              <span>Variação: {formatCurrency(divida.situacao_ano_atual - divida.situacao_ano_anterior)}</span>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>
                                <TabsContent value="comparativo" className="mt-4">
                                  <ComparativoAnual cpf={dec.cpf} empresaSelecionada={empresaSelecionada} />
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <IRPFDashboardInsights empresaSelecionada={BLUE_EMPRESA_ID} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Componente de Lote ──
function LoteItem({ lote }: { lote: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'reprocess' | 'discard' | null>(null);
  const queryClient = useQueryClient();

  const isActive = lote.status === 'processando' || lote.status === 'pendente';
  const filaInfo = lote._filaInfo || { erros: 0, pendentes: 0, processando: 0 };

  // Buscar só erros + ativos (sucessos foram deletados)
  const { data: arquivos, refetch: refetchArquivos } = useQuery({
    queryKey: ['irpf-fila', lote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_importacao_fila')
        .select('*')
        .eq('id_lote', lote.id)
        .in('status', ['erro', 'pendente', 'processando'])
        .order('status') // erros primeiro
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
    refetchInterval: isOpen && isActive ? 4000 : false,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['irpf-lotes-visiveis'] });
    queryClient.invalidateQueries({ queryKey: ['irpf-fila', lote.id] });
    refetchArquivos();
  };

  const handleCancelLote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCancelling(true);
    try {
      const { data: pendingFiles } = await supabase
        .from('irpf_importacao_fila')
        .select('id, storage_path')
        .eq('id_lote', lote.id)
        .eq('status', 'pendente');

      await supabase
        .from('irpf_importacao_fila')
        .update({ status: 'erro', erro_mensagem: 'Cancelado pelo usuário' })
        .eq('id_lote', lote.id)
        .eq('status', 'pendente');

      await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'cancelado' })
        .eq('id', lote.id);

      // Remove PDFs cancelados do storage (não vamos reprocessar)
      if (pendingFiles && pendingFiles.length > 0) {
        const paths = pendingFiles.map(f => f.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('irpf-uploads').remove(paths);
        }
      }
      // Marcar como erro com pdf indisponível
      await supabase
        .from('irpf_importacao_fila')
        .update({ erro_mensagem: 'Cancelado pelo usuário (PDF descartado)' })
        .eq('id_lote', lote.id)
        .eq('erro_mensagem', 'Cancelado pelo usuário');

      toast.success('Importação cancelada');
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar importação');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReprocessOne = async (arq: any) => {
    setActioningId(arq.id);
    try {
      const { error } = await supabase
        .from('irpf_importacao_fila')
        .update({
          status: 'pendente',
          erro_mensagem: null,
          processing_started_at: null,
          tentativas: 0,
        })
        .eq('id', arq.id);
      if (error) throw error;

      // Re-mark lote as processing
      await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'processando' })
        .eq('id', lote.id);

      // Disparar processamento
      await supabase.functions.invoke('processar-irpf-lote', { body: { id_lote: lote.id } });
      toast.success(`${arq.nome_arquivo} re-enfileirado`);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reprocessar');
    } finally {
      setActioningId(null);
    }
  };

  const handleDownload = async (arq: any) => {
    setActioningId(arq.id);
    try {
      const { data, error } = await supabase.storage
        .from('irpf-uploads')
        .createSignedUrl(arq.storage_path, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message || 'PDF indisponível');
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar PDF');
    } finally {
      setActioningId(null);
    }
  };

  const handleDiscardOne = async (arq: any) => {
    setActioningId(arq.id);
    try {
      if (arq.storage_path) {
        await supabase.storage.from('irpf-uploads').remove([arq.storage_path]);
      }
      await supabase.from('irpf_importacao_fila').delete().eq('id', arq.id);
      toast.success(`${arq.nome_arquivo} descartado`);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao descartar');
    } finally {
      setActioningId(null);
    }
  };

  const handleReprocessAllErrors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBulkAction('reprocess');
    try {
      const { data: errosFila, error } = await supabase
        .from('irpf_importacao_fila')
        .select('id')
        .eq('id_lote', lote.id)
        .eq('status', 'erro');
      if (error) throw error;
      if (!errosFila || errosFila.length === 0) {
        toast.info('Nenhum erro para reprocessar');
        return;
      }

      await supabase
        .from('irpf_importacao_fila')
        .update({ status: 'pendente', erro_mensagem: null, processing_started_at: null, tentativas: 0 })
        .eq('id_lote', lote.id)
        .eq('status', 'erro');

      await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'processando' })
        .eq('id', lote.id);

      await supabase.functions.invoke('processar-irpf-lote', { body: { id_lote: lote.id } });
      toast.success(`${errosFila.length} arquivo(s) re-enfileirados`);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reprocessar lote');
    } finally {
      setBulkAction(null);
    }
  };

  const handleDiscardAllErrors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Descartar todos os PDFs com erro deste lote? Os arquivos serão removidos do storage.')) return;
    setBulkAction('discard');
    try {
      const { data: errosFila } = await supabase
        .from('irpf_importacao_fila')
        .select('id, storage_path')
        .eq('id_lote', lote.id)
        .eq('status', 'erro');

      if (errosFila && errosFila.length > 0) {
        const paths = errosFila.map(f => f.storage_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('irpf-uploads').remove(paths);
        }
        const ids = errosFila.map(f => f.id);
        await supabase.from('irpf_importacao_fila').delete().in('id', ids);
        toast.success(`${errosFila.length} erro(s) descartado(s)`);
      }
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao descartar');
    } finally {
      setBulkAction(null);
    }
  };

  const isCancelled = lote.status === 'cancelado';
  const totalAtivosOuErros = filaInfo.erros + filaInfo.pendentes + filaInfo.processando;

  const statusIcon = isActive
    ? <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
    : isCancelled
      ? <Ban className="w-4 h-4 text-muted-foreground" />
      : filaInfo.erros > 0
        ? <AlertCircle className="w-4 h-4 text-destructive" />
        : <CheckCircle className="w-4 h-4 text-green-500" />;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
              <Badge variant="secondary" className="text-xs">
                {lote.total_arquivos} enviado(s)
              </Badge>
              {filaInfo.erros > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {filaInfo.erros} com erro
                </Badge>
              )}
              {(filaInfo.pendentes + filaInfo.processando) > 0 && (
                <Badge variant="outline" className="text-xs">
                  {filaInfo.pendentes + filaInfo.processando} na fila
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0" onClick={(e) => e.stopPropagation()}>
            {filaInfo.erros > 0 && !isActive && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleReprocessAllErrors}
                  disabled={bulkAction !== null}
                  title="Reprocessar todos os erros deste lote"
                >
                  {bulkAction === 'reprocess' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1 text-xs">Reprocessar erros</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  onClick={handleDiscardAllErrors}
                  disabled={bulkAction !== null}
                  title="Descartar todos os erros deste lote"
                >
                  {bulkAction === 'discard' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </Button>
              </>
            )}
            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={handleCancelLote}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span className="ml-1 text-xs">Cancelar</span>
              </Button>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-8 mt-1 space-y-1 pb-2">
          {!arquivos ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando arquivos...
            </div>
          ) : arquivos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2 italic">
              Todos os arquivos foram processados com sucesso ✓
            </div>
          ) : (
            arquivos.map((arq) => (
              <div key={arq.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/30">
                {arq.status === 'pendente' && <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                {arq.status === 'processando' && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                {arq.status === 'erro' && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                <span className="truncate flex-1" title={arq.nome_arquivo}>{arq.nome_arquivo}</span>
                {arq.status === 'erro' && arq.erro_mensagem && (
                  <span className="text-xs text-destructive shrink-0 max-w-[260px] truncate" title={arq.erro_mensagem}>
                    {arq.erro_mensagem}
                  </span>
                )}
                {arq.status === 'erro' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleReprocessOne(arq)}
                      disabled={actioningId === arq.id}
                      title="Reprocessar"
                    >
                      {actioningId === arq.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDownload(arq)}
                      disabled={actioningId === arq.id}
                      title="Baixar PDF original"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDiscardOne(arq)}
                      disabled={actioningId === arq.id}
                      title="Descartar (remove PDF e registro)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
