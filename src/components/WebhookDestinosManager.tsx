import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Trash2, Send, ChevronDown, ChevronUp, ExternalLink, History, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookDestino {
  id: string;
  nome: string;
  url: string;
  id_empresa: string | null;
  ativo: boolean;
  headers: Record<string, string>;
  eventos: string[];
  created_at: string;
}

interface WebhookLog {
  id: string;
  id_lead: string;
  id_webhook_destino: string;
  evento: string;
  status: string;
  status_code: number | null;
  resposta: string | null;
  created_at: string;
}

export function WebhookDestinosManager() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [newDestino, setNewDestino] = useState({
    nome: '',
    url: '',
    id_empresa: '',
    headers: '',
    eventos: ['lead_criado', 'lead_atualizado', 'enriquecimento']
  });

  // Buscar empresas
  const { data: empresas } = useQuery({
    queryKey: ['empresas-webhook'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa')
        .select('id_empresa, nome')
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  // Buscar destinos de webhook
  const { data: destinos, isLoading } = useQuery({
    queryKey: ['webhook-destinos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_destino')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WebhookDestino[];
    }
  });

  // Buscar logs de um destino específico
  const fetchLogs = async (destinoId: string) => {
    const { data, error } = await supabase
      .from('lead_webhook_log')
      .select('*')
      .eq('id_webhook_destino', destinoId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data as WebhookLog[];
  };

  // Mutation para adicionar destino
  const addDestinoMutation = useMutation({
    mutationFn: async () => {
      let parsedHeaders = {};
      if (newDestino.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(newDestino.headers);
        } catch {
          throw new Error('Headers inválidos. Use formato JSON.');
        }
      }

      const { error } = await supabase.from('webhook_destino').insert({
        nome: newDestino.nome,
        url: newDestino.url,
        id_empresa: newDestino.id_empresa || null,
        headers: parsedHeaders,
        eventos: newDestino.eventos
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-destinos'] });
      setIsAddDialogOpen(false);
      setNewDestino({ nome: '', url: '', id_empresa: '', headers: '', eventos: ['lead_criado', 'lead_atualizado', 'enriquecimento'] });
      toast.success('Destino de webhook adicionado!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Mutation para alternar ativo/inativo
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('webhook_destino')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-destinos'] });
    }
  });

  // Mutation para deletar destino
  const deleteDestinoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_destino')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-destinos'] });
      toast.success('Destino removido!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Mutation para testar webhook
  const testarWebhookMutation = useMutation({
    mutationFn: async (destino: WebhookDestino) => {
      const testPayload = {
        evento: 'teste',
        timestamp: new Date().toISOString(),
        lead: {
          id: 'test-lead-id',
          nome: 'Lead de Teste',
          email: 'teste@exemplo.com',
          empresa: 'Empresa Teste',
          id_empresa: destino.id_empresa || 'all',
          stage_atual: 'Teste',
          is_mql: true,
          levantou_mao: false,
          tem_reuniao: false,
          reuniao_realizada: false,
          venda_realizada: false,
          valor_venda: null,
          utm_source: 'teste',
          utm_medium: 'teste',
          utm_campaign: 'teste',
          utm_content: null,
          utm_term: null,
          origem_tipo: 'MANUAL',
          lead_pago: false,
          mautic: { score: 50, page_hits: 10, last_active: null, first_visit: null, tags: [], segments: [], cidade: null, estado: null },
          tokeniza: { investidor: false, valor_investido: 0, qtd_investimentos: 0, projetos: [], carrinho_abandonado: false, valor_carrinho: 0, projeto_nome: null },
          url_pipedrive: null,
          data_criacao: new Date().toISOString(),
          data_atualizacao: new Date().toISOString(),
          data_mql: null,
          data_levantou_mao: null,
          data_reuniao: null,
          data_venda: null
        }
      };

      const response = await fetch(destino.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(destino.headers || {})
        },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      return response.status;
    },
    onSuccess: (statusCode) => {
      toast.success(`Teste enviado com sucesso! Status: ${statusCode}`);
    },
    onError: (error) => {
      toast.error(`Erro no teste: ${error.message}`);
    }
  });

  // Disparar webhooks manualmente
  const dispararManualMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('disparar-webhook-leads', {
        body: {}
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Webhooks disparados: ${data.webhooks_enviados} enviados`);
      queryClient.invalidateQueries({ queryKey: ['webhook-destinos'] });
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const getEmpresaNome = (id: string | null) => {
    if (!id) return 'Todas';
    return empresas?.find(e => e.id_empresa === id)?.nome || id;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            Webhooks de Saída
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">
            Configure URLs para receber notificações de leads
          </CardDescription>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispararManualMutation.mutate()}
            disabled={dispararManualMutation.isPending}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${dispararManualMutation.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Disparar Agora</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Novo Destino de Webhook</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Configure uma URL para receber notificações de leads
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-xs sm:text-sm">Nome</Label>
                  <Input
                    id="nome"
                    value={newDestino.nome}
                    onChange={(e) => setNewDestino({ ...newDestino, nome: e.target.value })}
                    placeholder="Ex: n8n Automação"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-xs sm:text-sm">URL do Webhook</Label>
                  <Input
                    id="url"
                    value={newDestino.url}
                    onChange={(e) => setNewDestino({ ...newDestino, url: e.target.value })}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa" className="text-xs sm:text-sm">Empresa (opcional)</Label>
                  <Select
                    value={newDestino.id_empresa || "todas"}
                    onValueChange={(value) => setNewDestino({ ...newDestino, id_empresa: value === "todas" ? "" : value })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Todas as empresas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as empresas</SelectItem>
                      {empresas?.map((empresa) => (
                        <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                          {empresa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headers" className="text-xs sm:text-sm">Headers (JSON, opcional)</Label>
                  <Input
                    id="headers"
                    value={newDestino.headers}
                    onChange={(e) => setNewDestino({ ...newDestino, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer token"}'
                    className="text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button
                  onClick={() => addDestinoMutation.mutate()}
                  disabled={!newDestino.nome || !newDestino.url || addDestinoMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
        ) : destinos?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
            Nenhum destino configurado. Adicione um destino para começar a enviar webhooks.
          </div>
        ) : (
          <div className="space-y-3">
            {destinos?.map((destino) => (
              <Collapsible
                key={destino.id}
                open={expandedLogs === destino.id}
                onOpenChange={(open) => setExpandedLogs(open ? destino.id : null)}
              >
                <div className="border rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <Switch
                        checked={destino.ativo}
                        onCheckedChange={(ativo) => toggleAtivoMutation.mutate({ id: destino.id, ativo })}
                        className="shrink-0 mt-1 sm:mt-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex flex-wrap items-center gap-2 text-sm">
                          {destino.nome}
                          {destino.ativo ? (
                            <Badge variant="default" className="text-xs">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">
                          {destino.url}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Empresa: {getEmpresaNome(destino.id_empresa)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-8 sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testarWebhookMutation.mutate(destino)}
                        disabled={testarWebhookMutation.isPending}
                        className="h-8 px-2 sm:px-3"
                      >
                        <Send className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Testar</span>
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                          <History className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Logs</span>
                          {expandedLogs === destino.id ? (
                            <ChevronUp className="h-4 w-4 ml-0 sm:ml-1" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-0 sm:ml-1" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDestinoMutation.mutate(destino.id)}
                        disabled={deleteDestinoMutation.isPending}
                        className="h-8 px-2"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent className="mt-4">
                    <WebhookLogsSection destinoId={destino.id} fetchLogs={fetchLogs} />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookLogsSection({ destinoId, fetchLogs }: { destinoId: string; fetchLogs: (id: string) => Promise<WebhookLog[]> }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['webhook-logs', destinoId],
    queryFn: () => fetchLogs(destinoId)
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando logs...</div>;
  }

  if (!logs || logs.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhum log encontrado.</div>;
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="text-xs border rounded p-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={log.status === 'enviado' ? 'default' : 'destructive'} className="text-xs">
                {log.status}
              </Badge>
              <span className="text-muted-foreground">{log.evento}</span>
              {log.status_code && (
                <span className="text-muted-foreground">({log.status_code})</span>
              )}
            </div>
            <span className="text-muted-foreground">
              {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          </div>
          {log.resposta && (
            <div className="mt-1 text-muted-foreground truncate">
              {log.resposta.substring(0, 100)}...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
