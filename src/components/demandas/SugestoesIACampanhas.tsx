import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Target, DollarSign, Users, Image, TrendingUp, AlertCircle, FileText, Database, Copy, Check } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";

interface PalavraChaveEstruturada {
  termo: string;
  match_type: "exact" | "phrase" | "broad";
  intencao: "transacional" | "informacional" | "navegacional";
}

interface GrupoAnuncio {
  nome: string;
  palavras_chave: string[];
  headlines: string[];
  descriptions: string[];
}

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
  google_palavras_chave_estruturadas?: PalavraChaveEstruturada[];
  google_palavras_negativas?: string[];
  google_grupos_anuncio?: GrupoAnuncio[];
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
  texto_produto_analisado?: string;
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
  const [textoMode, setTextoMode] = useState<"base" | "texto">("base");
  const [textoProduto, setTextoProduto] = useState("");
  const [plataformaAlvo, setPlataformaAlvo] = useState<"META" | "GOOGLE">("META");
  const [copiedKeywords, setCopiedKeywords] = useState<string | null>(null);
  const { empresaSelecionada, nomeEmpresaSelecionada } = useEmpresa();
  const { toast } = useToast();

  const gerarSugestoesMutation = useMutation({
    mutationFn: async ({ useTexto }: { useTexto: boolean }) => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa específica para gerar sugestões");
      }

      if (useTexto && textoProduto.trim().length < 50) {
        throw new Error("O texto do produto deve ter pelo menos 50 caracteres");
      }

      const body: any = { id_empresa: empresaSelecionada };
      
      if (useTexto) {
        body.texto_produto = textoProduto.trim();
        body.plataforma_alvo = plataformaAlvo;
      }

      const { data, error } = await supabase.functions.invoke("gerar-sugestoes-demandas", {
        body
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

  const handleGerarSugestoes = (useTexto: boolean) => {
    setSugestoes([]);
    gerarSugestoesMutation.mutate({ useTexto });
  };

  const handleSelecionarSugestao = (sugestao: SugestaoIA) => {
    onSugestaoSelecionada({
      ...sugestao,
      id_empresa: empresaSelecionada,
      sugerida_por_ia: true,
      contexto_ia: {
        justificativa: sugestao.justificativa,
        resultados_esperados: sugestao.resultados_esperados,
        texto_produto_analisado: sugestao.texto_produto_analisado,
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

  const getMatchTypeBadge = (matchType: string) => {
    switch (matchType) {
      case "exact": return <Badge variant="default" className="text-xs">[exato]</Badge>;
      case "phrase": return <Badge variant="secondary" className="text-xs">"frase"</Badge>;
      case "broad": return <Badge variant="outline" className="text-xs">ampla</Badge>;
      default: return null;
    }
  };

  const copyKeywordsToClipboard = (sugestaoIdx: number, keywords: PalavraChaveEstruturada[] | undefined) => {
    if (!keywords) return;
    
    const formatted = keywords.map(k => {
      if (k.match_type === "exact") return `[${k.termo}]`;
      if (k.match_type === "phrase") return `"${k.termo}"`;
      return k.termo;
    }).join("\n");
    
    navigator.clipboard.writeText(formatted);
    setCopiedKeywords(`${sugestaoIdx}`);
    setTimeout(() => setCopiedKeywords(null), 2000);
  };

  const renderSugestaoCard = (sugestao: SugestaoIA, idx: number) => (
    <Card key={idx} className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{sugestao.plataforma}</Badge>
              <Badge variant={getPrioridadeColor(sugestao.prioridade) as any}>
                {sugestao.prioridade}
              </Badge>
              {sugestao.texto_produto_analisado && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  Baseado no Texto
                </Badge>
              )}
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

        {/* Análise do texto (se houver) */}
        {sugestao.texto_produto_analisado && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-1">Resumo do texto analisado:</p>
            <p className="text-sm">{sugestao.texto_produto_analisado}</p>
          </div>
        )}

        {/* Palavras-chave estruturadas para Google Ads Search */}
        {sugestao.plataforma === "GOOGLE" && sugestao.google_palavras_chave_estruturadas && sugestao.google_palavras_chave_estruturadas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Palavras-chave ({sugestao.google_palavras_chave_estruturadas.length})</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1"
                onClick={() => copyKeywordsToClipboard(idx, sugestao.google_palavras_chave_estruturadas)}
              >
                {copiedKeywords === `${idx}` ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sugestao.google_palavras_chave_estruturadas.slice(0, 10).map((kw, i) => (
                <div key={i} className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded">
                  {getMatchTypeBadge(kw.match_type)}
                  <span>{kw.termo}</span>
                </div>
              ))}
              {sugestao.google_palavras_chave_estruturadas.length > 10 && (
                <Badge variant="outline">+{sugestao.google_palavras_chave_estruturadas.length - 10} mais</Badge>
              )}
            </div>
          </div>
        )}

        {/* Palavras negativas */}
        {sugestao.plataforma === "GOOGLE" && sugestao.google_palavras_negativas && sugestao.google_palavras_negativas.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Palavras Negativas ({sugestao.google_palavras_negativas.length})</p>
            <div className="flex flex-wrap gap-1">
              {sugestao.google_palavras_negativas.slice(0, 8).map((neg, i) => (
                <Badge key={i} variant="destructive" className="text-xs">-{neg}</Badge>
              ))}
              {sugestao.google_palavras_negativas.length > 8 && (
                <Badge variant="outline" className="text-xs">+{sugestao.google_palavras_negativas.length - 8}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Grupos de anúncio */}
        {sugestao.plataforma === "GOOGLE" && sugestao.google_grupos_anuncio && sugestao.google_grupos_anuncio.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="grupos" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm py-2 hover:no-underline">
                Grupos de Anúncio ({sugestao.google_grupos_anuncio.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {sugestao.google_grupos_anuncio.map((grupo, gi) => (
                    <div key={gi} className="bg-muted/30 p-3 rounded-lg space-y-2">
                      <p className="font-medium text-sm">{grupo.nome}</p>
                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Keywords:</span> {grupo.palavras_chave.slice(0, 5).join(", ")}
                          {grupo.palavras_chave.length > 5 && ` (+${grupo.palavras_chave.length - 5})`}
                        </p>
                        {grupo.headlines && grupo.headlines.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">Headlines:</span> {grupo.headlines.slice(0, 3).join(" | ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

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
  );

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
              ? `Campanhas sugeridas para ${nomeEmpresaSelecionada}`
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
              <Tabs value={textoMode} onValueChange={(v) => setTextoMode(v as "base" | "texto")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="base" className="gap-2">
                    <Database className="h-4 w-4" />
                    Baseado na Base
                  </TabsTrigger>
                  <TabsTrigger value="texto" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Baseado em Texto
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="base" className="mt-4">
                  <div className="flex flex-col items-center justify-center py-8">
                    <Sparkles className="h-16 w-16 text-purple-500/30 mb-4" />
                    <p className="text-muted-foreground mb-4 text-center">
                      A IA vai analisar os últimos 30 dias de dados da sua base<br />
                      e sugerir campanhas otimizadas
                    </p>
                    <Button onClick={() => handleGerarSugestoes(false)} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Gerar Sugestões da Base
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="texto" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <Label>Cole aqui a descrição do produto, copy da LP ou briefing:</Label>
                    <Textarea
                      placeholder="Exemplo: Nosso curso de Day Trade ensina iniciantes a operar no mercado financeiro em apenas 8 semanas. Com aulas práticas e simulador gratuito, você aprende a identificar oportunidades e gerenciar riscos. Ideal para quem quer renda extra ou mudar de carreira. Público: 25-45 anos, classe B/C, interesse em finanças..."
                      className="min-h-[150px]"
                      value={textoProduto}
                      onChange={(e) => setTextoProduto(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {textoProduto.length}/50 caracteres mínimos
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Plataforma alvo:</Label>
                    <RadioGroup
                      value={plataformaAlvo}
                      onValueChange={(v) => setPlataformaAlvo(v as "META" | "GOOGLE")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="META" id="meta" />
                        <Label htmlFor="meta" className="cursor-pointer">Meta Ads</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="GOOGLE" id="google" />
                        <Label htmlFor="google" className="cursor-pointer">Google Ads</Label>
                      </div>
                    </RadioGroup>
                    {plataformaAlvo === "GOOGLE" && (
                      <p className="text-xs text-muted-foreground">
                        Para Google Ads, a IA gerará palavras-chave de Search com match types e grupos de anúncios
                      </p>
                    )}
                  </div>

                  <Button 
                    onClick={() => handleGerarSugestoes(true)} 
                    className="w-full gap-2"
                    disabled={textoProduto.trim().length < 50}
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar Campanha com Texto
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {gerarSugestoesMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                <p className="text-muted-foreground">
                  {textoMode === "texto" 
                    ? "Analisando texto e gerando campanhas..."
                    : "Analisando dados e gerando sugestões..."
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-2">Isso pode levar alguns segundos</p>
              </div>
            )}

            {sugestoes.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {sugestoes.length} sugestões geradas
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSugestoes([])}>
                    Nova Geração
                  </Button>
                </div>

                {sugestoes.map((sugestao, idx) => renderSugestaoCard(sugestao, idx))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
