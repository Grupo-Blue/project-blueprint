import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Filter, Calendar, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CategoriaAcao = "A" | "B" | "C";
type StatusAcao = "PENDENTE" | "APROVADA" | "REPROVADA" | "EXECUTADA";

interface Acao {
  id_acao: string;
  categoria: CategoriaAcao;
  tipo_acao: string;
  descricao: string;
  impacto_esperado: string;
  status: StatusAcao;
  data_criacao: string;
  data_execucao: string | null;
  motivo_reprovacao: string | null;
  empresa: { nome: string } | null;
  usuario: { nome: string } | null;
}

const Acoes = () => {
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    id_empresa: "",
    categoria: "A" as CategoriaAcao,
    tipo_acao: "",
    descricao: "",
    impacto_esperado: "",
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await Promise.all([fetchAcoes(), fetchEmpresas()]);
  };

  const fetchAcoes = async () => {
    try {
      const { data, error } = await supabase
        .from("acao")
        .select("*, empresa(nome)")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      
      // Buscar profiles para cada ação
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
      };

      const { error } = await supabase.from("acao").insert([dataAcao]);

      if (error) throw error;

      toast({
        title: "Ação cadastrada!",
        description: formData.categoria === "C" 
          ? "Aguardando aprovação da direção" 
          : "Ação registrada com sucesso",
      });

      setDialogOpen(false);
      setFormData({
        id_empresa: "",
        categoria: "A",
        tipo_acao: "",
        descricao: "",
        impacto_esperado: "",
      });
      fetchAcoes();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar ação",
        description: error.message,
        variant: "destructive",
      });
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
    const labels = {
      EXECUTADA: "Executada",
      APROVADA: "Aprovada",
      PENDENTE: "Pendente",
      REPROVADA: "Reprovada",
    };
    return labels[status];
  };

  const acoesFiltradas = acoes.filter((acao) => {
    const categoriaMatch = filtroCategoria === "TODAS" || acao.categoria === filtroCategoria;
    const statusMatch = filtroStatus === "TODOS" || acao.status === filtroStatus;
    return categoriaMatch && statusMatch;
  });

  const tiposAcao = [
    "Criar nova campanha",
    "Ajustar orçamento (+/- até 30%)",
    "Escalar campanha (>30%)",
    "Pausar campanha",
    "Testar novo funil",
    "Trocar objetivo da campanha",
    "Alterar ICP",
    "Criativo novo",
    "Landing page nova",
    "Campanha sobre tema sensível",
    "Outro",
  ];

  if (loading && acoes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando ações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Governança A/B/C</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe ações de tráfego</p>
        </div>
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
                <Select
                  value={formData.id_empresa}
                  onValueChange={(value) => setFormData({ ...formData, id_empresa: value })}
                  required
                >
                  <SelectTrigger id="empresa">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value: CategoriaAcao) => setFormData({ ...formData, categoria: value })}
                  required
                >
                  <SelectTrigger id="categoria">
                    <SelectValue />
                  </SelectTrigger>
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
                <Select
                  value={formData.tipo_acao}
                  onValueChange={(value) => setFormData({ ...formData, tipo_acao: value })}
                  required
                >
                  <SelectTrigger id="tipo_acao">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAcao.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição / Motivo *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva a ação e o motivo, citando métricas relevantes..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  required
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="impacto_esperado">Impacto Esperado</Label>
                <Textarea
                  id="impacto_esperado"
                  placeholder="Qual o resultado esperado desta ação?"
                  value={formData.impacto_esperado}
                  onChange={(e) => setFormData({ ...formData, impacto_esperado: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Cadastrando..." : "Cadastrar Ação"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
              <SelectTrigger id="filtro-categoria">
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger id="filtro-status">
                <SelectValue />
              </SelectTrigger>
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
                {acoes.length === 0
                  ? "Cadastre sua primeira ação para começar"
                  : "Tente ajustar os filtros"}
              </p>
            </CardContent>
          </Card>
        ) : (
          acoesFiltradas.map((acao) => (
            <Card key={acao.id_acao} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-2">
                    <Badge className={getCategoriaColor(acao.categoria)}>
                      Categoria {acao.categoria}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {getStatusIcon(acao.status)}
                      {getStatusLabel(acao.status)}
                    </Badge>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(acao.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{acao.tipo_acao}</h3>
                    <p className="text-sm text-muted-foreground">
                      {acao.empresa?.nome || "N/A"} • Por: {acao.usuario?.nome || "N/A"}
                    </p>
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Acoes;
