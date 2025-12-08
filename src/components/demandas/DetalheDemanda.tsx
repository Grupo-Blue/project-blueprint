import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Building2,
  DollarSign,
  Calendar,
  Target,
  Image,
  Link2,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface DemandaCampanha {
  id_demanda: string;
  id_empresa: string;
  id_criador: string;
  id_executor: string | null;
  titulo: string;
  descricao: string | null;
  plataforma: "META" | "GOOGLE";
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  meta_tipo_campanha: string | null;
  meta_objetivo: string | null;
  meta_publico_alvo: string | null;
  meta_idade_min: number | null;
  meta_idade_max: number | null;
  meta_genero: string | null;
  meta_interesses: string[] | null;
  meta_localizacoes: string[] | null;
  meta_posicionamentos: string[] | null;
  google_tipo_campanha: string | null;
  google_palavras_chave: string[] | null;
  google_palavras_negativas: string[] | null;
  google_tipo_correspondencia: string | null;
  google_extensoes: string[] | null;
  verba_diaria: number | null;
  verba_total: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  criativos: any[];
  landing_pages: string[] | null;
  teste_ab_paginas: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  status: "PENDENTE" | "EM_EXECUCAO" | "EXECUTADA" | "VERIFICADA" | "REJEITADA";
  id_campanha_criada: string | null;
  observacoes_executor: string | null;
  verificada: boolean;
  data_verificacao: string | null;
  resultado_verificacao: string | null;
  sugerida_por_ia: boolean;
  contexto_ia: any;
  created_at: string;
  updated_at: string;
  empresa?: { nome: string };
}

