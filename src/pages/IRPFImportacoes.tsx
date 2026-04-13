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
import { Upload, FileText, Eye, Users, Building2, Bitcoin, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2, BarChart3, FolderUp, ChevronDown, ChevronRight, Package, XCircle, Ban } from "lucide-react";
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

  // ── Lotes de importação ──
  const { data: lotes, refetch: refetchLotes } = useQuery({
    queryKey: ['irpf-lotes', BLUE_EMPRESA_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_importacao_lote')
        .select('*')
        .eq('id_empresa', BLUE_EMPRESA_ID)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
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

  // ── Upload handler ──
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

      // 2. Upload each file and create fila record
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const safeName = file.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_+/g, '_');
        const storagePath = `${lote.id}/${crypto.randomUUID()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('irpf-uploads')
          .upload(storagePath, file);

        if (uploadError) {
          console.error(`Erro ao fazer upload de ${file.name}:`, uploadError);
          // Create fila record with error
          await supabase.from('irpf_importacao_fila').insert({
            id_lote: lote.id,
            nome_arquivo: file.name,
            storage_path: storagePath,
            status: 'erro',
            erro_mensagem: `Erro no upload: ${uploadError.message}`,
          });
          continue;
        }

        await supabase.from('irpf_importacao_fila').insert({
          id_lote: lote.id,
          nome_arquivo: file.name,
          storage_path: storagePath,
          status: 'pendente',
        });

        setUploadProgress({ current: i + 1, total: pdfFiles.length });
      }

      // 3. Trigger processing (self-chaining — one file per invocation)
      try {
        const resp = await supabase.functions.invoke('processar-irpf-lote', {
          body: { id_lote: lote.id },
        });
        if (resp.error) console.error('Erro ao disparar processamento:', resp.error);
      } catch (err) {
        console.error('Erro ao disparar processamento:', err);
      }

      toast.success(`${pdfFiles.length} arquivo(s) enviados! O processamento continua em segundo plano.`);
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
  const queryClient = useQueryClient();

  const isActive = lote.status === 'processando' || lote.status === 'pendente';

  const { data: arquivos, refetch: refetchArquivos } = useQuery({
    queryKey: ['irpf-fila', lote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_importacao_fila')
        .select('*')
        .eq('id_lote', lote.id)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
    refetchInterval: isOpen && isActive ? 4000 : false,
  });

  const handleCancelLote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCancelling(true);
    try {
      const { data: pendingFiles, error: pendingFilesError } = await supabase
        .from('irpf_importacao_fila')
        .select('id, storage_path')
        .eq('id_lote', lote.id)
        .eq('status', 'pendente');

      if (pendingFilesError) throw pendingFilesError;

      const { error: filaUpdateError } = await supabase
        .from('irpf_importacao_fila')
        .update({ status: 'erro', erro_mensagem: 'Cancelado pelo usuário' })
        .eq('id_lote', lote.id)
        .eq('status', 'pendente');

      if (filaUpdateError) throw filaUpdateError;

      const { data: filaSnapshot, error: filaSnapshotError } = await supabase
        .from('irpf_importacao_fila')
        .select('status')
        .eq('id_lote', lote.id);

      if (filaSnapshotError) throw filaSnapshotError;

      const processados = filaSnapshot?.filter((item) => item.status === 'sucesso').length ?? 0;
      const erros = filaSnapshot?.filter((item) => item.status === 'erro').length ?? 0;

      const { error: loteUpdateError } = await supabase
        .from('irpf_importacao_lote')
        .update({ status: 'cancelado', processados, erros })
        .eq('id', lote.id);

      if (loteUpdateError) throw loteUpdateError;

      if (pendingFiles && pendingFiles.length > 0) {
        const paths = pendingFiles
          .map((file) => file.storage_path)
          .filter(Boolean);

        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('irpf-uploads')
            .remove(paths);

          if (storageError) {
            console.error('Erro ao limpar arquivos cancelados:', storageError);
          }
        }
      }

      toast.success('Importação cancelada');
      queryClient.invalidateQueries({ queryKey: ['irpf-lotes'] });
      queryClient.invalidateQueries({ queryKey: ['irpf-fila', lote.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar importação');
    } finally {
      setIsCancelling(false);
    }
  };

  const isActive = lote.status === 'processando' || lote.status === 'pendente';
  const isCancelled = lote.status === 'cancelado';
  const progress = lote.total_arquivos > 0
    ? ((lote.processados + lote.erros) / lote.total_arquivos) * 100
    : 0;

  const statusIcon = isActive
    ? <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
    : isCancelled
      ? <Ban className="w-4 h-4 text-muted-foreground" />
      : lote.erros > 0
        ? <AlertCircle className="w-4 h-4 text-destructive" />
        : <CheckCircle className="w-4 h-4 text-green-500" />;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
              <Badge variant="secondary" className="text-xs">
                {lote.total_arquivos} arquivo(s)
              </Badge>
              {isCancelled && <Badge variant="outline" className="text-xs text-muted-foreground">Cancelado</Badge>}
            </div>
            {isActive && (
              <Progress value={progress} className="h-1.5 mt-1" />
            )}
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0">
            {lote.processados > 0 && <span className="text-green-600">✓ {lote.processados}</span>}
            {lote.erros > 0 && <span className="text-destructive">✗ {lote.erros}</span>}
            {isActive && <span className="text-muted-foreground">{lote.total_arquivos - lote.processados - lote.erros} pendente(s)</span>}
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
          ) : (
            arquivos.map((arq) => (
              <div key={arq.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded">
                {arq.status === 'pendente' && <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                {arq.status === 'processando' && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                {arq.status === 'sucesso' && <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />}
                {arq.status === 'erro' && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                <span className="truncate flex-1">{arq.nome_arquivo}</span>
                {arq.status === 'sucesso' && arq.resultado && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(arq.resultado as any)?.nome} ({(arq.resultado as any)?.exercicio})
                  </span>
                )}
                {arq.status === 'erro' && arq.erro_mensagem && (
                  <span className="text-xs text-destructive shrink-0 max-w-[200px] truncate" title={arq.erro_mensagem}>
                    {arq.erro_mensagem}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
