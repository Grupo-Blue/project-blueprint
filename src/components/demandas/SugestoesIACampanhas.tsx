import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Sparkles, Target, DollarSign, Users, Image, TrendingUp, AlertCircle } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";

interface SugestaoIA {
  titulo: string;
  descricao: string;
  plataforma: "META" | "GOOGLE";
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  meta_tipo_campanha?: string;
  meta_objetivo?: string;
  meta_publico_alvo?: string;
  meta_idade_min?: number;
  meta_idade_max?: number;
  meta_interesses?: string[];
  meta_posicionamentos?: string[];
  google_tipo_campanha?: string;
  google_palavras_chave?: string[];
  verba_diaria: number;
  verba_total: number;
  duracao_dias: number;
  criativos: {
    url_midia: string;
    tipo: string;
    descricao: string;
    cta: string;
  }[];
  landing_pages?: string[];
  teste_ab_paginas?: boolean;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  justificativa: string;
  resultados_esperados: {
    leads_estimados: number;
    cpl_estimado: number;
    roi_estimado: number;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSugestaoSelecionada: (sugestao: Partial<any>) => void;
}

export default function SugestoesIACampanhas({ open, onOpenChange, onSugestaoSelecionada }: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoIA[]>([]);
  const { empresaSelecionada, nomeEmpresaSelecionada } = useEmpresa();
  const { toast } = useToast();

  const gerarSugestoesMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa específica para gerar sugestões");
      }

      const { data, error } = await supabase.functions.invoke("gerar-sugestoes-demandas", {
        body: { id_empresa: empresaSelecionada }
      });

      if (error) {
        console.error("Erro na edge function:", error);
        throw new Error(error.message || "Erro ao gerar sugestões");
      }

      return data.sugestoes as SugestaoIA[];
    },
    onSuccess: (data) => {
      setSugestoes(data);
      toast({
        title: "Sugestões geradas",
        description: `${data.length} sugestões de campanhas foram geradas pela IA`,
      });
    },
    onError: (error: any) => {
      console.error("Erro ao gerar sugestões:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível gerar sugestões",
        variant: "destructive",
      });
    }
  });

  const handleGerarSugestoes = () => {
    setSugestoes([]);
    gerarSugestoesMutation.mutate();
  };

  const handleSelecionarSugestao = (sugestao: SugestaoIA) => {
    onSugestaoSelecionada({
      ...sugestao,
      id_empresa: empresaSelecionada,
      sugerida_por_ia: true,
      contexto_ia: {
        justificativa: sugestao.justificativa,
        resultados_esperados: sugestao.resultados_esperados,
      }
    });
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA": return "destructive";
      case "MEDIA": return "secondary";
      case "BAIXA": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Sugestões de Campanhas por IA
          </DialogTitle>
          <DialogDescription>
            {empresaSelecionada && empresaSelecionada !== "todas" 
              ? `Campanhas sugeridas para ${nomeEmpresaSelecionada} baseadas nos últimos 30 dias de dados`
              : "Selecione uma empresa específica no filtro global para gerar sugestões"
            }
          </DialogDescription>
        </DialogHeader>

        {!empresaSelecionada || empresaSelecionada === "todas" ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Selecione uma empresa específica no filtro global para gerar sugestões personalizadas
            </p>
          </div>
        ) : (
          <>
            {sugestoes.length === 0 && !gerarSugestoesMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-16 w-16 text-purple-500/30 mb-4" />
                <p className="text-muted-foreground mb-4">
                  Clique no botão abaixo para a IA analisar os dados e sugerir campanhas otimizadas
                </p>
                <Button onClick={handleGerarSugestoes} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Gerar Sugestões com IA
                </Button>
              </div>
            )}

            {gerarSugestoesMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                <p className="text-muted-foreground">Analisando dados e gerando sugestões...</p>
                <p className="text-xs text-muted-foreground mt-2">Isso pode levar alguns segundos</p>
              </div>
            )}

            {sugestoes.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {sugestoes.length} sugestões geradas
                  </p>
                  <Button variant="outline" size="sm" onClick={handleGerarSugestoes}>
                    Regenerar
                  </Button>
                </div>

                {sugestoes.map((sugestao, idx) => (
                  <Card key={idx} className="border-l-4 border-l-purple-500">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{sugestao.plataforma}</Badge>
                            <Badge variant={getPrioridadeColor(sugestao.prioridade) as any}>
                              {sugestao.prioridade}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{sugestao.titulo}</CardTitle>
                        </div>
                        <div className="text-right text-sm shrink-0">
                          <div className="flex items-center gap-1 text-green-600">
                            <Users className="h-4 w-4" />
                            <span className="font-semibold">{sugestao.resultados_esperados.leads_estimados}</span>
                            <span className="text-muted-foreground">leads</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Target className="h-4 w-4" />
                            <span>CPL: R$ {sugestao.resultados_esperados.cpl_estimado.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-blue-600">
                            <TrendingUp className="h-4 w-4" />
                            <span>ROI: {sugestao.resultados_esperados.roi_estimado}%</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{sugestao.descricao}</p>

                      {/* Preview dos criativos */}
                      {sugestao.criativos && sugestao.criativos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {sugestao.criativos.slice(0, 4).map((c, i) => (
                            <div key={i} className="relative group">
                              {c.url_midia ? (
                                <img 
                                  src={c.url_midia} 
                                  className="w-16 h-16 object-cover rounded border"
                                  alt={`Criativo ${i + 1}`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://placehold.co/64x64?text=Img";
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center">
                                  <Image className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              <Badge className="absolute -top-1 -right-1 text-xs px-1">{c.tipo}</Badge>
                            </div>
                          ))}
                          {sugestao.criativos.length > 4 && (
                            <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                              +{sugestao.criativos.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resumo do orçamento */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          R$ {sugestao.verba_diaria}/dia
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span>{sugestao.duracao_dias} dias</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-medium">Total: R$ {sugestao.verba_total}</span>
                      </div>

                      {/* Detalhes específicos por plataforma */}
                      {sugestao.plataforma === "META" && sugestao.meta_publico_alvo && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Público: </span>
                          {sugestao.meta_publico_alvo}
                        </div>
                      )}

                      {/* Justificativa */}
                      <Accordion type="single" collapsible>
                        <AccordionItem value="justificativa" className="border-0">
                          <AccordionTrigger className="text-sm py-2">
                            Por que esta sugestão?
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">
                            {sugestao.justificativa}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>

                    <CardFooter>
                      <Button 
                        onClick={() => handleSelecionarSugestao(sugestao)}
                        className="w-full gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Criar esta Campanha
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
