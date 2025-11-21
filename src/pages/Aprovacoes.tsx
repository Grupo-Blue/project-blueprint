import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AcaoPendente {
  id_acao: string;
  tipo_acao: string;
  descricao: string;
  impacto_esperado: string;
  data_criacao: string;
  empresa: { nome: string } | null;
  usuario: { nome: string } | null;
}

const Aprovacoes = () => {
  const [acoesPendentes, setAcoesPendentes] = useState<AcaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAcao, setSelectedAcao] = useState<AcaoPendente | null>(null);
  const [comentario, setComentario] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"aprovar" | "reprovar">("aprovar");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Verificar se usuário tem permissão (direção ou admin)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasPermission = roles?.some(
      (r) => r.role === "admin" || r.role === "direcao"
    );

    if (!hasPermission) {
      toast({
        title: "Acesso negado",
        description: "Apenas direção e admin podem acessar esta página",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    fetchAcoesPendentes();
  };

  const fetchAcoesPendentes = async () => {
    try {
      const { data, error } = await supabase
        .from("acao")
        .select("*, empresa(nome)")
        .eq("categoria", "C")
        .eq("status", "PENDENTE")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      
      // Buscar profiles para cada ação
      if (data) {
        const userIds = [...new Set(data.map(a => a.id_usuario))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const acoesWithUsers = data.map(acao => ({
          ...acao,
          usuario: profilesMap.get(acao.id_usuario) || { nome: "Usuário não encontrado" }
        }));
        
        setAcoesPendentes(acoesWithUsers as any);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (acao: AcaoPendente, type: "aprovar" | "reprovar") => {
    setSelectedAcao(acao);
    setActionType(type);
    setComentario("");
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedAcao) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const novoStatus = actionType === "aprovar" ? "APROVADA" : "REPROVADA";
      
      // Atualizar status da ação
      const { error: updateError } = await supabase
        .from("acao")
        .update({
          status: novoStatus,
          motivo_reprovacao: actionType === "reprovar" ? comentario : null,
        })
        .eq("id_acao", selectedAcao.id_acao);

      if (updateError) throw updateError;

      // Criar registro de aprovação
      const { error: approvalError } = await supabase
        .from("acao_aprovacao")
        .insert({
          id_acao: selectedAcao.id_acao,
          id_usuario_aprovador: user.id,
          status: actionType === "aprovar" ? "APROVADA" : "REPROVADA",
          comentario: comentario || null,
        });

      if (approvalError) throw approvalError;

      toast({
        title: actionType === "aprovar" ? "Ação aprovada!" : "Ação reprovada",
        description: `A ação foi ${actionType === "aprovar" ? "aprovada" : "reprovada"} com sucesso`,
      });

      setDialogOpen(false);
      setSelectedAcao(null);
      setComentario("");
      fetchAcoesPendentes();
    } catch (error: any) {
      toast({
        title: "Erro ao processar ação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && acoesPendentes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando aprovações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovações Categoria C</h1>
        <p className="text-muted-foreground">
          Ações de alto impacto aguardando sua decisão
        </p>
      </div>

      {acoesPendentes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <p className="text-xl font-medium">Nenhuma ação pendente</p>
            <p className="text-sm text-muted-foreground">
              Todas as ações Categoria C foram processadas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {acoesPendentes.map((acao) => (
            <Card key={acao.id_acao} className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      {acao.tipo_acao}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {acao.empresa?.nome || "N/A"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(acao.data_criacao), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                    Categoria C
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Solicitado por:
                  </p>
                  <p className="text-sm">{acao.usuario?.nome || "N/A"}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Descrição / Motivo:
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{acao.descricao}</p>
                </div>

                {acao.impacto_esperado && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Impacto Esperado:
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{acao.impacto_esperado}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handleOpenDialog(acao, "aprovar")}
                    className="flex-1"
                    variant="default"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    onClick={() => handleOpenDialog(acao, "reprovar")}
                    className="flex-1"
                    variant="destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reprovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "aprovar" ? "Aprovar Ação" : "Reprovar Ação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {actionType === "aprovar"
                ? "Você está aprovando a execução desta ação de tráfego."
                : "Você está reprovando esta ação. Por favor, informe o motivo."}
            </p>

            <div className="space-y-2">
              <Label htmlFor="comentario">
                {actionType === "aprovar" ? "Comentário (opcional)" : "Motivo da Reprovação *"}
              </Label>
              <Textarea
                id="comentario"
                placeholder={
                  actionType === "aprovar"
                    ? "Adicione observações se necessário..."
                    : "Explique o motivo da reprovação..."
                }
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={4}
                required={actionType === "reprovar"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={loading || (actionType === "reprovar" && !comentario.trim())}
              variant={actionType === "aprovar" ? "default" : "destructive"}
            >
              {loading ? "Processando..." : actionType === "aprovar" ? "Confirmar Aprovação" : "Confirmar Reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Aprovacoes;
