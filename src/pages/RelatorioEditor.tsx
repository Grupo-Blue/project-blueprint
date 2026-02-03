import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, FileDown, CheckCircle, Loader2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { formatCurrency } from "@/lib/utils";

import { TopCriativosEditor, CriativoComMetricas, CriativoEditado } from "@/components/relatorios/TopCriativosEditor";
import { FunilConversao } from "@/components/relatorios/FunilConversao";
import { ComparativoSemanal } from "@/components/relatorios/ComparativoSemanal";
import { AlertasRelatorio, AlertaRelatorio } from "@/components/relatorios/AlertasRelatorio";
import { MetricasTopoFunil } from "@/components/relatorios/MetricasTopoFunil";
import { AnaliseFinanceira } from "@/components/relatorios/AnaliseFinanceira";

export default function RelatorioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [textoComparacao, setTextoComparacao] = useState("");
  const [aprendizadoResumo, setAprendizadoResumo] = useState("");
  const [exportando, setExportando] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [criativosEditados, setCriativosEditados] = useState<CriativoEditado[]>([]);

  // Query principal do relatório
  const { data: relatorio, isLoading } = useQuery({
    queryKey: ["relatorio", id],
    queryFn: async () => {
      if (id === "novo") return null;
      
      const { data, error } = await supabase
        .from("relatorio_semanal")
        .select(`
          *,
          empresa:id_empresa (nome, cpl_maximo),
          semana:id_semana (numero_semana, ano, data_inicio, data_fim)
        `)
        .eq("id_relatorio", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: id !== "novo",
  });

  // Métricas da semana atual
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

  // Métricas da semana anterior para comparativo
  const { data: metricasAnterior } = useQuery({
    queryKey: ["metricas-semana-anterior", relatorio?.id_empresa, relatorio?.semana],
    queryFn: async () => {
      if (!relatorio?.semana) return null;

      // Buscar semana anterior
      const { data: semanaAnterior } = await supabase
        .from("semana")
        .select("id_semana")
        .eq("ano", relatorio.semana.ano)
        .eq("numero_semana", relatorio.semana.numero_semana - 1)
        .single();

      if (!semanaAnterior) return null;

      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select("*")
        .eq("id_empresa", relatorio.id_empresa)
        .eq("id_semana", semanaAnterior.id_semana)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!relatorio?.semana,
  });

  // Métricas por campanha
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

  // Métricas de topo de funil (campanha_metricas_dia agregado)
  const { data: metricasTopoFunil } = useQuery({
    queryKey: ["metricas-topo-funil", relatorio?.id_empresa, relatorio?.semana],
    queryFn: async () => {
      if (!relatorio?.semana) return { impressoes: 0, cliques: 0, verba: 0 };

      const { data, error } = await supabase
        .from("campanha_metricas_dia")
        .select(`
          impressoes,
          cliques,
          verba_investida,
          campanha:id_campanha (
            conta:id_conta (id_empresa)
          )
        `)
        .gte("data", relatorio.semana.data_inicio)
        .lte("data", relatorio.semana.data_fim);

      if (error) throw error;

      // Filtrar por empresa e agregar
      const filtrado = data?.filter(
        (d: any) => d.campanha?.conta?.id_empresa === relatorio.id_empresa
      ) || [];

      return {
        impressoes: filtrado.reduce((acc: number, d: any) => acc + (d.impressoes || 0), 0),
        cliques: filtrado.reduce((acc: number, d: any) => acc + (d.cliques || 0), 0),
        verba: filtrado.reduce((acc: number, d: any) => acc + (d.verba_investida || 0), 0),
      };
    },
    enabled: !!relatorio?.semana,
  });

  // Top criativos com métricas
  const { data: topCriativos } = useQuery({
    queryKey: ["top-criativos", relatorio?.id_empresa, relatorio?.semana],
    queryFn: async () => {
      if (!relatorio?.semana) return [];

      // Buscar métricas de criativos agregadas
      const { data: criativosData, error } = await supabase
        .from("criativo_metricas_dia")
        .select(`
          id_criativo,
          leads,
          verba_investida,
          impressoes,
          cliques,
          criativo:id_criativo (
            descricao,
            url_preview,
            url_midia,
            tipo,
            campanha:id_campanha (
              nome,
              conta:id_conta (id_empresa)
            )
          )
        `)
        .gte("data", relatorio.semana.data_inicio)
        .lte("data", relatorio.semana.data_fim);

      if (error) throw error;

      // Filtrar por empresa e agregar por criativo
      const porCriativo: Record<string, CriativoComMetricas> = {};
      
      criativosData?.forEach((d: any) => {
        if (d.criativo?.campanha?.conta?.id_empresa !== relatorio.id_empresa) return;
        
        const id = d.id_criativo;
        if (!porCriativo[id]) {
          porCriativo[id] = {
            id_criativo: id,
            descricao: d.criativo.descricao,
            url_preview: d.criativo.url_preview,
            url_midia: d.criativo.url_midia,
            tipo: d.criativo.tipo,
            campanha_nome: d.criativo.campanha?.nome || "Sem campanha",
            leads: 0,
            verba: 0,
            cpl: null,
            impressoes: 0,
            cliques: 0,
          };
        }
        
        porCriativo[id].leads += d.leads || 0;
        porCriativo[id].verba += d.verba_investida || 0;
        porCriativo[id].impressoes += d.impressoes || 0;
        porCriativo[id].cliques += d.cliques || 0;
      });

      // Calcular CPL e ordenar
      const lista = Object.values(porCriativo).map((c) => ({
        ...c,
        cpl: c.leads > 0 ? c.verba / c.leads : null,
      }));

      return lista
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);
    },
    enabled: !!relatorio?.semana,
  });

  // Ações da semana
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

  // Gerar alertas automaticamente
  const alertas: AlertaRelatorio[] = [];
  
  // Criativos com verba mas sem leads
  topCriativos?.forEach((c) => {
    if (c.verba > 50 && c.leads === 0) {
      alertas.push({
        tipo: "sem_leads",
        severidade: "warning",
        titulo: "Criativo sem conversões",
        descricao: `Gastou ${formatCurrency(c.verba)} sem gerar leads`,
        entidade: c.descricao || `Criativo ${c.tipo}`,
        valor: c.verba,
      });
    }
  });

  // Campanhas com CPL alto
  const cplMaximo = (relatorio?.empresa as any)?.cpl_maximo || 100;
  metricasCampanha?.forEach((c: any) => {
    if (c.cpl && c.cpl > cplMaximo) {
      alertas.push({
        tipo: "cpl_alto",
        severidade: "error",
        titulo: "CPL acima do limite",
        descricao: `CPL de ${formatCurrency(c.cpl)} (limite: ${formatCurrency(cplMaximo)})`,
        entidade: c.campanha?.nome,
        valor: c.cpl,
      });
    }
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
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

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

  const formatPercent = (value: number | null) => {
    if (!value) return "0%";
    return `${value.toFixed(2)}%`;
  };

  // Dados para comparativo semanal
  const metricasComparativas = [
    {
      label: "Verba",
      valorAtual: metricas?.verba_investida || null,
      valorAnterior: metricasAnterior?.verba_investida || null,
      formato: "currency" as const,
    },
    {
      label: "Leads",
      valorAtual: metricas?.leads_total || null,
      valorAnterior: metricasAnterior?.leads_total || null,
      formato: "number" as const,
    },
    {
      label: "CPL",
      valorAtual: metricas?.cpl || null,
      valorAnterior: metricasAnterior?.cpl || null,
      formato: "currency" as const,
      inverterCor: true,
    },
    {
      label: "Vendas",
      valorAtual: metricas?.vendas || null,
      valorAnterior: metricasAnterior?.vendas || null,
      formato: "number" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header com ações */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
              <Label htmlFor="edit-mode" className="text-sm">
                <Edit2 className="h-4 w-4 inline mr-1" />
                Modo Edição
              </Label>
            </div>
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
                Pronto
              </Button>
            </div>
          </div>
        </div>

        {/* Conteúdo do relatório */}
        <div id="relatorio-content" className="bg-card p-6 md:p-8 rounded-lg shadow-sm space-y-8">
          {/* Cabeçalho */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold">
              Relatório Semanal - Semana {relatorio?.semana.numero_semana}/{relatorio?.semana.ano}
            </h1>
            <p className="text-muted-foreground">
              {relatorio?.empresa.nome} •{" "}
              {relatorio?.semana && format(new Date(relatorio.semana.data_inicio), "dd/MM", { locale: ptBR })} -{" "}
              {relatorio?.semana && format(new Date(relatorio.semana.data_fim), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <Badge variant={relatorio?.status === "PRONTO" ? "default" : "secondary"}>
              {relatorio?.status === "PRONTO" ? "Pronto" : "Em Edição"}
            </Badge>
          </div>

          <Separator />

          {/* 1. Resumo Executivo - Comparativo */}
          <div>
            <h2 className="text-xl font-semibold mb-4">1. Resumo Executivo</h2>
            <ComparativoSemanal metricas={metricasComparativas} />
          </div>

          {/* 2. Métricas de Topo de Funil */}
          <div>
            <h2 className="text-xl font-semibold mb-4">2. Métricas de Topo de Funil</h2>
            <MetricasTopoFunil
              impressoes={metricasTopoFunil?.impressoes || 0}
              cliques={metricasTopoFunil?.cliques || 0}
              verba={metricasTopoFunil?.verba || 0}
            />
          </div>

          {/* 3. Performance por Campanha */}
          <div>
            <h2 className="text-xl font-semibold mb-4">3. CPL por Campanha</h2>
            <div className="space-y-2">
              {metricasCampanha?.map((campanha: any) => (
                <Card key={campanha.id_campanha_semana}>
                  <CardContent className="pt-4 flex justify-between items-center">
                    <div>
                      <span className="font-medium">{campanha.campanha.nome}</span>
                      <p className="text-xs text-muted-foreground">
                        {campanha.leads} leads • Verba: {formatCurrency(campanha.verba_investida)}
                      </p>
                    </div>
                    <span className="text-lg font-bold">{formatCurrency(campanha.cpl)}</span>
                  </CardContent>
                </Card>
              ))}
              {(!metricasCampanha || metricasCampanha.length === 0) && (
                <p className="text-sm text-muted-foreground">Nenhuma campanha no período.</p>
              )}
            </div>
          </div>

          {/* 4. Top Criativos */}
          <div>
            <h2 className="text-xl font-semibold mb-4">4. Top Criativos</h2>
            <TopCriativosEditor
              criativos={topCriativos || []}
              criativosEditados={criativosEditados}
              onEditadosChange={setCriativosEditados}
              editMode={editMode}
            />
          </div>

          {/* 5. Funil de Conversão */}
          <div>
            <h2 className="text-xl font-semibold mb-4">5. Funil de Conversão</h2>
            <FunilConversao
              leads={metricas?.leads_total || 0}
              mqls={metricas?.mqls || 0}
              levantadas={metricas?.levantadas || 0}
              reunioes={metricas?.reunioes || 0}
              vendas={metricas?.vendas || 0}
            />
          </div>

          {/* 6. Análise Financeira */}
          <div>
            <h2 className="text-xl font-semibold mb-4">6. Análise Financeira</h2>
            <AnaliseFinanceira
              verba={metricas?.verba_investida || 0}
              vendas={metricas?.vendas || 0}
              ticketMedio={metricas?.ticket_medio}
              cac={metricas?.cac}
            />
          </div>

          {/* 7. Alertas */}
          <div>
            <h2 className="text-xl font-semibold mb-4">7. Alertas e Problemas</h2>
            <AlertasRelatorio alertas={alertas} />
          </div>

          {/* 8. Comparação Textual */}
          <div>
            <h2 className="text-xl font-semibold mb-4">8. Comparação com Semana Anterior</h2>
            <Textarea
              placeholder="Descreva as variações e tendências observadas em comparação com a semana anterior..."
              value={textoComparacao}
              onChange={(e) => setTextoComparacao(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* 9. Ações Tomadas */}
          <div>
            <h2 className="text-xl font-semibold mb-4">9. Ações Tomadas na Semana</h2>
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

          {/* 10. Aprendizados */}
          <div>
            <h2 className="text-xl font-semibold mb-4">10. Aprendizados e Hipóteses</h2>
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
  );
}
