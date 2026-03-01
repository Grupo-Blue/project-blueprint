import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { 
  Plus, 
  Filter, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Paperclip,
  Sparkles,
  Play,
  CheckCircle,
  ShieldCheck,
  Building2,
  DollarSign,
  Image,
  ClipboardList,
  ListChecks,
  FileEdit,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SugestoesIA } from "@/components/SugestoesIA";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import FormularioDemandaCampanha from "@/components/demandas/FormularioDemandaCampanha";
import SugestoesIACampanhas from "@/components/demandas/SugestoesIACampanhas";
import DetalheDemanda from "@/components/demandas/DetalheDemanda";
import RegistroOtimizacoes from "@/components/RegistroOtimizacoes";

type CategoriaAcao = "A" | "B" | "C";
type StatusAcao = "PENDENTE" | "APROVADA" | "REPROVADA" | "EXECUTADA";

interface Acao {
  id_acao: string;
  id_usuario: string;
  id_empresa: string;
  categoria: CategoriaAcao;
  tipo_acao: string;
  descricao: string;
  impacto_esperado: string;
  status: StatusAcao;
  data_criacao: string;
  data_execucao: string | null;
  motivo_reprovacao: string | null;
  anexos?: string[];
  empresa: { nome: string } | null;
  usuario: { nome: string } | null;
}

interface DemandaCampanha {
  id_demanda: string;
  id_empresa: string;
  id_criador: string;
  id_executor: string | null;
  titulo: string;
  descricao: string | null;
  plataforma: "META" | "GOOGLE";
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  status: "PENDENTE" | "EM_EXECUCAO" | "EXECUTADA" | "VERIFICADA" | "REJEITADA";
  verba_diaria: number | null;
  criativos: any[];
  data_inicio: string | null;
  sugerida_por_ia: boolean;
  created_at: string;
  empresa?: { nome: string };
}

