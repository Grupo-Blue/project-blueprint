import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Plus, CheckCircle, XCircle, HelpCircle, Calendar, Upload, Paperclip, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Hipotese {
  id_hipotese: string;
  descricao: string;
  tipo: string;
  criterio_sucesso: string;
  resultado_semana_seguinte: string | null;
  comentario_resultado: string | null;
  id_campanha: string | null;
  anexos: { nome: string; url: string }[] | null;
  semana: {
    numero_semana: number;
    ano: number;
    data_inicio: string;
  };
  campanha?: {
    nome: string;
  } | null;
  empresa: {
    nome: string;
  };
}

export default function Hipoteses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogResultado, setDialogResultado] = useState(false);
  const [hipoteseSelecionada, setHipoteseSelecionada] = useState<Hipotese | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroResultado, setFiltroResultado] = useState("todos");

  // Form states
  const [formData, setFormData] = useState({
    id_empresa: "",
    id_semana: "",
    id_campanha: "",
    tipo: "",
    descricao: "",
    criterio_sucesso: "",
  });

  const [arquivos, setArquivos] = useState<File[]>([]);

  const [resultadoData, setResultadoData] = useState({
    resultado: "",
    comentario: "",
  });

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

  const { data: campanhas } = useQuery({
    queryKey: ["campanhas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha")
        .select("id_campanha, nome")
        .eq("ativa", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: hipoteses, isLoading } = useQuery({
    queryKey: ["hipoteses", filtroEmpresa, filtroResultado],
    queryFn: async () => {
      let query = supabase
        .from("hipotese_teste")
        .select(`
          *,
          semana:id_semana (numero_semana, ano, data_inicio),
          campanha:id_campanha (nome),
          empresa:id_empresa (nome)
        `)
        .order("created_at", { ascending: false });

      if (filtroEmpresa !== "todas") {
        query = query.eq("id_empresa", filtroEmpresa);
      }

      if (filtroResultado !== "todos") {
        if (filtroResultado === "pendente") {
          query = query.is("resultado_semana_seguinte", null);
        } else {
          query = query.eq("resultado_semana_seguinte", filtroResultado as any);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any as Hipotese[];
    },
  });

  const criarHipoteseMutation = useMutation({
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
        criterio_sucesso: dados.criterio_sucesso,
        anexos: anexosUrls.length > 0 ? anexosUrls : [],
      };

      if (dados.id_campanha) {
        payload.id_campanha = dados.id_campanha;
      }

      const { error } = await supabase.from("hipotese_teste").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hipoteses"] });
      setDialogAberto(false);
      setFormData({
        id_empresa: "",
        id_semana: "",
        id_campanha: "",
        tipo: "",
        descricao: "",
        criterio_sucesso: "",
      });
      setArquivos([]);
      toast({ title: "Hipótese cadastrada", description: "A hipótese foi registrada com sucesso." });
    },
  });

  const atualizarResultadoMutation = useMutation({
    mutationFn: async () => {
      if (!hipoteseSelecionada) return;

      const { error } = await supabase
        .from("hipotese_teste")
        .update({
          resultado_semana_seguinte: resultadoData.resultado as any,
          comentario_resultado: resultadoData.comentario,
        })
        .eq("id_hipotese", hipoteseSelecionada.id_hipotese);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hipoteses"] });
      setDialogResultado(false);
      setHipoteseSelecionada(null);
      setResultadoData({ resultado: "", comentario: "" });
      toast({ title: "Resultado registrado", description: "O resultado da hipótese foi atualizado." });
    },
  });

  const getResultadoBadge = (resultado: string | null) => {
    if (!resultado) {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    const configs: Record<string, { variant: "default" | "destructive" | "outline"; icon: any; label: string }> = {
      VALIDADA: { variant: "default", icon: CheckCircle, label: "Validada" },
      REFUTADA: { variant: "destructive", icon: XCircle, label: "Refutada" },
      INCONCLUSIVA: { variant: "outline", icon: HelpCircle, label: "Inconclusiva" },
    };
    const config = configs[resultado] || configs.INCONCLUSIVA;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Hipóteses de Teste</h1>
            <p className="text-muted-foreground mt-2">
              Registre e acompanhe hipóteses de teste semanais
            </p>
          </div>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Hipótese
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Hipótese de Teste</DialogTitle>
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
                  <label className="text-sm font-medium">Campanha (opcional)</label>
                  <Select value={formData.id_campanha} onValueChange={(v) => setFormData({ ...formData, id_campanha: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma campanha específica" />
                    </SelectTrigger>
                    <SelectContent>
                      {campanhas?.map((c) => (
                        <SelectItem key={c.id_campanha} value={c.id_campanha}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Teste *</label>
                  <Input
                    placeholder="Ex: Criativo, Público, Copy, Segmentação..."
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição da Hipótese *</label>
                  <Textarea
                    placeholder="Descreva a hipótese que será testada..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Como será testada / Métrica de Sucesso *</label>
                  <Textarea
                    placeholder="Descreva como será testada e qual métrica indicará sucesso..."
                    value={formData.criterio_sucesso}
                    onChange={(e) => setFormData({ ...formData, criterio_sucesso: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Anexos (opcional)</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <input
                      type="file"
                      id="file-upload-hipotese"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setArquivos([...arquivos, ...Array.from(e.target.files)]);
                        }
                      }}
                    />
                    <label
                      htmlFor="file-upload-hipotese"
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
                  onClick={() => criarHipoteseMutation.mutate(formData)}
                  disabled={!formData.id_empresa || !formData.id_semana || !formData.tipo || !formData.descricao || !formData.criterio_sucesso || criarHipoteseMutation.isPending}
                >
                  Cadastrar Hipótese
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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

          <Select value={filtroResultado} onValueChange={setFiltroResultado}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Resultados</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="VALIDADA">Validada</SelectItem>
              <SelectItem value="REFUTADA">Refutada</SelectItem>
              <SelectItem value="INCONCLUSIVA">Inconclusiva</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6">
          {hipoteses?.map((hipotese) => (
            <Card key={hipotese.id_hipotese} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">{hipotese.tipo}</CardTitle>
                      {getResultadoBadge(hipotese.resultado_semana_seguinte)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Semana {hipotese.semana.numero_semana}/{hipotese.semana.ano}
                      </span>
                      <span className="font-medium">{hipotese.empresa.nome}</span>
                      {hipotese.campanha && <span>• {hipotese.campanha.nome}</span>}
                    </div>
                  </div>
                  {!hipotese.resultado_semana_seguinte && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHipoteseSelecionada(hipotese);
                        setDialogResultado(true);
                      }}
                    >
                      Registrar Resultado
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Hipótese:</h4>
                  <p className="text-sm text-muted-foreground">{hipotese.descricao}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Critério de Sucesso:</h4>
                  <p className="text-sm text-muted-foreground">{hipotese.criterio_sucesso}</p>
                </div>
                {hipotese.comentario_resultado && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Comentário do Resultado:</h4>
                    <p className="text-sm text-muted-foreground">{hipotese.comentario_resultado}</p>
                  </div>
                )}
                {hipotese.anexos && hipotese.anexos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Anexos:</h4>
                    <div className="space-y-1">
                      {hipotese.anexos.map((anexo, index) => (
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

        {hipoteses?.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">Nenhuma hipótese encontrada</h3>
                <p className="text-muted-foreground">Cadastre sua primeira hipótese de teste.</p>
              </div>
            </div>
          </Card>
        )}

        <Dialog open={dialogResultado} onOpenChange={setDialogResultado}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Resultado da Hipótese</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Resultado *</label>
                <Select value={resultadoData.resultado} onValueChange={(v) => setResultadoData({ ...resultadoData, resultado: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o resultado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VALIDADA">Validada</SelectItem>
                    <SelectItem value="REFUTADA">Refutada</SelectItem>
                    <SelectItem value="INCONCLUSIVA">Inconclusiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comentário / Aprendizado *</label>
                <Textarea
                  placeholder="Descreva o resultado e aprendizados obtidos..."
                  value={resultadoData.comentario}
                  onChange={(e) => setResultadoData({ ...resultadoData, comentario: e.target.value })}
                  rows={4}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => atualizarResultadoMutation.mutate()}
                disabled={!resultadoData.resultado || !resultadoData.comentario || atualizarResultadoMutation.isPending}
              >
                Salvar Resultado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