interface Props {
  demanda: DemandaCampanha | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function DetalheDemanda({ demanda, open, onOpenChange, onUpdate }: Props) {
  const [idCampanhaCriada, setIdCampanhaCriada] = useState(demanda?.id_campanha_criada || "");
  const [observacoes, setObservacoes] = useState(demanda?.observacoes_executor || "");
  const { toast } = useToast();

  const assumirMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("demanda_campanha")
        .update({ 
          id_executor: user.id, 
          status: "EM_EXECUCAO" as const
        })
        .eq("id_demanda", demanda?.id_demanda);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Demanda assumida", description: "Você assumiu esta demanda" });
      onUpdate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const executarMutation = useMutation({
    mutationFn: async () => {
      if (!idCampanhaCriada.trim()) {
        throw new Error("Informe o ID da campanha criada");
      }

      const { error } = await supabase
        .from("demanda_campanha")
        .update({ 
          status: "EXECUTADA" as const,
          id_campanha_criada: idCampanhaCriada,
          observacoes_executor: observacoes || null
        })
        .eq("id_demanda", demanda?.id_demanda);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Demanda executada", description: "A campanha foi marcada como criada" });
      onUpdate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const rejeitarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("demanda_campanha")
        .update({ 
          status: "REJEITADA" as const,
          observacoes_executor: observacoes || null
        })
        .eq("id_demanda", demanda?.id_demanda);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Demanda rejeitada" });
      onUpdate();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  if (!demanda) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDENTE": return "bg-yellow-500/10 text-yellow-600";
      case "EM_EXECUCAO": return "bg-blue-500/10 text-blue-600";
      case "EXECUTADA": return "bg-green-500/10 text-green-600";
      case "VERIFICADA": return "bg-purple-500/10 text-purple-600";
      case "REJEITADA": return "bg-red-500/10 text-red-600";
      default: return "bg-muted";
    }
  };

  const canAssumir = demanda.status === "PENDENTE";
  const canExecutar = demanda.status === "EM_EXECUCAO";
  const canRejeitar = demanda.status === "PENDENTE" || demanda.status === "EM_EXECUCAO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{demanda.titulo}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{demanda.plataforma}</Badge>
                <Badge className={getStatusColor(demanda.status)}>{demanda.status.replace("_", " ")}</Badge>
                {demanda.sugerida_por_ia && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Sugerida por IA
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Básica */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {demanda.empresa?.nome}
            </div>
            {demanda.verba_diaria && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                R$ {demanda.verba_diaria}/dia
              </div>
            )}
            {demanda.data_inicio && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(demanda.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              {demanda.prioridade}
            </div>
          </div>

          {demanda.descricao && (
            <div>
              <h4 className="text-sm font-medium mb-2">Descrição</h4>
              <p className="text-sm text-muted-foreground">{demanda.descricao}</p>
            </div>
          )}

          <Separator />

          {/* Configurações da Plataforma */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                Configurações {demanda.plataforma === "META" ? "Meta Ads" : "Google Ads"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {demanda.plataforma === "META" ? (
                <>
                  {demanda.meta_tipo_campanha && (
                    <div><strong>Tipo:</strong> {demanda.meta_tipo_campanha}</div>
                  )}
                  {demanda.meta_objetivo && (
                    <div><strong>Objetivo:</strong> {demanda.meta_objetivo}</div>
                  )}
                  {demanda.meta_publico_alvo && (
                    <div><strong>Público:</strong> {demanda.meta_publico_alvo}</div>
                  )}
                  {(demanda.meta_idade_min || demanda.meta_idade_max) && (
                    <div><strong>Idade:</strong> {demanda.meta_idade_min} - {demanda.meta_idade_max} anos</div>
                  )}
                  {demanda.meta_interesses && demanda.meta_interesses.length > 0 && (
                    <div>
                      <strong>Interesses:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {demanda.meta_interesses.map((i, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{i}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {demanda.meta_posicionamentos && demanda.meta_posicionamentos.length > 0 && (
                    <div>
                      <strong>Posicionamentos:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {demanda.meta_posicionamentos.map((p, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {demanda.google_tipo_campanha && (
                    <div><strong>Tipo:</strong> {demanda.google_tipo_campanha}</div>
                  )}
                  {demanda.google_tipo_correspondencia && (
                    <div><strong>Correspondência:</strong> {demanda.google_tipo_correspondencia}</div>
                  )}
                  {demanda.google_palavras_chave && demanda.google_palavras_chave.length > 0 && (
                    <div>
                      <strong>Palavras-chave:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {demanda.google_palavras_chave.map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Criativos */}
          {demanda.criativos && demanda.criativos.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Criativos ({demanda.criativos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {demanda.criativos.map((c: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                    {c.url_midia ? (
                      <img 
                        src={c.url_midia} 
                        className="w-20 h-20 object-cover rounded"
                        alt={`Criativo ${idx + 1}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/80x80?text=Img";
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
                      {c.descricao && <p className="text-sm mt-1">{c.descricao}</p>}
                      {c.cta && <p className="text-xs text-muted-foreground mt-1">CTA: {c.cta}</p>}
                      {c.url_midia && (
                        <a 
                          href={c.url_midia} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver mídia
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Landing Pages */}
          {demanda.landing_pages && demanda.landing_pages.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Landing Pages
                  {demanda.teste_ab_paginas && <Badge variant="secondary" className="text-xs">Teste A/B</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {demanda.landing_pages.map((lp, idx) => (
                    <li key={idx}>
                      <a 
                        href={lp} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {lp}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* UTMs */}
          {(demanda.utm_source || demanda.utm_medium || demanda.utm_campaign) && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Parâmetros UTM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {demanda.utm_source && <div><strong>source:</strong> {demanda.utm_source}</div>}
                  {demanda.utm_medium && <div><strong>medium:</strong> {demanda.utm_medium}</div>}
                  {demanda.utm_campaign && <div><strong>campaign:</strong> {demanda.utm_campaign}</div>}
                  {demanda.utm_content && <div><strong>content:</strong> {demanda.utm_content}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Ações do Executor */}
          {(canAssumir || canExecutar || canRejeitar) && (
            <div className="space-y-4 pt-2">
              <h4 className="font-medium">Ações</h4>
              
              {canExecutar && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="id_campanha">ID da Campanha Criada *</Label>
                    <Input 
                      id="id_campanha"
                      value={idCampanhaCriada}
                      onChange={(e) => setIdCampanhaCriada(e.target.value)}
                      placeholder="Digite o ID da campanha criada na plataforma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea 
                      id="observacoes"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Observações adicionais..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {canAssumir && (
                  <Button 
                    onClick={() => assumirMutation.mutate()}
                    disabled={assumirMutation.isPending}
                    className="gap-2"
                  >
                    {assumirMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Assumir Demanda
                  </Button>
                )}

                {canExecutar && (
                  <Button 
                    onClick={() => executarMutation.mutate()}
                    disabled={executarMutation.isPending}
                    className="gap-2"
                  >
                    {executarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Marcar como Executada
                  </Button>
                )}

                {canRejeitar && (
                  <Button 
                    variant="destructive"
                    onClick={() => rejeitarMutation.mutate()}
                    disabled={rejeitarMutation.isPending}
                    className="gap-2"
                  >
                    {rejeitarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Rejeitar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Info de Execução */}
          {demanda.id_campanha_criada && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Campanha Criada</h4>
              <p className="text-sm"><strong>ID:</strong> {demanda.id_campanha_criada}</p>
              {demanda.observacoes_executor && (
                <p className="text-sm mt-1"><strong>Observações:</strong> {demanda.observacoes_executor}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