const Acoes = () => {
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { empresaSelecionada } = useEmpresa();

  // Demandas state
  const [demandaDialogOpen, setDemandaDialogOpen] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);
  const [demandaSelecionada, setDemandaSelecionada] = useState<DemandaCampanha | null>(null);
  const [dadosPrePreenchidos, setDadosPrePreenchidos] = useState<Partial<DemandaCampanha> | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAcao, setEditingAcao] = useState<Acao | null>(null);
  const [editFormData, setEditFormData] = useState({
    categoria: "A" as CategoriaAcao,
    tipo_acao: "",
    descricao: "",
    impacto_esperado: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAcao, setDeletingAcao] = useState<Acao | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state for Ações
  const [formData, setFormData] = useState({
    id_empresa: "",
    categoria: "A" as CategoriaAcao,
    tipo_acao: "",
    descricao: "",
    impacto_esperado: "",
  });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const isAdminUser = profile?.perfil === "ADMIN";
  const isDirecao = profile?.perfil === "DIRECAO" || isAdminUser;
  const isTrafego = profile?.perfil === "TRAFEGO" || isAdminUser;

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  useEffect(() => {
    if (!dialogOpen) {
      setSelectedFiles([]);
    }
  }, [dialogOpen]);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setCurrentUserId(session.user.id);

    // Fetch profile to check role
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    setProfile(profileData);
    await Promise.all([fetchAcoes(), fetchEmpresas()]);
  };

  const fetchAcoes = async () => {
    try {
      const { data, error } = await supabase
        .from("acao")
        .select("*, empresa(nome)")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      
      if (data) {
        const userIds = [...new Set(data.map(a => a.id_usuario))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const acoesWithUsers = data.map(acao => ({
          ...acao,
          usuario: profilesMap.get(acao.id_usuario) || { nome: "Usuário não encontrado" }
        }));
        
        setAcoes(acoesWithUsers as any);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    const { data } = await supabase.from("empresa").select("*");
    setEmpresas(data || []);
  };

  // Demandas query
  const { data: demandas, isLoading: loadingDemandas } = useQuery({
    queryKey: ["demandas-campanha", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("demanda_campanha")
        .select(`*, empresa:id_empresa (nome)`)
        .order("created_at", { ascending: false });

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DemandaCampanha[];
    },
    staleTime: 30000,
  });

  const demandasPendentes = demandas?.filter(d => d.status === "PENDENTE" || d.status === "EM_EXECUCAO").length || 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidSize = file.size <= 10 * 1024 * 1024;
      const isValidType = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ].includes(file.type);
      
      if (!isValidSize) {
        toast({ title: "Arquivo muito grande", description: `${file.name} excede 10MB`, variant: "destructive" });
      }
      if (!isValidType) {
        toast({ title: "Tipo de arquivo inválido", description: `${file.name} não é um formato aceito`, variant: "destructive" });
      }
      
      return isValidSize && isValidType;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (userId: string, acaoId: string) => {
    if (selectedFiles.length === 0) return [];
    setUploadingFiles(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${acaoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('acao-anexos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('acao-anexos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }
    } catch (error: any) {
      toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
    } finally {
      setUploadingFiles(false);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const dataAcao = {
        id_empresa: formData.id_empresa,
        categoria: formData.categoria,
        tipo_acao: formData.tipo_acao,
        descricao: formData.descricao,
        impacto_esperado: formData.impacto_esperado,
        id_usuario: user.id,
        status: (formData.categoria === "A" ? "EXECUTADA" : formData.categoria === "B" ? "EXECUTADA" : "PENDENTE") as StatusAcao,
        data_execucao: formData.categoria !== "C" ? new Date().toISOString() : null,
        anexos: [],
      };

      const { data: insertedAcao, error } = await supabase
        .from("acao")
        .insert([dataAcao])
        .select()
        .single();

      if (error) throw error;

      if (selectedFiles.length > 0 && insertedAcao) {
        const uploadedUrls = await uploadFiles(user.id, insertedAcao.id_acao);
        
        if (uploadedUrls.length > 0) {
          await supabase
            .from("acao")
            .update({ anexos: uploadedUrls })
            .eq("id_acao", insertedAcao.id_acao);
        }
      }

      toast({
        title: "Ação cadastrada!",
        description: formData.categoria === "C" 
          ? "Aguardando aprovação da direção" 
          : "Ação registrada com sucesso",
      });

      setDialogOpen(false);
      setFormData({ id_empresa: "", categoria: "A", tipo_acao: "", descricao: "", impacto_esperado: "" });
      setSelectedFiles([]);
      fetchAcoes();
    } catch (error: any) {
      toast({ title: "Erro ao cadastrar ação", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getCategoriaColor = (categoria: CategoriaAcao) => {
    switch (categoria) {
      case "A": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "B": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "C": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
  };

  const getStatusIcon = (status: StatusAcao) => {
    switch (status) {
      case "EXECUTADA": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "APROVADA": return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case "PENDENTE": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "REPROVADA": return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusLabel = (status: StatusAcao) => {
    const labels = { EXECUTADA: "Executada", APROVADA: "Aprovada", PENDENTE: "Pendente", REPROVADA: "Reprovada" };
    return labels[status];
  };

  const getDemandaStatusIcon = (status: string) => {
    switch (status) {
      case "PENDENTE": return <Clock className="h-4 w-4" />;
      case "EM_EXECUCAO": return <Play className="h-4 w-4" />;
      case "EXECUTADA": return <CheckCircle className="h-4 w-4" />;
      case "VERIFICADA": return <ShieldCheck className="h-4 w-4" />;
      case "REJEITADA": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getDemandaStatusColor = (status: string) => {
    switch (status) {
      case "PENDENTE": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "EM_EXECUCAO": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "EXECUTADA": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "VERIFICADA": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "REJEITADA": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA": return "destructive";
      case "MEDIA": return "secondary";
      case "BAIXA": return "outline";
      default: return "secondary";
    }
  };

  const acoesFiltradas = acoes.filter((acao) => {
    const categoriaMatch = filtroCategoria === "TODAS" || acao.categoria === filtroCategoria;
    const statusMatch = filtroStatus === "TODOS" || acao.status === filtroStatus;
    return categoriaMatch && statusMatch;
  });

  const tiposAcaoPorCategoria: Record<CategoriaAcao, string[]> = {
    A: ["Ajustar orçamento (+/- até 20%)", "Criativo novo (teste)", "Copiar anúncio", "Pausar anúncio com baixo desempenho", "Reativar anúncio", "Ajustar lance", "Outro (Categoria A)"],
    B: ["Ajustar orçamento (+/- até 30%)", "Criar nova campanha (teste)", "Testar novo funil", "Alterar copy de anúncio", "Testar novo público", "Landing page nova (teste)", "Outro (Categoria B)"],
    C: ["Escalar campanha (>30%)", "Pausar campanha principal", "Trocar objetivo da campanha", "Alterar ICP estratégico", "Campanha sobre tema sensível", "Mudança de estratégia completa", "Investimento acima do orçamento", "Outro (Categoria C)"],
  };

  const editTiposAcaoFiltrados = tiposAcaoPorCategoria[editFormData.categoria] || [];

  const handleEditClick = (acao: Acao) => {
    setEditingAcao(acao);
    setEditFormData({
      categoria: acao.categoria,
      tipo_acao: acao.tipo_acao,
      descricao: acao.descricao,
      impacto_esperado: acao.impacto_esperado || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcao) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("acao")
        .update({
          categoria: editFormData.categoria,
          tipo_acao: editFormData.tipo_acao,
          descricao: editFormData.descricao,
          impacto_esperado: editFormData.impacto_esperado,
        })
        .eq("id_acao", editingAcao.id_acao);

      if (error) throw error;

      toast({ title: "Ação atualizada com sucesso!" });
      setEditDialogOpen(false);
      setEditingAcao(null);
      fetchAcoes();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (acao: Acao) => {
    setDeletingAcao(acao);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAcao) return;
    setDeleting(true);
    try {
      // Delete related approval records first
      await supabase.from("acao_aprovacao").delete().eq("id_acao", deletingAcao.id_acao);
      await supabase.from("acao_campanha").delete().eq("id_acao", deletingAcao.id_acao);
      
      const { error } = await supabase.from("acao").delete().eq("id_acao", deletingAcao.id_acao);
      if (error) throw error;

      toast({ title: "Ação excluída com sucesso!" });
      setDeleteDialogOpen(false);
      setDeletingAcao(null);
      fetchAcoes();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const canEditAcao = (acao: Acao) => currentUserId === acao.id_usuario || isAdminUser;

  const tiposAcaoFiltrados = tiposAcaoPorCategoria[formData.categoria] || [];

  const handleSugestaoSelecionada = (sugestao: Partial<DemandaCampanha>) => {
    setDadosPrePreenchidos(sugestao);
    setSugestoesOpen(false);
    setDemandaDialogOpen(true);
  };

  const handleDemandaFormSubmit = () => {
    setDemandaDialogOpen(false);
    setDadosPrePreenchidos(null);
    queryClient.invalidateQueries({ queryKey: ["demandas-campanha"] });
  };

  const handleDemandaClick = (demanda: DemandaCampanha) => {
    setDemandaSelecionada(demanda as any);
    setDetalheOpen(true);
  };

  if (loading && acoes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarefas Tráfego</h1>
          <p className="text-muted-foreground">Ações de governança e demandas de campanhas</p>
        </div>
      </div>

      <Tabs defaultValue="acoes" className="space-y-6">
        <TabsList className="glass-card p-1 h-auto grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="acoes" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Ações A/B/C
          </TabsTrigger>
          <TabsTrigger value="demandas" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Demandas
            {demandasPendentes > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {demandasPendentes}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="otimizacoes" className="gap-2">
            <FileEdit className="h-4 w-4" />
            Otimizações
          </TabsTrigger>
        </TabsList>

        {/* Aba de Ações A/B/C */}
        <TabsContent value="acoes" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Ação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Ação</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Empresa *</Label>
                    <Select value={formData.id_empresa} onValueChange={(value) => setFormData({ ...formData, id_empresa: value })} required>
                      <SelectTrigger id="empresa"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>{empresa.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria *</Label>
                    <Select value={formData.categoria} onValueChange={(value: CategoriaAcao) => setFormData({ ...formData, categoria: value, tipo_acao: "" })} required>
                      <SelectTrigger id="categoria"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Categoria A (Execução livre)</SelectItem>
                        <SelectItem value="B">Categoria B (Comunicar)</SelectItem>
                        <SelectItem value="C">Categoria C (Aprovação obrigatória)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {formData.categoria === "A" && "Ações de baixo impacto, execução imediata"}
                      {formData.categoria === "B" && "Ações de médio impacto, comunicar à direção"}
                      {formData.categoria === "C" && "Ações de alto impacto, requer aprovação"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo_acao">Tipo de Ação *</Label>
                    <Select value={formData.tipo_acao} onValueChange={(value) => setFormData({ ...formData, tipo_acao: value })} required>
                      <SelectTrigger id="tipo_acao"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        {tiposAcaoFiltrados.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição / Motivo *</Label>
                    <Textarea id="descricao" placeholder="Descreva a ação e o motivo, citando métricas relevantes..." value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required rows={4} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="impacto_esperado">Impacto Esperado</Label>
                    <Textarea id="impacto_esperado" placeholder="Qual o resultado esperado desta ação?" value={formData.impacto_esperado} onChange={(e) => setFormData({ ...formData, impacto_esperado: e.target.value })} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="anexos">Anexos (Opcional)</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
                      <Input id="anexos" type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="cursor-pointer" disabled={uploadingFiles} />
                      <p className="text-xs text-muted-foreground mt-2">Formatos aceitos: imagens, PDF, DOC (máx. 10MB cada)</p>
                    </div>
                    
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-sm font-medium">Arquivos selecionados:</p>
                        <div className="space-y-1">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-secondary/50 p-2 rounded">
                              <span className="text-sm truncate flex-1">{file.name}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={uploadingFiles}>✕</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={loading || uploadingFiles}>
                      {loading ? "Cadastrando..." : uploadingFiles ? "Fazendo upload..." : "Cadastrar Ação"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <SugestoesIA onAcaoCriada={fetchAcoes} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="filtro-categoria" className="text-sm">Categoria</Label>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger id="filtro-categoria"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    <SelectItem value="A">Categoria A</SelectItem>
                    <SelectItem value="B">Categoria B</SelectItem>
                    <SelectItem value="C">Categoria C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="filtro-status" className="text-sm">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger id="filtro-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="APROVADA">Aprovada</SelectItem>
                    <SelectItem value="EXECUTADA">Executada</SelectItem>
                    <SelectItem value="REPROVADA">Reprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {acoesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhuma ação encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    {acoes.length === 0 ? "Cadastre sua primeira ação para começar" : "Tente ajustar os filtros"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              acoesFiltradas.map((acao) => (
                <Card key={acao.id_acao} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex gap-2">
                        <Badge className={getCategoriaColor(acao.categoria)}>Categoria {acao.categoria}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getStatusIcon(acao.status)}
                          {getStatusLabel(acao.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(acao.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        {canEditAcao(acao) && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(acao)}
                              className="h-7 px-2"
                            >
                              <FileEdit className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            {isAdminUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(acao)}
                                className="h-7 px-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">{acao.tipo_acao}</h3>
                        <p className="text-sm text-muted-foreground">{acao.empresa?.nome || "N/A"} • Por: {acao.usuario?.nome || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Descrição:</p>
                        <p className="text-sm">{acao.descricao}</p>
                      </div>
                      {acao.impacto_esperado && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Impacto Esperado:</p>
                          <p className="text-sm">{acao.impacto_esperado}</p>
                        </div>
                      )}
                      {acao.motivo_reprovacao && (
                        <div className="bg-destructive/10 p-3 rounded-md">
                          <p className="text-sm font-medium text-destructive">Motivo da Reprovação:</p>
                          <p className="text-sm">{acao.motivo_reprovacao}</p>
                        </div>
                      )}
                      {acao.anexos && acao.anexos.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            Anexos ({acao.anexos.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {acao.anexos.map((url, idx) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                              return (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                                  {isImage ? "🖼️" : "📄"} Anexo {idx + 1}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Aba de Demandas de Campanhas */}
        <TabsContent value="demandas" className="space-y-6">
          {isDirecao && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSugestoesOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Sugestões IA
              </Button>
              <Dialog open={demandaDialogOpen} onOpenChange={(open) => {
                setDemandaDialogOpen(open);
                if (!open) setDadosPrePreenchidos(null);
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Demanda
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {dadosPrePreenchidos?.sugerida_por_ia ? "Criar Campanha Sugerida pela IA" : "Nova Demanda de Campanha"}
                    </DialogTitle>
                  </DialogHeader>
                  <FormularioDemandaCampanha 
                    dadosIniciais={dadosPrePreenchidos || undefined}
                    onSubmit={handleDemandaFormSubmit}
                    onCancel={() => {
                      setDemandaDialogOpen(false);
                      setDadosPrePreenchidos(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Resumo de demandas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["PENDENTE", "EM_EXECUCAO", "EXECUTADA", "VERIFICADA", "REJEITADA"].map((status) => {
              const count = demandas?.filter(d => d.status === status).length || 0;
              return (
                <Card key={status} className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${getDemandaStatusColor(status)}`}>
                      {getDemandaStatusIcon(status)}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{status.replace("_", " ")}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Lista de Demandas */}
          {loadingDemandas ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando demandas...</p>
            </Card>
          ) : !demandas || demandas.length === 0 ? (
            <Card className="p-8 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">Nenhuma demanda encontrada</p>
              <p className="text-sm text-muted-foreground">
                {isDirecao ? "Crie uma nova demanda para o tráfego executar" : "Aguarde demandas da direção"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demandas.map((demanda) => (
                <Card 
                  key={demanda.id_demanda} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleDemandaClick(demanda)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{demanda.titulo}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{demanda.plataforma}</Badge>
                          <Badge variant={getPrioridadeColor(demanda.prioridade) as any} className="text-xs">{demanda.prioridade}</Badge>
                          {demanda.sugerida_por_ia && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />IA
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getDemandaStatusColor(demanda.status)}`}>
                        {getDemandaStatusIcon(demanda.status)}
                        <span className="hidden sm:inline">{demanda.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {demanda.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {demanda.empresa?.nome}
                      </span>
                      {demanda.verba_diaria && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          R$ {demanda.verba_diaria}/dia
                        </span>
                      )}
                      {demanda.criativos && demanda.criativos.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          {demanda.criativos.length} criativos
                        </span>
                      )}
                      {demanda.data_inicio && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(demanda.data_inicio), "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 text-xs text-muted-foreground">
                    Criada em {format(new Date(demanda.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aba de Registro de Otimizações */}
        <TabsContent value="otimizacoes" className="space-y-6">
          <RegistroOtimizacoes empresas={empresas} profile={profile} />
        </TabsContent>
      </Tabs>

      {/* Dialogs de Demandas */}
      <SugestoesIACampanhas 
        open={sugestoesOpen}
        onOpenChange={setSugestoesOpen}
        onSugestaoSelecionada={handleSugestaoSelecionada}
      />

      <DetalheDemanda
        demanda={demandaSelecionada as any}
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["demandas-campanha"] })}
      />

      {/* Dialog de Edição de Ação */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Ação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={editFormData.categoria} onValueChange={(value: CategoriaAcao) => setEditFormData({ ...editFormData, categoria: value, tipo_acao: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Categoria A (Execução livre)</SelectItem>
                  <SelectItem value="B">Categoria B (Comunicar)</SelectItem>
                  <SelectItem value="C">Categoria C (Aprovação obrigatória)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Ação *</Label>
              <Select value={editFormData.tipo_acao} onValueChange={(value) => setEditFormData({ ...editFormData, tipo_acao: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {editTiposAcaoFiltrados.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição / Motivo *</Label>
              <Textarea value={editFormData.descricao} onChange={(e) => setEditFormData({ ...editFormData, descricao: e.target.value })} required rows={4} />
            </div>

            <div className="space-y-2">
              <Label>Impacto Esperado</Label>
              <Textarea value={editFormData.impacto_esperado} onChange={(e) => setEditFormData({ ...editFormData, impacto_esperado: e.target.value })} rows={3} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a ação "{deletingAcao?.tipo_acao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Acoes;
