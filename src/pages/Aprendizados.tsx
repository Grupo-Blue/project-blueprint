import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Calendar, TrendingUp, Upload, Paperclip, X, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Aprendizado {
  id_aprendizado: string;
  tipo: string;
  descricao: string;
  metricas_suporte: string | null;
  anexos: { nome: string; url: string }[] | null;
  created_at: string;
  semana: {
    numero_semana: number;
    ano: number;
    data_inicio: string;
  };
  empresa: {
    nome: string;
  };
}

interface AprendizadoSugerido {
  tipo: string;
  descricao: string;
  metricas_suporte: string;
}

const tiposAprendizado = [
  { value: "CRIATIVO", label: "Criativo", color: "bg-blue-500" },
  { value: "PUBLICO", label: "Público", color: "bg-purple-500" },
  { value: "OFERTA", label: "Oferta", color: "bg-green-500" },
  { value: "FUNIL", label: "Funil", color: "bg-orange-500" },
  { value: "OUTRO", label: "Outro", color: "bg-gray-500" },
];

export default function Aprendizados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogSugestoes, setDialogSugestoes] = useState(false);
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [sugestoes, setSugestoes] = useState<AprendizadoSugerido[]>([]);
  const [gerandoSugestoes, setGerandoSugestoes] = useState(false);

  const [formData, setFormData] = useState({
    id_empresa: "",
    id_semana: "",
    tipo: "",
    descricao: "",
    metricas_suporte: "",
  });

  const [arquivos, setArquivos] = useState<File[]>([]);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: semanas } = useQuery({
    queryKey: ["semanas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: aprendizados, isLoading } = useQuery({
    queryKey: ["aprendizados", filtroEmpresa, filtroTipo],
    queryFn: async () => {
      let query = supabase
        .from("aprendizado_semana")
        .select(`
          *,
          semana:id_semana (numero_semana, ano, data_inicio),
          empresa:id_empresa (nome)
        `)
        .order("created_at", { ascending: false });

      if (filtroEmpresa !== "todas") {
        query = query.eq("id_empresa", filtroEmpresa);
      }

      if (filtroTipo !== "todos") {
        query = query.eq("tipo", filtroTipo as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any as Aprendizado[];
    },
  });

  const criarAprendizadoMutation = useMutation({
    mutationFn: async (dados: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Upload arquivos se houver
      const anexosUrls: { nome: string; url: string }[] = [];
      for (const arquivo of arquivos) {
        const nomeArquivo = `${userData.user.id}/${Date.now()}_${arquivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from("hipoteses-aprendizados-anexos")
          .upload(nomeArquivo, arquivo);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("hipoteses-aprendizados-anexos")
          .getPublicUrl(nomeArquivo);

        anexosUrls.push({ nome: arquivo.name, url: urlData.publicUrl });
      }

      const payload: any = {
        id_empresa: dados.id_empresa,
        id_semana: dados.id_semana,
        tipo: dados.tipo,
        descricao: dados.descricao,
        anexos: anexosUrls.length > 0 ? anexosUrls : [],
      };

      if (dados.metricas_suporte) {
        payload.metricas_suporte = dados.metricas_suporte;
      }

      const { error } = await supabase.from("aprendizado_semana").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aprendizados"] });
      setDialogAberto(false);
      setFormData({
        id_empresa: "",
        id_semana: "",
        tipo: "",
        descricao: "",
        metricas_suporte: "",
      });
      setArquivos([]);
      toast({ title: "Aprendizado registrado", description: "O aprendizado foi cadastrado com sucesso." });
    },
  });

  const handleGerarSugestoes = async () => {
    if (!filtroEmpresa || filtroEmpresa === "todas") {
      toast({
        title: "Selecione uma empresa",
        description: "É necessário filtrar por uma empresa específica para gerar sugestões.",
        variant: "destructive",
      });
      return;
    }

    setGerandoSugestoes(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-sugestoes-aprendizados", {
        body: { id_empresa: filtroEmpresa },
      });

      if (error) throw error;

      setSugestoes(data.aprendizados);
      setDialogSugestoes(true);
      toast({
        title: "Sugestões geradas",
        description: `${data.aprendizados.length} aprendizados foram sugeridos pela IA.`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar sugestões:", error);
      toast({
        title: "Erro ao gerar sugestões",
        description: error.message || "Não foi possível gerar sugestões neste momento.",
        variant: "destructive",
      });
    } finally {
      setGerandoSugestoes(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    const tipoConfig = tiposAprendizado.find((t) => t.value === tipo);
    if (!tipoConfig) return <Badge>{tipo}</Badge>;
    return (
      <Badge className={`${tipoConfig.color} text-white`}>
        {tipoConfig.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Aprendizados Semanais</h1>
            <p className="text-muted-foreground mt-2">
              Registre e consulte aprendizados de cada semana
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGerarSugestoes}
              disabled={gerandoSugestoes || filtroEmpresa === "todas"}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {gerandoSugestoes ? "Gerando..." : "Sugestões IA"}
            </Button>
            <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Aprendizado
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Aprendizado da Semana</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Empresa *</label>
                  <Select value={formData.id_empresa} onValueChange={(v) => setFormData({ ...formData, id_empresa: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas?.map((e) => (
                        <SelectItem key={e.id_empresa} value={e.id_empresa}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Semana *</label>
                  <Select value={formData.id_semana} onValueChange={(v) => setFormData({ ...formData, id_semana: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {semanas?.map((s) => (
                        <SelectItem key={s.id_semana} value={s.id_semana}>
                          Semana {s.numero_semana}/{s.ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Aprendizado *</label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposAprendizado.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição do Aprendizado *</label>
                  <Textarea
                    placeholder="Descreva o aprendizado obtido nesta semana..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Métricas de Suporte (opcional)</label>
                  <Textarea
                    placeholder='Ex: "CPL caiu de R$50 para R$35", "Taxa de conversão subiu de 2% para 3,5%"'
                    value={formData.metricas_suporte}
                    onChange={(e) => setFormData({ ...formData, metricas_suporte: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Anexos (opcional)</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <input
                      type="file"
                      id="file-upload-aprendizado"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setArquivos([...arquivos, ...Array.from(e.target.files)]);
                        }
                      }}
                    />
                    <label
                      htmlFor="file-upload-aprendizado"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Clique para adicionar arquivos
                      </span>
                    </label>
                  </div>
                  {arquivos.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {arquivos.map((arquivo, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted p-2 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{arquivo.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setArquivos(arquivos.filter((_, i) => i !== index))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => criarAprendizadoMutation.mutate(formData)}
                  disabled={!formData.id_empresa || !formData.id_semana || !formData.tipo || !formData.descricao || criarAprendizadoMutation.isPending}
                >
                  Registrar Aprendizado
                </Button>
              </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog open={dialogSugestoes} onOpenChange={setDialogSugestoes}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Sugestões de Aprendizados pela IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Baseado nos dados históricos, a IA sugeriu os seguintes aprendizados:
              </p>
              {sugestoes.map((sugestao, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  setFormData({
                    ...formData,
                    tipo: sugestao.tipo,
                    descricao: sugestao.descricao,
                    metricas_suporte: sugestao.metricas_suporte,
                  });
                  setDialogSugestoes(false);
                  setDialogAberto(true);
                }}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {getTipoBadge(sugestao.tipo)}
                      <div className="flex-1">
                        <p className="text-sm">{sugestao.descricao}</p>
                      </div>
                    </div>
                  </CardHeader>
                  {sugestao.metricas_suporte && (
                    <CardContent>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold text-sm">Métricas:</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{sugestao.metricas_suporte}</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-4">
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Empresas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id_empresa} value={e.id_empresa}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              {tiposAprendizado.map((tipo) => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6">
          {aprendizados?.map((aprendizado) => (
            <Card key={aprendizado.id_aprendizado} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">Aprendizado</CardTitle>
                      {getTipoBadge(aprendizado.tipo)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Semana {aprendizado.semana.numero_semana}/{aprendizado.semana.ano}
                      </span>
                      <span className="font-medium">{aprendizado.empresa.nome}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(aprendizado.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm">{aprendizado.descricao}</p>
                </div>
                {aprendizado.metricas_suporte && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Métricas de Suporte:</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{aprendizado.metricas_suporte}</p>
                  </div>
                )}
                {aprendizado.anexos && aprendizado.anexos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Anexos:</h4>
                    <div className="space-y-1">
                      {aprendizado.anexos.map((anexo, index) => (
                        <a
                          key={index}
                          href={anexo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="h-3 w-3" />
                          {anexo.nome}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {aprendizados?.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">Nenhum aprendizado encontrado</h3>
                <p className="text-muted-foreground">Registre o primeiro aprendizado da semana.</p>
              </div>
            </div>
          </Card>
        )}
      </div>
  );
}
