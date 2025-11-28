import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Sugestao {
  categoria: "A" | "B" | "C";
  tipo_acao: string;
  empresa: string;
  descricao: string;
  impacto_esperado: string;
  prioridade: "Alta" | "Média" | "Baixa";
}

interface SugestoesIAProps {
  onAcaoCriada?: () => void;
}

export const SugestoesIA = ({ onAcaoCriada }: SugestoesIAProps) => {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [contexto, setContexto] = useState<any>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<Sugestao | null>(null);
  const [criandoAcao, setCriandoAcao] = useState(false);
  const { toast } = useToast();

  const gerarSugestoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-sugestoes-acoes", {
        body: {},
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Erro ao gerar sugestões",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setSugestoes(data.sugestoes || []);
      setContexto(data.contexto_analise);

      toast({
        title: "Sugestões geradas!",
        description: `${data.sugestoes?.length || 0} ações sugeridas pela IA`,
      });
    } catch (error: any) {
      console.error("Erro ao gerar sugestões:", error);
      toast({
        title: "Erro ao gerar sugestões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoriaColor = (categoria: "A" | "B" | "C") => {
    switch (categoria) {
      case "A":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "B":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "C":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
  };

  const getPrioridadeIcon = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "Média":
        return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      case "Baixa":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
  };

  const abrirDialogCriarAcao = (sugestao: Sugestao) => {
    setSugestaoSelecionada(sugestao);
    setDialogAberto(true);
  };

  const criarAcaoAPartirDeSugestao = async () => {
    if (!sugestaoSelecionada) return;

    setCriandoAcao(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar ID da empresa
      const { data: empresaData } = await supabase
        .from("empresa")
        .select("id_empresa")
        .eq("nome", sugestaoSelecionada.empresa)
        .maybeSingle();

      if (!empresaData) {
        toast({
          title: "Empresa não encontrada",
          description: `Empresa "${sugestaoSelecionada.empresa}" não existe no sistema`,
          variant: "destructive",
        });
        return;
      }

      const status =
        sugestaoSelecionada.categoria === "A"
          ? "EXECUTADA"
          : sugestaoSelecionada.categoria === "B"
          ? "EXECUTADA"
          : "PENDENTE";

      const { error } = await supabase.from("acao").insert([
        {
          id_empresa: empresaData.id_empresa,
          categoria: sugestaoSelecionada.categoria,
          tipo_acao: sugestaoSelecionada.tipo_acao,
          descricao: sugestaoSelecionada.descricao + "\n\n[Sugestão gerada por IA]",
          impacto_esperado: sugestaoSelecionada.impacto_esperado,
          id_usuario: user.id,
          status,
          data_execucao: sugestaoSelecionada.categoria !== "C" ? new Date().toISOString() : null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Ação criada!",
        description:
          sugestaoSelecionada.categoria === "C"
            ? "Aguardando aprovação da direção"
            : "Ação registrada com sucesso",
      });

      setDialogAberto(false);
      setSugestaoSelecionada(null);
      
      // Remover sugestão da lista
      setSugestoes((prev) => prev.filter((s) => s !== sugestaoSelecionada));

      // Callback para atualizar lista de ações
      if (onAcaoCriada) onAcaoCriada();
    } catch (error: any) {
      toast({
        title: "Erro ao criar ação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCriandoAcao(false);
    }
  };

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Sugestões Automáticas de Ações</CardTitle>
                <CardDescription>
                  IA analisa métricas, alertas e tendências para sugerir ações A/B/C
                </CardDescription>
              </div>
            </div>
            <Button onClick={gerarSugestoes} disabled={loading} size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Analisando..." : "Gerar Sugestões"}
            </Button>
          </div>
        </CardHeader>

        {contexto && (
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>📊 {contexto.total_campanhas_analisadas} campanhas</span>
              <span>🎨 {contexto.total_criativos_analisados} criativos</span>
              <span>⚠️ {contexto.total_alertas} alertas ativos</span>
              <span>📅 {contexto.periodo}</span>
            </div>
          </CardContent>
        )}

        {sugestoes.length > 0 && (
          <CardContent className="space-y-3 pt-0">
            {sugestoes.map((sugestao, index) => (
              <Card key={index} className="border-l-4" style={{ borderLeftColor: sugestao.categoria === "A" ? "#22c55e" : sugestao.categoria === "B" ? "#eab308" : "#ef4444" }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getCategoriaColor(sugestao.categoria)}>
                          Categoria {sugestao.categoria}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {getPrioridadeIcon(sugestao.prioridade)}
                          <span className="text-xs font-medium">{sugestao.prioridade}</span>
                        </div>
                      </div>
                      <CardTitle className="text-base">{sugestao.tipo_acao}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {sugestao.empresa}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDialogCriarAcao(sugestao)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Criar Ação
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {sugestao.descricao}
                    </p>
                  </div>
                  <div className="bg-secondary/30 p-3 rounded-md">
                    <p className="text-xs font-medium mb-1">💡 Impacto Esperado:</p>
                    <p className="text-xs text-muted-foreground">{sugestao.impacto_esperado}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        )}

        {!loading && sugestoes.length === 0 && (
          <CardContent>
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Clique em "Gerar Sugestões" para obter recomendações da IA
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Ação a partir de Sugestão da IA</DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de criar a ação
            </DialogDescription>
          </DialogHeader>

          {sugestaoSelecionada && (
            <div className="space-y-4">
              <div>
                <Label>Categoria</Label>
                <Badge className={`${getCategoriaColor(sugestaoSelecionada.categoria)} mt-1`}>
                  Categoria {sugestaoSelecionada.categoria}
                </Badge>
              </div>

              <div>
                <Label>Empresa</Label>
                <p className="text-sm mt-1">{sugestaoSelecionada.empresa}</p>
              </div>

              <div>
                <Label>Tipo de Ação</Label>
                <p className="text-sm mt-1">{sugestaoSelecionada.tipo_acao}</p>
              </div>

              <div>
                <Label>Descrição / Motivo</Label>
                <Textarea
                  value={sugestaoSelecionada.descricao + "\n\n[Sugestão gerada por IA]"}
                  readOnly
                  rows={6}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Impacto Esperado</Label>
                <Textarea
                  value={sugestaoSelecionada.impacto_esperado}
                  readOnly
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setDialogAberto(false)}>
                  Cancelar
                </Button>
                <Button onClick={criarAcaoAPartirDeSugestao} disabled={criandoAcao}>
                  {criandoAcao ? "Criando..." : "Criar Ação"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
