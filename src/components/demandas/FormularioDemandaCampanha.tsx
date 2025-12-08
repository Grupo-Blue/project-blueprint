import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, X, Image, Link2, Loader2, Layers } from "lucide-react";

interface GrupoAnuncio {
  nome: string;
  palavras_chave: string[];
  headlines: string[];
  descriptions: string[];
}

interface Criativo {
  url_midia: string;
  tipo: string;
  descricao: string;
  cta: string;
}

interface FormData {
  titulo: string;
  descricao: string;
  plataforma: "META" | "GOOGLE";
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  id_empresa: string;
  // Meta
  meta_tipo_campanha: string;
  meta_objetivo: string;
  meta_publico_alvo: string;
  meta_idade_min: number;
  meta_idade_max: number;
  meta_genero: string;
  meta_interesses: string;
  meta_localizacoes: string;
  meta_posicionamentos: string[];
  // Google
  google_tipo_campanha: string;
  google_palavras_chave: string;
  google_palavras_negativas: string;
  google_tipo_correspondencia: string;
  // Orçamento
  verba_diaria: number;
  verba_total: number;
  data_inicio: string;
  data_fim: string;
  // LPs
  landing_pages: string;
  teste_ab_paginas: boolean;
  // UTMs
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

interface FormularioProps {
  dadosIniciais?: Partial<any>;
  onSubmit: () => void;
  onCancel: () => void;
}

const POSICIONAMENTOS_META = ["Feed", "Stories", "Reels", "Explore", "Messenger", "Audience Network"];
const TIPOS_CAMPANHA_META = ["CONVERSAO", "TRAFEGO", "LEAD_GEN", "AWARENESS", "ENGAJAMENTO"];
const TIPOS_CAMPANHA_GOOGLE = ["SEARCH", "DISPLAY", "PERFORMANCE_MAX", "VIDEO", "SHOPPING"];

export default function FormularioDemandaCampanha({ dadosIniciais, onSubmit, onCancel }: FormularioProps) {
  const [criativos, setCriativos] = useState<Criativo[]>(dadosIniciais?.criativos || []);
  const [posicionamentosSelecionados, setPosicionamentosSelecionados] = useState<string[]>(
    dadosIniciais?.meta_posicionamentos || []
  );
  const [gruposAnuncio, setGruposAnuncio] = useState<GrupoAnuncio[]>(
    dadosIniciais?.contexto_ia?.google_grupos_anuncio || []
  );
  const [submitting, setSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { empresaSelecionada, empresasPermitidas } = useEmpresa();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      titulo: dadosIniciais?.titulo || "",
      descricao: dadosIniciais?.descricao || "",
      plataforma: dadosIniciais?.plataforma || "META",
      prioridade: dadosIniciais?.prioridade || "MEDIA",
      id_empresa: dadosIniciais?.id_empresa || empresaSelecionada || "",
      meta_tipo_campanha: dadosIniciais?.meta_tipo_campanha || "",
      meta_objetivo: dadosIniciais?.meta_objetivo || "",
      meta_publico_alvo: dadosIniciais?.meta_publico_alvo || "",
      meta_idade_min: dadosIniciais?.meta_idade_min || 18,
      meta_idade_max: dadosIniciais?.meta_idade_max || 65,
      meta_genero: dadosIniciais?.meta_genero || "todos",
      meta_interesses: dadosIniciais?.meta_interesses?.join(", ") || "",
      meta_localizacoes: dadosIniciais?.meta_localizacoes?.join(", ") || "",
      google_tipo_campanha: dadosIniciais?.google_tipo_campanha || "",
      google_palavras_chave: dadosIniciais?.google_palavras_chave?.join(", ") || "",
      google_palavras_negativas: dadosIniciais?.google_palavras_negativas?.join(", ") || "",
      google_tipo_correspondencia: dadosIniciais?.google_tipo_correspondencia || "ampla",
      verba_diaria: dadosIniciais?.verba_diaria || 0,
      verba_total: dadosIniciais?.verba_total || 0,
      data_inicio: dadosIniciais?.data_inicio || "",
      data_fim: dadosIniciais?.data_fim || "",
      landing_pages: dadosIniciais?.landing_pages?.join("\n") || "",
      teste_ab_paginas: dadosIniciais?.teste_ab_paginas || false,
      utm_source: dadosIniciais?.utm_source || "",
      utm_medium: dadosIniciais?.utm_medium || "",
      utm_campaign: dadosIniciais?.utm_campaign || "",
      utm_content: dadosIniciais?.utm_content || "",
    },
  });

  const plataforma = watch("plataforma");

  // Auto-preencher UTMs baseado na plataforma
  useEffect(() => {
    if (!dadosIniciais?.utm_source) {
      setValue("utm_source", plataforma === "META" ? "facebook" : "google");
      setValue("utm_medium", plataforma === "META" ? "cpc" : "cpc");
    }
  }, [plataforma, setValue, dadosIniciais]);

  const addCriativo = () => {
    setCriativos([...criativos, { url_midia: "", tipo: "imagem", descricao: "", cta: "" }]);
  };

  const removeCriativo = (index: number) => {
    setCriativos(criativos.filter((_, i) => i !== index));
  };

  const updateCriativo = (index: number, field: keyof Criativo, value: string) => {
    const updated = [...criativos];
    updated[index] = { ...updated[index], [field]: value };
    setCriativos(updated);
  };

  const togglePosicionamento = (pos: string) => {
    if (posicionamentosSelecionados.includes(pos)) {
      setPosicionamentosSelecionados(posicionamentosSelecionados.filter(p => p !== pos));
    } else {
      setPosicionamentosSelecionados([...posicionamentosSelecionados, pos]);
    }
  };

  const onFormSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        id_criador: user.id,
        id_empresa: data.id_empresa,
        titulo: data.titulo,
        descricao: data.descricao || null,
        plataforma: data.plataforma,
        prioridade: data.prioridade,
        // Meta
        meta_tipo_campanha: data.plataforma === "META" ? data.meta_tipo_campanha : null,
        meta_objetivo: data.plataforma === "META" ? data.meta_objetivo : null,
        meta_publico_alvo: data.plataforma === "META" ? data.meta_publico_alvo : null,
        meta_idade_min: data.plataforma === "META" ? data.meta_idade_min : null,
        meta_idade_max: data.plataforma === "META" ? data.meta_idade_max : null,
        meta_genero: data.plataforma === "META" ? data.meta_genero : null,
        meta_interesses: data.plataforma === "META" && data.meta_interesses 
          ? data.meta_interesses.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        meta_localizacoes: data.plataforma === "META" && data.meta_localizacoes 
          ? data.meta_localizacoes.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        meta_posicionamentos: data.plataforma === "META" ? posicionamentosSelecionados : null,
        // Google
        google_tipo_campanha: data.plataforma === "GOOGLE" ? data.google_tipo_campanha : null,
        google_palavras_chave: data.plataforma === "GOOGLE" && data.google_palavras_chave 
          ? data.google_palavras_chave.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        google_palavras_negativas: data.plataforma === "GOOGLE" && data.google_palavras_negativas 
          ? data.google_palavras_negativas.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        google_tipo_correspondencia: data.plataforma === "GOOGLE" ? data.google_tipo_correspondencia : null,
        // Orçamento
        verba_diaria: data.verba_diaria || null,
        verba_total: data.verba_total || null,
        data_inicio: data.data_inicio || null,
        data_fim: data.data_fim || null,
        // Criativos e LPs
        criativos: criativos.filter(c => c.url_midia),
        landing_pages: data.landing_pages 
          ? data.landing_pages.split("\n").map(s => s.trim()).filter(Boolean)
          : null,
        teste_ab_paginas: data.teste_ab_paginas,
        // UTMs
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
        // IA
        sugerida_por_ia: dadosIniciais?.sugerida_por_ia || false,
        contexto_ia: dadosIniciais?.contexto_ia || null,
      };

      const { error } = await supabase.from("demanda_campanha").insert([payload] as any);
      if (error) throw error;

      toast({
        title: "Demanda criada",
        description: "A demanda de campanha foi criada com sucesso",
      });
      onSubmit();
    } catch (error: any) {
      console.error("Erro ao criar demanda:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar demanda",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Dados Básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="titulo">Título da Campanha *</Label>
          <Input 
            id="titulo" 
            {...register("titulo", { required: true })}
            placeholder="Ex: Campanha Black Friday"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="id_empresa">Empresa *</Label>
          <Select 
            value={watch("id_empresa")} 
            onValueChange={(v) => setValue("id_empresa", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresasPermitidas.map((emp) => (
                <SelectItem key={emp.id_empresa} value={emp.id_empresa}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea 
          id="descricao" 
          {...register("descricao")}
          placeholder="Descreva o objetivo e contexto da campanha..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Plataforma *</Label>
          <Select 
            value={watch("plataforma")} 
            onValueChange={(v) => setValue("plataforma", v as "META" | "GOOGLE")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="META">Meta Ads (Facebook/Instagram)</SelectItem>
              <SelectItem value="GOOGLE">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioridade *</Label>
          <Select 
            value={watch("prioridade")} 
            onValueChange={(v) => setValue("prioridade", v as "ALTA" | "MEDIA" | "BAIXA")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="BAIXA">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Campos específicos por plataforma */}
      {plataforma === "META" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações Meta Ads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Campanha</Label>
                <Select 
                  value={watch("meta_tipo_campanha")} 
                  onValueChange={(v) => setValue("meta_tipo_campanha", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CAMPANHA_META.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_objetivo">Objetivo</Label>
                <Input 
                  id="meta_objetivo" 
                  {...register("meta_objetivo")}
                  placeholder="Ex: Gerar leads qualificados"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_publico_alvo">Descrição do Público-Alvo</Label>
              <Textarea 
                id="meta_publico_alvo" 
                {...register("meta_publico_alvo")}
                placeholder="Descreva o perfil do público..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Idade Mínima</Label>
                <Input 
                  type="number" 
                  {...register("meta_idade_min", { valueAsNumber: true })}
                  min={18}
                  max={65}
                />
              </div>
              <div className="space-y-2">
                <Label>Idade Máxima</Label>
                <Input 
                  type="number" 
                  {...register("meta_idade_max", { valueAsNumber: true })}
                  min={18}
                  max={65}
                />
              </div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select 
                  value={watch("meta_genero")} 
                  onValueChange={(v) => setValue("meta_genero", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_interesses">Interesses (separados por vírgula)</Label>
              <Input 
                id="meta_interesses" 
                {...register("meta_interesses")}
                placeholder="Ex: investimentos, finanças, empreendedorismo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_localizacoes">Localizações (separadas por vírgula)</Label>
              <Input 
                id="meta_localizacoes" 
                {...register("meta_localizacoes")}
                placeholder="Ex: Brasil, São Paulo, Rio de Janeiro"
              />
            </div>

            <div className="space-y-2">
              <Label>Posicionamentos</Label>
              <div className="flex flex-wrap gap-2">
                {POSICIONAMENTOS_META.map((pos) => (
                  <Badge
                    key={pos}
                    variant={posicionamentosSelecionados.includes(pos) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePosicionamento(pos)}
                  >
                    {pos}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações Google Ads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Campanha</Label>
                <Select 
                  value={watch("google_tipo_campanha")} 
                  onValueChange={(v) => setValue("google_tipo_campanha", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CAMPANHA_GOOGLE.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Correspondência</Label>
                <Select 
                  value={watch("google_tipo_correspondencia")} 
                  onValueChange={(v) => setValue("google_tipo_correspondencia", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ampla">Ampla</SelectItem>
                    <SelectItem value="frase">Frase</SelectItem>
                    <SelectItem value="exata">Exata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="google_palavras_chave">Palavras-chave (separadas por vírgula)</Label>
              <Textarea 
                id="google_palavras_chave" 
                {...register("google_palavras_chave")}
                placeholder="Ex: investimento, tokenização, criptomoedas"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google_palavras_negativas">Palavras-chave Negativas</Label>
              <Input 
                id="google_palavras_negativas" 
                {...register("google_palavras_negativas")}
                placeholder="Ex: grátis, free, download"
              />
            </div>

            {/* Grupos de Anúncio da IA */}
            {gruposAnuncio.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  <Label className="text-base font-semibold">Grupos de Anúncio Sugeridos pela IA</Label>
                  <Badge variant="secondary" className="text-xs">{gruposAnuncio.length} grupos</Badge>
                </div>
                <Accordion type="multiple" className="space-y-2">
                  {gruposAnuncio.map((grupo, idx) => (
                    <AccordionItem key={idx} value={`grupo-${idx}`} className="border rounded-lg px-3">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{idx + 1}</Badge>
                          <span className="font-medium">{grupo.nome}</span>
                          <Badge variant="secondary" className="text-xs ml-2">
                            {grupo.palavras_chave?.length || 0} palavras
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-4">
                        {/* Palavras-chave do grupo */}
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Palavras-chave</Label>
                          <div className="flex flex-wrap gap-1">
                            {grupo.palavras_chave?.map((kw, kwIdx) => (
                              <Badge key={kwIdx} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {/* Headlines */}
                        {grupo.headlines && grupo.headlines.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Headlines (RSA)</Label>
                            <div className="space-y-1">
                              {grupo.headlines.map((h, hIdx) => (
                                <div key={hIdx} className="text-sm bg-muted/50 px-2 py-1 rounded flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-4">{hIdx + 1}.</span>
                                  <span>{h}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">{h.length}/30</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Descriptions */}
                        {grupo.descriptions && grupo.descriptions.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Descriptions (RSA)</Label>
                            <div className="space-y-1">
                              {grupo.descriptions.map((d, dIdx) => (
                                <div key={dIdx} className="text-sm bg-muted/50 px-2 py-1 rounded flex items-start gap-2">
                                  <span className="text-xs text-muted-foreground w-4 shrink-0">{dIdx + 1}.</span>
                                  <span className="flex-1">{d}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">{d.length}/90</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Orçamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Orçamento e Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="verba_diaria">Verba Diária (R$)</Label>
              <Input 
                id="verba_diaria" 
                type="number"
                step="0.01"
                {...register("verba_diaria", { valueAsNumber: true })}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verba_total">Verba Total (R$)</Label>
              <Input 
                id="verba_total" 
                type="number"
                step="0.01"
                {...register("verba_total", { valueAsNumber: true })}
                placeholder="3000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data Início</Label>
              <Input 
                id="data_inicio" 
                type="date"
                {...register("data_inicio")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input 
                id="data_fim" 
                type="date"
                {...register("data_fim")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criativos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Criativos</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addCriativo}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {criativos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum criativo adicionado. Clique em "Adicionar" para incluir.
            </p>
          ) : (
            criativos.map((criativo, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Criativo {index + 1}</Badge>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeCriativo(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>URL da Mídia</Label>
                    <Input 
                      value={criativo.url_midia}
                      onChange={(e) => updateCriativo(index, "url_midia", e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select 
                      value={criativo.tipo}
                      onValueChange={(v) => updateCriativo(index, "tipo", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imagem">Imagem</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="carrossel">Carrossel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição/Copy</Label>
                    <Input 
                      value={criativo.descricao}
                      onChange={(e) => updateCriativo(index, "descricao", e.target.value)}
                      placeholder="Texto do anúncio..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA</Label>
                    <Input 
                      value={criativo.cta}
                      onChange={(e) => updateCriativo(index, "cta", e.target.value)}
                      placeholder="Ex: Saiba Mais, Comprar Agora"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Landing Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Landing Pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="landing_pages">URLs das Landing Pages (uma por linha)</Label>
            <Textarea 
              id="landing_pages" 
              {...register("landing_pages")}
              placeholder="https://exemplo.com/lp1&#10;https://exemplo.com/lp2"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              id="teste_ab"
              checked={watch("teste_ab_paginas")}
              onCheckedChange={(v) => setValue("teste_ab_paginas", v)}
            />
            <Label htmlFor="teste_ab">Realizar teste A/B entre as páginas</Label>
          </div>
        </CardContent>
      </Card>

      {/* UTMs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parâmetros UTM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="utm_source">utm_source</Label>
              <Input 
                id="utm_source" 
                {...register("utm_source")}
                placeholder="facebook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utm_medium">utm_medium</Label>
              <Input 
                id="utm_medium" 
                {...register("utm_medium")}
                placeholder="cpc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utm_campaign">utm_campaign</Label>
              <Input 
                id="utm_campaign" 
                {...register("utm_campaign")}
                placeholder="black_friday_2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="utm_content">utm_content</Label>
              <Input 
                id="utm_content" 
                {...register("utm_content")}
                placeholder="{{ad.id}} ou ID do anúncio"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Demanda
        </Button>
      </div>
    </form>
  );
}
