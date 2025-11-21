import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit, History, DollarSign, Target, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Empresa {
  id_empresa: string;
  nome: string;
  cpl_maximo: number;
  cac_maximo: number;
  ticket_medio_alvo: number;
  meta_conversao_lead_venda: number;
  lucro_minimo_por_venda: number;
  margem_minima_percentual: number;
  dias_alerta_cpl: number;
  semanas_alerta_cac: number;
  created_at: string;
  updated_at: string;
}

interface LogAcao {
  id_log: string;
  acao: string;
  data_log: string;
  valores_antes: any;
  valores_depois: any;
  tabela_afetada: string;
}

export default function Empresas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogHistorico, setDialogHistorico] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [modo, setModo] = useState<"criar" | "editar">("criar");

  const [formData, setFormData] = useState({
    nome: "",
    cpl_maximo: "",
    cac_maximo: "",
    ticket_medio_alvo: "",
    meta_conversao_lead_venda: "",
    lucro_minimo_por_venda: "",
    margem_minima_percentual: "",
    dias_alerta_cpl: "3",
    semanas_alerta_cac: "2",
  });

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas-gestao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["historico-empresa", empresaSelecionada?.id_empresa],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      
      const { data, error } = await supabase
        .from("log_acao")
        .select("*")
        .eq("tabela_afetada", "empresa")
        .eq("id_registro", empresaSelecionada.id_empresa)
        .order("data_log", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as LogAcao[];
    },
    enabled: !!empresaSelecionada && dialogHistorico,
  });

  const criarEmpresaMutation = useMutation({
    mutationFn: async (dados: typeof formData) => {
      const { error } = await supabase.from("empresa").insert({
        nome: dados.nome,
        cpl_maximo: parseFloat(dados.cpl_maximo),
        cac_maximo: parseFloat(dados.cac_maximo),
        ticket_medio_alvo: parseFloat(dados.ticket_medio_alvo),
        meta_conversao_lead_venda: parseFloat(dados.meta_conversao_lead_venda),
        lucro_minimo_por_venda: parseFloat(dados.lucro_minimo_por_venda),
        margem_minima_percentual: parseFloat(dados.margem_minima_percentual),
        dias_alerta_cpl: parseInt(dados.dias_alerta_cpl),
        semanas_alerta_cac: parseInt(dados.semanas_alerta_cac),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-gestao"] });
      setDialogAberto(false);
      resetForm();
      toast({ title: "Empresa criada", description: "A empresa foi cadastrada com sucesso." });
    },
  });

  const editarEmpresaMutation = useMutation({
    mutationFn: async (dados: typeof formData) => {
      if (!empresaSelecionada) return;

      const { error } = await supabase
        .from("empresa")
        .update({
          nome: dados.nome,
          cpl_maximo: parseFloat(dados.cpl_maximo),
          cac_maximo: parseFloat(dados.cac_maximo),
          ticket_medio_alvo: parseFloat(dados.ticket_medio_alvo),
          meta_conversao_lead_venda: parseFloat(dados.meta_conversao_lead_venda),
          lucro_minimo_por_venda: parseFloat(dados.lucro_minimo_por_venda),
          margem_minima_percentual: parseFloat(dados.margem_minima_percentual),
          dias_alerta_cpl: parseInt(dados.dias_alerta_cpl),
          semanas_alerta_cac: parseInt(dados.semanas_alerta_cac),
        })
        .eq("id_empresa", empresaSelecionada.id_empresa);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-gestao"] });
      setDialogAberto(false);
      resetForm();
      setEmpresaSelecionada(null);
      toast({ title: "Empresa atualizada", description: "Os dados foram atualizados com sucesso." });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cpl_maximo: "",
      cac_maximo: "",
      ticket_medio_alvo: "",
      meta_conversao_lead_venda: "",
      lucro_minimo_por_venda: "",
      margem_minima_percentual: "",
      dias_alerta_cpl: "3",
      semanas_alerta_cac: "2",
    });
    setModo("criar");
  };

  const abrirDialogCriar = () => {
    resetForm();
    setDialogAberto(true);
  };

  const abrirDialogEditar = (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    setFormData({
      nome: empresa.nome,
      cpl_maximo: empresa.cpl_maximo.toString(),
      cac_maximo: empresa.cac_maximo.toString(),
      ticket_medio_alvo: empresa.ticket_medio_alvo.toString(),
      meta_conversao_lead_venda: empresa.meta_conversao_lead_venda.toString(),
      lucro_minimo_por_venda: empresa.lucro_minimo_por_venda.toString(),
      margem_minima_percentual: empresa.margem_minima_percentual.toString(),
      dias_alerta_cpl: empresa.dias_alerta_cpl.toString(),
      semanas_alerta_cac: empresa.semanas_alerta_cac.toString(),
    });
    setModo("editar");
    setDialogAberto(true);
  };

  const abrirHistorico = (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    setDialogHistorico(true);
  };

  const handleSubmit = () => {
    if (modo === "criar") {
      criarEmpresaMutation.mutate(formData);
    } else {
      editarEmpresaMutation.mutate(formData);
    }
  };

  const formatarValor = (campo: string, valor: any) => {
    if (valor === null || valor === undefined) return "N/A";
    
    if (campo.includes("maximo") || campo.includes("medio") || campo.includes("lucro")) {
      return `R$ ${parseFloat(valor).toFixed(2)}`;
    }
    if (campo.includes("percentual") || campo.includes("conversao")) {
      return `${parseFloat(valor).toFixed(2)}%`;
    }
    if (campo.includes("dias") || campo.includes("semanas")) {
      return valor.toString();
    }
    return valor.toString();
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
            <h1 className="text-4xl font-bold text-foreground">Gestão de Empresas</h1>
            <p className="text-muted-foreground mt-2">
              Configure parâmetros financeiros e metas de cada empresa
            </p>
          </div>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button onClick={abrirDialogCriar}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {modo === "criar" ? "Cadastrar Nova Empresa" : "Editar Empresa"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Empresa *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Blue Agency"
                  />
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Parâmetros de Custo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpl_maximo">CPL Máximo (R$) *</Label>
                      <Input
                        id="cpl_maximo"
                        type="number"
                        step="0.01"
                        value={formData.cpl_maximo}
                        onChange={(e) => setFormData({ ...formData, cpl_maximo: e.target.value })}
                        placeholder="Ex: 50.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cac_maximo">CAC Máximo (R$) *</Label>
                      <Input
                        id="cac_maximo"
                        type="number"
                        step="0.01"
                        value={formData.cac_maximo}
                        onChange={(e) => setFormData({ ...formData, cac_maximo: e.target.value })}
                        placeholder="Ex: 500.00"
                      />
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Metas e Margens
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ticket_medio_alvo">Ticket Médio Alvo (R$) *</Label>
                      <Input
                        id="ticket_medio_alvo"
                        type="number"
                        step="0.01"
                        value={formData.ticket_medio_alvo}
                        onChange={(e) => setFormData({ ...formData, ticket_medio_alvo: e.target.value })}
                        placeholder="Ex: 5000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meta_conversao_lead_venda">Meta Conversão Lead → Venda (%) *</Label>
                      <Input
                        id="meta_conversao_lead_venda"
                        type="number"
                        step="0.01"
                        value={formData.meta_conversao_lead_venda}
                        onChange={(e) => setFormData({ ...formData, meta_conversao_lead_venda: e.target.value })}
                        placeholder="Ex: 5.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lucro_minimo_por_venda">Lucro Mínimo por Venda (R$) *</Label>
                      <Input
                        id="lucro_minimo_por_venda"
                        type="number"
                        step="0.01"
                        value={formData.lucro_minimo_por_venda}
                        onChange={(e) => setFormData({ ...formData, lucro_minimo_por_venda: e.target.value })}
                        placeholder="Ex: 1000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="margem_minima_percentual">Margem Mínima (%) *</Label>
                      <Input
                        id="margem_minima_percentual"
                        type="number"
                        step="0.01"
                        value={formData.margem_minima_percentual}
                        onChange={(e) => setFormData({ ...formData, margem_minima_percentual: e.target.value })}
                        placeholder="Ex: 20.00"
                      />
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Configuração de Alertas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dias_alerta_cpl">Dias Consecutivos Alerta CPL *</Label>
                      <Input
                        id="dias_alerta_cpl"
                        type="number"
                        value={formData.dias_alerta_cpl}
                        onChange={(e) => setFormData({ ...formData, dias_alerta_cpl: e.target.value })}
                        placeholder="Ex: 3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Número de dias com CPL acima do máximo para gerar alerta
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="semanas_alerta_cac">Semanas Consecutivas Alerta CAC *</Label>
                      <Input
                        id="semanas_alerta_cac"
                        type="number"
                        value={formData.semanas_alerta_cac}
                        onChange={(e) => setFormData({ ...formData, semanas_alerta_cac: e.target.value })}
                        placeholder="Ex: 2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Número de semanas com CAC acima do máximo para gerar alerta
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={
                    !formData.nome ||
                    !formData.cpl_maximo ||
                    !formData.cac_maximo ||
                    !formData.ticket_medio_alvo ||
                    !formData.meta_conversao_lead_venda ||
                    !formData.lucro_minimo_por_venda ||
                    !formData.margem_minima_percentual ||
                    criarEmpresaMutation.isPending ||
                    editarEmpresaMutation.isPending
                  }
                >
                  {modo === "criar" ? "Cadastrar Empresa" : "Salvar Alterações"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {empresas?.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <Building2 className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-xl font-semibold">Nenhuma empresa cadastrada</h3>
                  <p className="text-muted-foreground">Cadastre a primeira empresa do sistema.</p>
                </div>
              </div>
            </Card>
          ) : (
            empresas?.map((empresa) => (
              <Card key={empresa.id_empresa} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <CardTitle className="flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-primary" />
                        {empresa.nome}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Criada em {format(new Date(empresa.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirHistorico(empresa)}
                      >
                        <History className="h-4 w-4 mr-2" />
                        Histórico
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDialogEditar(empresa)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Custos Máximos
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">CPL Máximo</p>
                          <p className="font-medium">R$ {empresa.cpl_maximo.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CAC Máximo</p>
                          <p className="font-medium">R$ {empresa.cac_maximo.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Metas
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Ticket Médio Alvo</p>
                          <p className="font-medium">R$ {empresa.ticket_medio_alvo.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conversão Lead → Venda</p>
                          <p className="font-medium">{empresa.meta_conversao_lead_venda.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Margens
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Lucro Mínimo/Venda</p>
                          <p className="font-medium">R$ {empresa.lucro_minimo_por_venda.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Margem Mínima</p>
                          <p className="font-medium">{empresa.margem_minima_percentual.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        Alertas
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Dias Alerta CPL</p>
                          <p className="font-medium">{empresa.dias_alerta_cpl} dias</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Semanas Alerta CAC</p>
                          <p className="font-medium">{empresa.semanas_alerta_cac} semanas</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog de Histórico */}
        <Dialog open={dialogHistorico} onOpenChange={setDialogHistorico}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações - {empresaSelecionada?.nome}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {historico?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma alteração registrada
                  </p>
                ) : (
                  historico?.map((log) => (
                    <Card key={log.id_log}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge variant={log.acao === "UPDATE" ? "default" : "secondary"}>
                            {log.acao}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(log.data_log), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {log.valores_antes && log.valores_depois && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <h5 className="font-semibold mb-2">Valores Anteriores:</h5>
                                <div className="space-y-1">
                                  {Object.entries(log.valores_antes).map(([campo, valor]) => (
                                    <div key={campo} className="text-muted-foreground">
                                      <span className="font-medium">{campo}:</span> {formatarValor(campo, valor)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h5 className="font-semibold mb-2">Novos Valores:</h5>
                                <div className="space-y-1">
                                  {Object.entries(log.valores_depois).map(([campo, valor]) => (
                                    <div key={campo} className="text-foreground">
                                      <span className="font-medium">{campo}:</span> {formatarValor(campo, valor)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
