import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, FileDown, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function RelatorioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [textoComparacao, setTextoComparacao] = useState("");
  const [aprendizadoResumo, setAprendizadoResumo] = useState("");
  const [exportando, setExportando] = useState(false);

  const { data: relatorio, isLoading } = useQuery({
    queryKey: ["relatorio", id],
    queryFn: async () => {
      if (id === "novo") return null;
      
      const { data, error } = await supabase
        .from("relatorio_semanal")
        .select(`
          *,
          empresa:id_empresa (nome),
          semana:id_semana (numero_semana, ano, data_inicio, data_fim)
        `)
        .eq("id_relatorio", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: id !== "novo",
  });

  const { data: metricas } = useQuery({
    queryKey: ["metricas-semana", relatorio?.id_semana],
    queryFn: async () => {
      if (!relatorio?.id_semana) return null;

      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select("*")
        .eq("id_empresa", relatorio.id_empresa)
        .eq("id_semana", relatorio.id_semana)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!relatorio?.id_semana,
  });

  const { data: metricasCampanha } = useQuery({
    queryKey: ["metricas-campanha", relatorio?.id_semana],
    queryFn: async () => {
      if (!relatorio?.id_semana) return [];

      const { data, error } = await supabase
        .from("campanha_semana_metricas")
        .select(`
          *,
          campanha:id_campanha (nome)
        `)
        .eq("id_semana", relatorio.id_semana);

      if (error) throw error;
      return data;
    },
    enabled: !!relatorio?.id_semana,
  });

  const { data: acoes } = useQuery({
    queryKey: ["acoes-semana", relatorio?.id_semana],
    queryFn: async () => {
      if (!relatorio?.id_semana || !relatorio?.semana) return [];

      const { data, error } = await supabase
        .from("acao")
        .select("*")
        .eq("id_empresa", relatorio.id_empresa)
        .gte("data_criacao", relatorio.semana.data_inicio)
        .lte("data_criacao", relatorio.semana.data_fim)
        .in("status", ["APROVADA", "EXECUTADA"]);

      if (error) throw error;
      return data;
    },
    enabled: !!relatorio?.id_semana && !!relatorio?.semana,
  });

  useEffect(() => {
    if (relatorio) {
      setTextoComparacao(relatorio.texto_comparacao || "");
      setAprendizadoResumo(relatorio.aprendizado_resumo || "");
    }
  }, [relatorio]);

  const salvarMutation = useMutation({
    mutationFn: async (status: string) => {
      const dadosAtualizacao: any = {
        texto_comparacao: textoComparacao,
        aprendizado_resumo: aprendizadoResumo,
        status,
      };

      if (status === "PRONTO") {
        dadosAtualizacao.data_fechamento = new Date().toISOString();
      }

      const { error } = await supabase
        .from("relatorio_semanal")
        .update(dadosAtualizacao)
        .eq("id_relatorio", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorio", id] });
      toast({
        title: "Relatório salvo",
        description: "As alterações foram salvas com sucesso.",
      });
    },
  });

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const elemento = document.getElementById("relatorio-content");
      if (!elemento) return;

      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Relatorio_Semana_${relatorio?.semana.numero_semana}_${relatorio?.semana.ano}.pdf`);

      toast({
        title: "PDF exportado",
        description: "O relatório foi exportado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    } finally {
      setExportando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (!value) return "0%";
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportarPDF}
              disabled={exportando || !relatorio}
            >
              {exportando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => salvarMutation.mutate("EM_EDICAO")}
              disabled={salvarMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
            <Button
              onClick={() => salvarMutation.mutate("PRONTO")}
              disabled={salvarMutation.isPending || !textoComparacao || !aprendizadoResumo}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar como Pronto
            </Button>
          </div>
        </div>

        <div id="relatorio-content" className="bg-card p-8 rounded-lg shadow-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">
              Relatório Semanal - Semana {relatorio?.semana.numero_semana}/{relatorio?.semana.ano}
            </h1>
            <p className="text-muted-foreground">
              {relatorio?.empresa.nome} • {" "}
              {relatorio?.semana && format(new Date(relatorio.semana.data_inicio), "dd/MM", { locale: ptBR })} - {relatorio?.semana && format(new Date(relatorio.semana.data_fim), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <Badge variant={relatorio?.status === "PRONTO" ? "default" : "secondary"}>
              {relatorio?.status === "PRONTO" ? "Pronto" : "Em Edição"}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">1. Verba Investida</h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(metricas?.verba_investida)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">2. CPL Médio por Campanha</h2>
              <div className="space-y-2">
                {metricasCampanha?.map((campanha: any) => (
                  <Card key={campanha.id_campanha_semana}>
                    <CardContent className="pt-4 flex justify-between items-center">
                      <span className="font-medium">{campanha.campanha.nome}</span>
                      <span className="text-lg font-bold">{formatCurrency(campanha.cpl)}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. % MQL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricas?.mqls && metricas?.leads_total 
                      ? formatPercent((metricas.mqls / metricas.leads_total) * 100)
                      : "0%"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">4. % Levantada de Mão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricas?.levantadas && metricas?.leads_total
                      ? formatPercent((metricas.levantadas / metricas.leads_total) * 100)
                      : "0%"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">5. % SDR → Reunião</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricas?.reunioes && metricas?.mqls
                      ? formatPercent((metricas.reunioes / metricas.mqls) * 100)
                      : "0%"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">6. % Reunião → Venda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricas?.vendas && metricas?.reunioes
                      ? formatPercent((metricas.vendas / metricas.reunioes) * 100)
                      : "0%"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">7. CAC Médio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metricas?.cac)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">8. Ticket Médio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metricas?.ticket_medio)}</div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">9. Comparação com Semana Anterior</h2>
              <Textarea
                placeholder="Descreva as variações e tendências observadas em comparação com a semana anterior..."
                value={textoComparacao}
                onChange={(e) => setTextoComparacao(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">10. Ações Tomadas na Semana</h2>
              <div className="space-y-2">
                {acoes?.map((acao: any) => (
                  <Card key={acao.id_acao}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="mb-2">Categoria {acao.categoria}</Badge>
                          <p className="font-medium">{acao.tipo_acao}</p>
                          <p className="text-sm text-muted-foreground mt-1">{acao.descricao}</p>
                        </div>
                        <Badge variant="outline">{acao.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!acoes || acoes.length === 0) && (
                  <p className="text-sm text-muted-foreground">Nenhuma ação registrada nesta semana.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">11. Aprendizados e Hipóteses</h2>
              <Textarea
                placeholder="Registre os principais aprendizados da semana e hipóteses para testar na próxima semana..."
                value={aprendizadoResumo}
                onChange={(e) => setAprendizadoResumo(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
