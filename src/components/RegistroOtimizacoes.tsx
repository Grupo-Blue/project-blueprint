import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { 
  Plus, 
  Filter, 
  Calendar,
  User,
  Building2,
  Edit,
  Trash2,
  FileText,
  Tag
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

type PlataformaOtimizacao = "META" | "GOOGLE" | "AMBAS" | "GERAL";

interface RegistroOtimizacao {
  id_registro: string;
  id_empresa: string | null;
  id_usuario: string;
  semana_referencia: string;
  plataforma: PlataformaOtimizacao;
  tipo_otimizacao: string;
  descricao: string;
  impacto_resultado: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  empresa?: { nome: string } | null;
  usuario?: { nome: string } | null;
}

const TIPOS_OTIMIZACAO = [
  "Ajustes de Orçamento",
  "Públicos/Segmentação",
  "Criativos",
  "Estratégia de Lance",
  "Estrutura de Campanhas",
  "Testes A/B",
  "Correções/Fixes",
  "Pausas/Ativações",
  "Métricas/Análise",
  "Outro"
];

const gerarSemanasRecentes = () => {
  const semanas = [];
  for (let i = 0; i < 8; i++) {
    const dataRef = subWeeks(new Date(), i);
    const semana = getWeek(dataRef, { locale: ptBR });
    const ano = getYear(dataRef);
    const inicio = startOfWeek(dataRef, { weekStartsOn: 0 });
    const fim = endOfWeek(dataRef, { weekStartsOn: 0 });
    semanas.push({
      value: `S${String(semana).padStart(2, "0")}/${ano}`,
      label: `S${String(semana).padStart(2, "0")}/${ano} (${format(inicio, "dd/MM")} - ${format(fim, "dd/MM")})`
    });
  }
  return semanas;
};

interface RegistroOtimizacoesProps {
  empresas: { id_empresa: string; nome: string }[];
  profile: { id: string; nome: string; perfil: string } | null;
}

const RegistroOtimizacoes = ({ empresas, profile }: RegistroOtimizacoesProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroOtimizacao | null>(null);
  const [filtroSemana, setFiltroSemana] = useState<string>("TODAS");
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>("TODAS");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaSelecionada } = useEmpresa();

  const semanasRecentes = gerarSemanasRecentes();

  const [formData, setFormData] = useState({
    id_empresa: "",
    semana_referencia: semanasRecentes[1]?.value || "",
    plataforma: "GERAL" as PlataformaOtimizacao,
    tipo_otimizacao: "",
    descricao: "",
    impacto_resultado: "",
    tags: ""
  });

  const isAdmin = profile?.perfil === "ADMIN";
  const isDirecao = profile?.perfil === "DIRECAO" || isAdmin;

  const { data: registros, isLoading } = useQuery({
    queryKey: ["registros-otimizacao", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("registro_otimizacao")
        .select("*")
        .order("created_at", { ascending: false });

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch empresas e usuarios
      const empresaIds = [...new Set(data?.map(r => r.id_empresa).filter(Boolean) || [])] as string[];
      const userIds = [...new Set(data?.map(r => r.id_usuario) || [])] as string[];

      const [empresasRes, profilesRes] = await Promise.all([
        empresaIds.length > 0 
          ? supabase.from("empresa").select("id_empresa, nome").in("id_empresa", empresaIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from("profiles").select("id, nome").in("id", userIds)
          : { data: [] }
      ]);

      const empresasMap = new Map<string, { id_empresa: string; nome: string }>();
      empresasRes.data?.forEach(e => empresasMap.set(e.id_empresa, e));
      
      const profilesMap = new Map<string, { id: string; nome: string }>();
      profilesRes.data?.forEach(p => profilesMap.set(p.id, p));

      return data?.map(r => ({
        ...r,
        empresa: r.id_empresa ? empresasMap.get(r.id_empresa) || null : null,
        usuario: profilesMap.get(r.id_usuario) || null
      })) as RegistroOtimizacao[];
    },
    staleTime: 30000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const tags = formData.tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const registroData = {
        id_empresa: formData.id_empresa || null,
        id_usuario: user.id,
        semana_referencia: formData.semana_referencia,
        plataforma: formData.plataforma,
        tipo_otimizacao: formData.tipo_otimizacao,
        descricao: formData.descricao,
        impacto_resultado: formData.impacto_resultado || null,
        tags: tags.length > 0 ? tags : null,
      };

      if (editingRegistro) {
        const { error } = await supabase
          .from("registro_otimizacao")
          .update(registroData)
          .eq("id_registro", editingRegistro.id_registro);
        if (error) throw error;
        toast({ title: "Registro atualizado!" });
      } else {
        const { error } = await supabase
          .from("registro_otimizacao")
          .insert([registroData]);
        if (error) throw error;
        toast({ title: "Registro criado!" });
      }

      setDialogOpen(false);
      setEditingRegistro(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["registros-otimizacao"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      id_empresa: "",
      semana_referencia: semanasRecentes[1]?.value || "",
      plataforma: "GERAL",
      tipo_otimizacao: "",
      descricao: "",
      impacto_resultado: "",
      tags: ""
    });
  };

  const handleEdit = (registro: RegistroOtimizacao) => {
    setEditingRegistro(registro);
    setFormData({
      id_empresa: registro.id_empresa || "",
      semana_referencia: registro.semana_referencia,
      plataforma: registro.plataforma,
      tipo_otimizacao: registro.tipo_otimizacao,
      descricao: registro.descricao,
      impacto_resultado: registro.impacto_resultado || "",
      tags: registro.tags?.join(", ") || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      const { error } = await supabase
        .from("registro_otimizacao")
        .delete()
        .eq("id_registro", id);
      if (error) throw error;
      toast({ title: "Registro excluído!" });
      queryClient.invalidateQueries({ queryKey: ["registros-otimizacao"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = (registro: RegistroOtimizacao) => {
    return isDirecao || registro.id_usuario === profile?.id;
  };

  const getPlataformaColor = (plataforma: PlataformaOtimizacao) => {
    switch (plataforma) {
      case "META": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "GOOGLE": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "AMBAS": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const registrosFiltrados = registros?.filter(r => {
    const semanaMatch = filtroSemana === "TODAS" || r.semana_referencia === filtroSemana;
    const plataformaMatch = filtroPlataforma === "TODAS" || r.plataforma === filtroPlataforma;
    return semanaMatch && plataformaMatch;
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingRegistro(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRegistro ? "Editar Registro" : "Novo Registro de Otimização"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="semana">Semana de Referência *</Label>
                  <Select 
                    value={formData.semana_referencia} 
                    onValueChange={(value) => setFormData({ ...formData, semana_referencia: value })}
                    required
                  >
                    <SelectTrigger id="semana"><SelectValue placeholder="Selecione a semana" /></SelectTrigger>
                    <SelectContent>
                      {semanasRecentes.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa (opcional)</Label>
                  <Select 
                    value={formData.id_empresa || "__NONE__"} 
                    onValueChange={(value) => setFormData({ ...formData, id_empresa: value === "__NONE__" ? "" : value })}
                  >
                    <SelectTrigger id="empresa"><SelectValue placeholder="Geral/Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">Geral/Todas</SelectItem>
                      {empresas.map(e => (
                        <SelectItem key={e.id_empresa} value={e.id_empresa}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plataforma">Plataforma *</Label>
                  <Select 
                    value={formData.plataforma} 
                    onValueChange={(value: PlataformaOtimizacao) => setFormData({ ...formData, plataforma: value })}
                    required
                  >
                    <SelectTrigger id="plataforma"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="META">META</SelectItem>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="AMBAS">Ambas</SelectItem>
                      <SelectItem value="GERAL">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Otimização *</Label>
                  <Select 
                    value={formData.tipo_otimizacao} 
                    onValueChange={(value) => setFormData({ ...formData, tipo_otimizacao: value })}
                    required
                  >
                    <SelectTrigger id="tipo"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_OTIMIZACAO.map(tipo => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição das Otimizações *</Label>
                <Textarea 
                  id="descricao" 
                  placeholder="Descreva as otimizações realizadas na semana..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  required
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="impacto">Impacto/Resultado (opcional)</Label>
                <Textarea 
                  id="impacto" 
                  placeholder="Resultados observados após as otimizações..."
                  value={formData.impacto_resultado}
                  onChange={(e) => setFormData({ ...formData, impacto_resultado: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (opcional, separadas por vírgula)</Label>
                <Input 
                  id="tags" 
                  placeholder="Ex: escala, teste, correção"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingRegistro ? "Salvar Alterações" : "Registrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="filtro-semana" className="text-sm">Semana</Label>
            <Select value={filtroSemana} onValueChange={setFiltroSemana}>
              <SelectTrigger id="filtro-semana"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                {semanasRecentes.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="filtro-plataforma" className="text-sm">Plataforma</Label>
            <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
              <SelectTrigger id="filtro-plataforma"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="META">META</SelectItem>
                <SelectItem value="GOOGLE">Google</SelectItem>
                <SelectItem value="AMBAS">Ambas</SelectItem>
                <SelectItem value="GERAL">Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando registros...</p>
        </Card>
      ) : registrosFiltrados.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Nenhum registro encontrado</p>
          <p className="text-sm text-muted-foreground">
            Registre suas otimizações semanais para manter o histórico
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registrosFiltrados.map((registro) => (
            <Card key={registro.id_registro} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      <Calendar className="h-3 w-3 mr-1" />
                      {registro.semana_referencia}
                    </Badge>
                    <Badge className={getPlataformaColor(registro.plataforma)}>
                      {registro.plataforma}
                    </Badge>
                    <Badge variant="secondary">{registro.tipo_otimizacao}</Badge>
                  </div>
                  {canEdit(registro) && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(registro)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(registro.id_registro)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {registro.empresa && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {registro.empresa.nome}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {registro.usuario?.nome || "N/A"}
                  </span>
                </div>

                <div>
                  <p className="text-sm whitespace-pre-wrap">{registro.descricao}</p>
                </div>

                {registro.impacto_resultado && (
                  <div className="bg-green-500/5 border border-green-500/20 p-3 rounded-md">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Impacto/Resultado:</p>
                    <p className="text-sm whitespace-pre-wrap">{registro.impacto_resultado}</p>
                  </div>
                )}

                {registro.tags && registro.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {registro.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2 text-xs text-muted-foreground">
                Criado em {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegistroOtimizacoes;
