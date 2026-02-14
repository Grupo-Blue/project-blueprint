import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Sparkles, 
  Clock, 
  Play, 
  CheckCircle, 
  ShieldCheck,
  XCircle,
  Building2,
  Target,
  DollarSign,
  Image,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import FormularioDemandaCampanha from "@/components/demandas/FormularioDemandaCampanha";
import SugestoesIACampanhas from "@/components/demandas/SugestoesIACampanhas";
import DetalheDemanda from "@/components/demandas/DetalheDemanda";

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

export default function DemandasCampanha() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);
  const [demandaSelecionada, setDemandaSelecionada] = useState<DemandaCampanha | null>(null);
  const [dadosPrePreenchidos, setDadosPrePreenchidos] = useState<Partial<DemandaCampanha> | null>(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demandas, isLoading } = useQuery({
    queryKey: ["demandas-campanha", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("demanda_campanha")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .order("created_at", { ascending: false });

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DemandaCampanha[];
    },
    staleTime: 30000,
  });

  const demandasPorStatus = {
    PENDENTE: demandas?.filter(d => d.status === "PENDENTE") || [],
    EM_EXECUCAO: demandas?.filter(d => d.status === "EM_EXECUCAO") || [],
    EXECUTADA: demandas?.filter(d => d.status === "EXECUTADA") || [],
    VERIFICADA: demandas?.filter(d => d.status === "VERIFICADA") || [],
    REJEITADA: demandas?.filter(d => d.status === "REJEITADA") || [],
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDENTE": return <Clock className="h-4 w-4" />;
      case "EM_EXECUCAO": return <Play className="h-4 w-4" />;
      case "EXECUTADA": return <CheckCircle className="h-4 w-4" />;
      case "VERIFICADA": return <ShieldCheck className="h-4 w-4" />;
      case "REJEITADA": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDENTE": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "EM_EXECUCAO": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "EXECUTADA": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "VERIFICADA": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "REJEITADA": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA": return "destructive";
      case "MEDIA": return "secondary";
      case "BAIXA": return "outline";
      default: return "secondary";
    }
  };

  const handleSugestaoSelecionada = (sugestao: Partial<DemandaCampanha>) => {
    setDadosPrePreenchidos(sugestao);
    setSugestoesOpen(false);
    setDialogOpen(true);
  };

  const handleFormSubmit = () => {
    setDialogOpen(false);
    setDadosPrePreenchidos(null);
    queryClient.invalidateQueries({ queryKey: ["demandas-campanha"] });
  };

  const handleDemandaClick = (demanda: DemandaCampanha) => {
    setDemandaSelecionada(demanda);
    setDetalheOpen(true);
  };

  if (isLoading || loadingEmpresas) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  const renderDemandaCard = (demanda: DemandaCampanha) => (
    <Card 
      key={demanda.id_demanda} 
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => handleDemandaClick(demanda)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{demanda.titulo}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {demanda.plataforma}
              </Badge>
              <Badge variant={getPrioridadeColor(demanda.prioridade) as any} className="text-xs">
                {demanda.prioridade}
              </Badge>
              {demanda.sugerida_por_ia && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  IA
                </Badge>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(demanda.status)}`}>
            {getStatusIcon(demanda.status)}
            <span className="hidden sm:inline">{demanda.status.replace("_", " ")}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {demanda.descricao && (
          <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {demanda.empresa?.nome}
          </span>
          {demanda.verba_diaria && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              R$ {demanda.verba_diaria}/dia
            </span>
          )}
          {demanda.criativos && demanda.criativos.length > 0 && (
            <span className="flex items-center gap-1">
              <Image className="h-3 w-3" />
              {demanda.criativos.length} criativos
            </span>
          )}
          {demanda.data_inicio && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(demanda.data_inicio), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2 text-xs text-muted-foreground">
        Criada em {format(new Date(demanda.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Demandas de Campanhas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie solicitações de criação de campanhas
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setSugestoesOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Sugestões IA
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setDadosPrePreenchidos(null);
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Demanda
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {dadosPrePreenchidos?.sugerida_por_ia 
                      ? "Criar Campanha Sugerida pela IA" 
                      : "Nova Demanda de Campanha"}
                  </DialogTitle>
                </DialogHeader>
                <FormularioDemandaCampanha 
                  dadosIniciais={dadosPrePreenchidos || undefined}
                  onSubmit={handleFormSubmit}
                  onCancel={() => {
                    setDialogOpen(false);
                    setDadosPrePreenchidos(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(demandasPorStatus).map(([status, lista]) => (
            <Card key={status} className="p-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-full ${getStatusColor(status)}`}>
                  {getStatusIcon(status)}
                </div>
                <div>
                  <p className="text-2xl font-bold">{lista.length}</p>
                  <p className="text-xs text-muted-foreground">{status.replace("_", " ")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs por Status */}
        <Tabs defaultValue="PENDENTE">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="PENDENTE" className="gap-1">
              <Clock className="h-4 w-4 hidden sm:inline" />
              Pendentes ({demandasPorStatus.PENDENTE.length})
            </TabsTrigger>
            <TabsTrigger value="EM_EXECUCAO" className="gap-1">
              <Play className="h-4 w-4 hidden sm:inline" />
              Executando ({demandasPorStatus.EM_EXECUCAO.length})
            </TabsTrigger>
            <TabsTrigger value="EXECUTADA" className="gap-1">
              <CheckCircle className="h-4 w-4 hidden sm:inline" />
              Executadas ({demandasPorStatus.EXECUTADA.length})
            </TabsTrigger>
            <TabsTrigger value="VERIFICADA" className="gap-1">
              <ShieldCheck className="h-4 w-4 hidden sm:inline" />
              Verificadas ({demandasPorStatus.VERIFICADA.length})
            </TabsTrigger>
            <TabsTrigger value="REJEITADA" className="gap-1">
              <XCircle className="h-4 w-4 hidden sm:inline" />
              Rejeitadas ({demandasPorStatus.REJEITADA.length})
            </TabsTrigger>
          </TabsList>

          {Object.entries(demandasPorStatus).map(([status, lista]) => (
            <TabsContent key={status} value={status} className="mt-6">
              {lista.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma demanda com status "{status.replace("_", " ")}"</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lista.map(renderDemandaCard)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Dialog de Sugestões IA */}
      <SugestoesIACampanhas 
        open={sugestoesOpen}
        onOpenChange={setSugestoesOpen}
        onSugestaoSelecionada={handleSugestaoSelecionada}
      />

      {/* Dialog de Detalhes */}
      <DetalheDemanda
        demanda={demandaSelecionada}
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["demandas-campanha"] })}
      />
    </div>
  );
}
