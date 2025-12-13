import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileText, Eye, Users, Building2, Bitcoin, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2, BarChart3, Link } from "lucide-react";
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

// IRPF é exclusivo da Blue Consult
const BLUE_EMPRESA_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";

export default function IRPFImportacoes() {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [selectedDeclaracao, setSelectedDeclaracao] = useState<IRPFDeclaracao | null>(null);
  const [detailsTab, setDetailsTab] = useState("bens");
  const [mainTab, setMainTab] = useState("declaracoes");
  
  // Filtros
  const [exercicioFilter, setExercicioFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      // Sempre usa Blue Consult para importação IRPF
      const { data, error } = await supabase.functions.invoke('processar-irpf', {
        body: {
          pdfBase64: base64,
          id_empresa: BLUE_EMPRESA_ID,
          arquivo_origem: file.name,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar');
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(`IRPF de ${data.nome} (${data.exercicio}) importado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['irpf-declaracoes'] });
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Por favor, selecione um arquivo PDF');
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  // Lista de exercícios únicos para filtro
  const exerciciosDisponiveis = useMemo(() => {
    if (!declaracoes) return [];
    const exercicios = [...new Set(declaracoes.map(d => d.exercicio))];
    return exercicios.sort((a, b) => b - a);
  }, [declaracoes]);

  // Filtrar declarações
  const declaracoesFiltradas = useMemo(() => {
    if (!declaracoes) return [];
    
    return declaracoes.filter(dec => {
      if (exercicioFilter !== "todos" && dec.exercicio.toString() !== exercicioFilter) {
        return false;
      }
      if (statusFilter !== "todos" && dec.status_processamento !== statusFilter) {
        return false;
      }
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!dec.nome_contribuinte.toLowerCase().includes(search) && 
            !dec.cpf.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [declaracoes, exercicioFilter, statusFilter, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Concluído</Badge>;
      case 'processando':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Processando</Badge>;
      case 'erro':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getGrupoBadge = (grupoCodigo: string) => {
    switch (grupoCodigo) {
      case '01': return <Badge variant="outline" className="text-blue-600">Imóveis</Badge>;
      case '02': return <Badge variant="outline" className="text-gray-600">Veículos</Badge>;
      case '03': return <Badge variant="outline" className="text-purple-600">Participações</Badge>;
      case '04': return <Badge variant="outline" className="text-green-600">Aplicações</Badge>;
      case '06': return <Badge variant="outline" className="text-cyan-600">Depósitos</Badge>;
      case '07': return <Badge variant="outline" className="text-indigo-600">Fundos</Badge>;
      case '08': return <Badge variant="outline" className="text-orange-600">Criptoativos</Badge>;
      default: return <Badge variant="outline">Outros</Badge>;
    }
  };

  // Estatísticas
  const stats = {
    total: declaracoes?.length || 0,
    concluidas: declaracoes?.filter(d => d.status_processamento === 'concluido').length || 0,
    comCripto: 0, // Será calculado depois
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
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="pdf-upload"
            disabled={uploadMutation.isPending}
          />
          <label htmlFor="pdf-upload">
            <Button asChild disabled={uploadMutation.isPending}>
              <span>
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploadMutation.isPending ? 'Processando...' : 'Importar PDF'}
              </span>
            </Button>
          </label>
        </div>
      </div>

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
                    <p className="text-sm">Clique em "Importar PDF" para começar</p>
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
                        <TableCell>
                          <Badge variant="outline">{dec.exercicio}</Badge>
                        </TableCell>
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
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedDeclaracao(dec)}
                              >
                                <Eye className="w-4 h-4 mr-1" /> Ver Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  {dec.nome_contribuinte} - Exercício {dec.exercicio}
                                </DialogTitle>
                              </DialogHeader>

                              <Tabs value={detailsTab} onValueChange={setDetailsTab}>
                                <TabsList>
                                  <TabsTrigger value="bens">Bens e Direitos</TabsTrigger>
                                  <TabsTrigger value="dividas">Dívidas e Ônus</TabsTrigger>
                                  <TabsTrigger value="comparativo">Comparativo Anual</TabsTrigger>
                                </TabsList>

                                <TabsContent value="bens" className="mt-4">
                                  {bensDeclaracao?.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-6">
                                      Nenhum bem ou direito declarado
                                    </p>
                                  ) : (
                                    <div className="space-y-4">
                                      {bensDeclaracao?.map((bem) => (
                                        <Card key={bem.id}>
                                          <CardContent className="pt-4">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-muted-foreground">
                                                  #{bem.numero_bem}
                                                </span>
                                                {getGrupoBadge(bem.grupo_codigo)}
                                                {bem.cripto_codigo && (
                                                  <Badge className="bg-orange-500">
                                                    {bem.cripto_codigo}
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Valor Atual</p>
                                                <p className="font-bold text-green-600">
                                                  {formatCurrency(bem.valor_ano_atual)}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <p className="text-sm mb-2">
                                              <strong>{bem.codigo_descricao || bem.grupo_descricao}</strong>
                                            </p>
                                            
                                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                              {bem.discriminacao}
                                            </p>

                                            {bem.participacao_razao_social && (
                                              <div className="mt-2 flex items-center gap-2 text-sm">
                                                <Building2 className="w-4 h-4" />
                                                {bem.participacao_razao_social}
                                                <span className="text-muted-foreground">
                                                  ({bem.participacao_cnpj})
                                                </span>
                                              </div>
                                            )}

                                            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                                              <span>Ano Anterior: {formatCurrency(bem.valor_ano_anterior)}</span>
                                              <span>
                                                Variação: {formatCurrency(bem.valor_ano_atual - bem.valor_ano_anterior)}
                                              </span>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="dividas" className="mt-4">
                                  {dividasDeclaracao?.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-6">
                                      Nenhuma dívida ou ônus declarado
                                    </p>
                                  ) : (
                                    <div className="space-y-4">
                                      {dividasDeclaracao?.map((divida) => (
                                        <Card key={divida.id}>
                                          <CardContent className="pt-4">
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-muted-foreground">
                                                  #{divida.numero_divida}
                                                </span>
                                                <Badge variant="outline">{divida.codigo_descricao || divida.codigo}</Badge>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Saldo Atual</p>
                                                <p className="font-bold text-red-600">
                                                  {formatCurrency(divida.situacao_ano_atual)}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                              {divida.discriminacao}
                                            </p>

                                            {divida.credor_nome && (
                                              <p className="mt-2 text-sm">
                                                Credor: <strong>{divida.credor_nome}</strong>
                                              </p>
                                            )}

                                            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                                              <span>Ano Anterior: {formatCurrency(divida.situacao_ano_anterior)}</span>
                                              <span>
                                                Variação: {formatCurrency(divida.situacao_ano_atual - divida.situacao_ano_anterior)}
                                              </span>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="comparativo" className="mt-4">
                                  <ComparativoAnual 
                                    cpf={dec.cpf} 
                                    empresaSelecionada={empresaSelecionada} 
                                  />
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
          <IRPFDashboardInsights empresaSelecionada={empresaSelecionada} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
