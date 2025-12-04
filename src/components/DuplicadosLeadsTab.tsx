import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Merge, Users, DollarSign, Calendar, Mail, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DuplicadoGrupo {
  email: string;
  leads: any[];
  totalLeads: number;
  leadsPipedrive: any[];
  leadsTokeniza: any[];
  valorTotalTokeniza: number;
}

const DuplicadosLeadsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [selectedPrincipal, setSelectedPrincipal] = useState<Record<string, string>>({});
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [emailParaMerge, setEmailParaMerge] = useState<string | null>(null);

  // Buscar user roles para verificar permissão
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
  });

  const podeMergear = userRoles?.some(role => ['admin', 'direcao', 'sdr'].includes(role));

  // Buscar leads duplicados (mesmo email, Pipedrive + Tokeniza)
  const { data: duplicados, isLoading, refetch } = useQuery({
    queryKey: ["leads-duplicados"],
    queryFn: async () => {
      // Buscar todos os leads não merged com email
      const { data: leads, error } = await supabase
        .from("lead")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .not("email", "is", null)
        .or("merged.is.null,merged.eq.false")
        .order("data_criacao", { ascending: false });

      if (error) throw error;

      // Agrupar por email
      const gruposPorEmail: Record<string, any[]> = {};
      leads?.forEach(lead => {
        const email = lead.email?.toLowerCase().trim();
        if (email) {
          if (!gruposPorEmail[email]) {
            gruposPorEmail[email] = [];
          }
          gruposPorEmail[email].push(lead);
        }
      });

      // Filtrar apenas emails que têm AMBOS tipos (Pipedrive e Tokeniza)
      const duplicadosComAmbos: DuplicadoGrupo[] = [];
      
      Object.entries(gruposPorEmail).forEach(([email, leadsGrupo]) => {
        const leadsPipedrive = leadsGrupo.filter(l => !l.id_lead_externo?.startsWith('tokeniza_'));
        const leadsTokeniza = leadsGrupo.filter(l => l.id_lead_externo?.startsWith('tokeniza_'));
        
        // Só incluir se tem ambos os tipos
        if (leadsPipedrive.length > 0 && leadsTokeniza.length > 0) {
          const valorTotalTokeniza = leadsTokeniza.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
          
          duplicadosComAmbos.push({
            email,
            leads: leadsGrupo,
            totalLeads: leadsGrupo.length,
            leadsPipedrive,
            leadsTokeniza,
            valorTotalTokeniza,
          });
        }
      });

      // Ordenar por valor total (maior primeiro)
      return duplicadosComAmbos.sort((a, b) => b.valorTotalTokeniza - a.valorTotalTokeniza);
    },
  });

  // Mutation para fazer o merge
  const mergeMutation = useMutation({
    mutationFn: async ({ email, leadPrincipalId }: { email: string; leadPrincipalId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const grupo = duplicados?.find(d => d.email === email);
      if (!grupo) throw new Error("Grupo não encontrado");

      const leadPrincipal = grupo.leads.find(l => l.id_lead === leadPrincipalId);
      if (!leadPrincipal) throw new Error("Lead principal não encontrado");

      const leadsSecundarios = grupo.leads.filter(l => l.id_lead !== leadPrincipalId);
      const leadsTokeniza = grupo.leadsTokeniza;

      // Consolidar dados Tokeniza
      const valorTotalTokeniza = leadsTokeniza.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
      const qtdInvestimentos = leadsTokeniza.length;
      const ultimaVenda = leadsTokeniza
        .filter(l => l.data_venda)
        .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]?.data_venda;
      const primeiroInvestimento = leadsTokeniza
        .filter(l => l.data_venda)
        .sort((a, b) => new Date(a.data_venda).getTime() - new Date(b.data_venda).getTime())[0]?.data_venda;
      
      // Extrair projetos únicos
      const projetos = [...new Set(leadsTokeniza.map(l => l.tokeniza_projeto_nome).filter(Boolean))];
      const ultimoProjeto = leadsTokeniza
        .filter(l => l.data_venda && l.tokeniza_projeto_nome)
        .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]?.tokeniza_projeto_nome;

      // 1. Atualizar lead principal com dados consolidados
      const { error: updateError } = await supabase
        .from("lead")
        .update({
          // Dados Tokeniza sempre sobrescrevem
          valor_venda: valorTotalTokeniza,
          data_venda: ultimaVenda || leadPrincipal.data_venda,
          venda_realizada: valorTotalTokeniza > 0,
          tokeniza_investidor: valorTotalTokeniza > 0,
          tokeniza_valor_investido: valorTotalTokeniza,
          tokeniza_qtd_investimentos: qtdInvestimentos,
          tokeniza_projetos: projetos,
          tokeniza_projeto_nome: ultimoProjeto,
          tokeniza_primeiro_investimento: primeiroInvestimento,
          tokeniza_ultimo_investimento: ultimaVenda,
          tokeniza_carrinho_abandonado: false, // Se já investiu, não é carrinho abandonado
        })
        .eq("id_lead", leadPrincipalId);

      if (updateError) throw updateError;

      // 2. Marcar leads secundários como merged
      const secundariosIds = leadsSecundarios.map(l => l.id_lead);
      if (secundariosIds.length > 0) {
        const { error: mergeError } = await supabase
          .from("lead")
          .update({
            merged: true,
            merged_into_lead_id: leadPrincipalId,
            merged_at: new Date().toISOString(),
            merged_by: user.id,
          })
          .in("id_lead", secundariosIds);

        if (mergeError) throw mergeError;
      }

      return { leadPrincipalId, mergedCount: secundariosIds.length };
    },
    onSuccess: (data) => {
      toast({
        title: "Merge realizado com sucesso!",
        description: `${data.mergedCount} leads foram consolidados no lead principal.`,
      });
      queryClient.invalidateQueries({ queryKey: ["leads-duplicados"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setMergeDialogOpen(false);
      setEmailParaMerge(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao fazer merge",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleEmail = (email: string) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const handleMergeClick = (email: string) => {
    if (!selectedPrincipal[email]) {
      toast({
        title: "Selecione o lead principal",
        description: "Escolha qual lead deve ser mantido como principal antes de fazer o merge.",
        variant: "destructive",
      });
      return;
    }
    setEmailParaMerge(email);
    setMergeDialogOpen(true);
  };

  const confirmMerge = () => {
    if (!emailParaMerge || !selectedPrincipal[emailParaMerge]) return;
    mergeMutation.mutate({
      email: emailParaMerge,
      leadPrincipalId: selectedPrincipal[emailParaMerge],
    });
  };

  const grupoParaMerge = duplicados?.find(d => d.email === emailParaMerge);
  const leadPrincipalPreview = grupoParaMerge?.leads.find(l => l.id_lead === selectedPrincipal[emailParaMerge || '']);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Buscando leads duplicados...</p>
        </div>
      </div>
    );
  }

  if (!duplicados || duplicados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum Lead Duplicado</CardTitle>
          <CardDescription>
            Não há emails com leads duplicados entre Pipedrive e Tokeniza.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              Todos os leads estão consolidados corretamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <span className="text-sm">
          <strong>{duplicados.length} emails</strong> com leads duplicados detectados (Pipedrive + Tokeniza)
        </span>
      </div>

      {/* Lista de duplicados */}
      <div className="space-y-3">
        {duplicados.map((grupo) => (
          <Card key={grupo.email} className="border-l-4 border-l-amber-500">
            <Collapsible open={expandedEmails.has(grupo.email)} onOpenChange={() => toggleEmail(grupo.email)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {expandedEmails.has(grupo.email) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {grupo.email}
                        </CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {grupo.totalLeads} leads ({grupo.leadsPipedrive.length} Pipedrive + {grupo.leadsTokeniza.length} Tokeniza)
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            R$ {grupo.valorTotalTokeniza.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      Duplicado
                    </Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Seleção do lead principal */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Selecione o lead principal:</p>
                    <RadioGroup
                      value={selectedPrincipal[grupo.email] || ""}
                      onValueChange={(value) => setSelectedPrincipal(prev => ({ ...prev, [grupo.email]: value }))}
                      className="space-y-2"
                    >
                      {/* Leads Pipedrive primeiro */}
                      {grupo.leadsPipedrive.map((lead) => (
                        <div key={lead.id_lead} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                          <RadioGroupItem value={lead.id_lead} id={lead.id_lead} className="mt-1" />
                          <Label htmlFor={lead.id_lead} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Pipedrive
                                  </Badge>
                                  <span className="font-medium">{lead.nome_lead || 'Sem nome'}</span>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1 space-y-1">
                                  <p>Stage: {lead.stage_atual || '-'}</p>
                                  {lead.utm_source && <p>UTMs: {lead.utm_source}/{lead.utm_medium}</p>}
                                  {lead.mautic_score && <p>Mautic: {lead.mautic_score} pts</p>}
                                  <p>Criado: {format(new Date(lead.data_criacao), "dd/MM/yyyy", { locale: ptBR })}</p>
                                </div>
                              </div>
                              {lead.url_pipedrive && (
                                <a 
                                  href={lead.url_pipedrive} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}

                      {/* Leads Tokeniza consolidados */}
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 bg-green-50/50 dark:bg-green-950/20">
                        <RadioGroupItem 
                          value={grupo.leadsTokeniza[0]?.id_lead} 
                          id={`tokeniza-${grupo.email}`} 
                          className="mt-1"
                          disabled={grupo.leadsPipedrive.length > 0} // Preferir Pipedrive como principal
                        />
                        <Label htmlFor={`tokeniza-${grupo.email}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Tokeniza
                            </Badge>
                            <span className="font-medium">
                              {grupo.leadsTokeniza.length} investimento{grupo.leadsTokeniza.length > 1 ? 's' : ''} consolidado{grupo.leadsTokeniza.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 space-y-1">
                            <p className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Valor total: R$ {grupo.valorTotalTokeniza.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Última venda: {grupo.leadsTokeniza
                                .filter(l => l.data_venda)
                                .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]?.data_venda 
                                ? format(new Date(grupo.leadsTokeniza
                                    .filter(l => l.data_venda)
                                    .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0].data_venda), "dd/MM/yyyy", { locale: ptBR })
                                : '-'}
                            </p>
                            <p>
                              Projetos: {[...new Set(grupo.leadsTokeniza.map(l => l.tokeniza_projeto_nome).filter(Boolean))].slice(0, 3).join(', ')}
                              {[...new Set(grupo.leadsTokeniza.map(l => l.tokeniza_projeto_nome).filter(Boolean))].length > 3 && '...'}
                            </p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {grupo.leadsPipedrive.length > 0 && !selectedPrincipal[grupo.email] && (
                      <p className="text-xs text-muted-foreground">
                        💡 Recomendamos selecionar o lead do Pipedrive como principal para manter UTMs, Mautic e histórico do funil.
                      </p>
                    )}
                  </div>

                  {/* Preview do Merge */}
                  {selectedPrincipal[grupo.email] && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <p className="text-sm font-medium">Preview do Merge:</p>
                      <div className="text-sm space-y-1">
                        {(() => {
                          const principal = grupo.leads.find(l => l.id_lead === selectedPrincipal[grupo.email]);
                          return (
                            <>
                              <p><strong>Nome:</strong> {principal?.nome_lead || 'Sem nome'}</p>
                              <p><strong>Email:</strong> {grupo.email}</p>
                              {principal?.utm_source && <p><strong>UTMs:</strong> {principal.utm_source}/{principal.utm_medium}/{principal.utm_campaign}</p>}
                              {principal?.mautic_score && <p><strong>Mautic:</strong> Score {principal.mautic_score}</p>}
                              <p><strong>Stage:</strong> {principal?.stage_atual || '-'}</p>
                              <p className="text-green-600 dark:text-green-400">
                                <strong>Valor Venda:</strong> R$ {grupo.valorTotalTokeniza.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (sempre Tokeniza)
                              </p>
                              <p className="text-green-600 dark:text-green-400">
                                <strong>Data Venda:</strong> {grupo.leadsTokeniza
                                  .filter(l => l.data_venda)
                                  .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]?.data_venda 
                                  ? format(new Date(grupo.leadsTokeniza
                                      .filter(l => l.data_venda)
                                      .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0].data_venda), "dd/MM/yyyy", { locale: ptBR })
                                  : '-'} (sempre Tokeniza)
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Botão de Merge */}
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => handleMergeClick(grupo.email)}
                      disabled={!selectedPrincipal[grupo.email] || !podeMergear || mergeMutation.isPending}
                      className="gap-2"
                    >
                      {mergeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Merge className="h-4 w-4" />
                      )}
                      Fazer Merge
                    </Button>
                  </div>

                  {!podeMergear && (
                    <p className="text-xs text-destructive">
                      ⚠️ Apenas Admin, Direção e SDR podem fazer merge de leads.
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Dialog de Confirmação */}
      <AlertDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Merge de Leads</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a consolidar <strong>{grupoParaMerge?.totalLeads || 0} leads</strong> em um único registro.
              </p>
              {leadPrincipalPreview && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Lead Principal:</strong> {leadPrincipalPreview.nome_lead || 'Sem nome'}</p>
                  <p><strong>Email:</strong> {grupoParaMerge?.email}</p>
                  <p><strong>Valor Final:</strong> R$ {grupoParaMerge?.valorTotalTokeniza.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              )}
              <p className="text-amber-600 dark:text-amber-400">
                Os {(grupoParaMerge?.totalLeads || 1) - 1} leads secundários serão arquivados e não aparecerão mais na lista.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={mergeMutation.isPending}>
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                "Confirmar Merge"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DuplicadosLeadsTab;
