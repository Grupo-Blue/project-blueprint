import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const EMPRESAS_SUPORTADAS: Record<string, string> = {
  "61b5ffeb-fbbc-47c1-8ced-152bb647ed20": "Tokeniza",
  "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db": "Blue Consult",
};

interface Cadence {
  id: string;
  codigo: string;
  nome: string;
  empresa: string;
  canal_principal: string;
  ativo: boolean;
  steps_count?: number;
  descricao?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idSegmento: string | null;
  nomeSegmento: string;
  idEmpresa: string | null;
  totalLeads: number;
}

export function AutomatizarCadenciaDialog({
  open, onOpenChange, idSegmento, nomeSegmento, idEmpresa, totalLeads,
}: Props) {
  const qc = useQueryClient();
  const [selectedCadence, setSelectedCadence] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoCanal, setNovoCanal] = useState("WHATSAPP");
  const [novaDescricao, setNovaDescricao] = useState("");

  const empresaSuportada = idEmpresa && EMPRESAS_SUPORTADAS[idEmpresa];

  // Busca cadências existentes
  const { data: cadencias, isLoading: loadingCad, error: errCad } = useQuery({
    queryKey: ["amelia-cadences", idEmpresa],
    queryFn: async () => {
      if (!idEmpresa || !empresaSuportada) return [];
      const { data, error } = await supabase.functions.invoke("amelia-cadencia-proxy", {
        body: { action: "list_cadences", id_empresa: idEmpresa },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar cadências");
      return (data.cadences || []) as Cadence[];
    },
    enabled: open && !!idEmpresa && !!empresaSuportada,
  });

  // Cria nova cadência
  const criarCadencia = useMutation({
    mutationFn: async () => {
      if (!novoNome || !novoCodigo) throw new Error("Nome e código obrigatórios");
      const { data, error } = await supabase.functions.invoke("amelia-cadencia-proxy", {
        body: {
          action: "create_cadence",
          id_empresa: idEmpresa,
          nome: novoNome,
          codigo: novoCodigo,
          canal_principal: novoCanal,
          descricao: novaDescricao,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar cadência");
      return data.cadence;
    },
    onSuccess: (cad: any) => {
      toast.success(`Cadência "${cad?.nome || novoNome}" criada na Amélia!`);
      qc.invalidateQueries({ queryKey: ["amelia-cadences", idEmpresa] });
      setShowCreateForm(false);
      setNovoNome("");
      setNovoCodigo("");
      setNovaDescricao("");
      if (cad?.id) setSelectedCadence(cad.id);
    },
    onError: (e: any) => toast.error(`Erro ao criar cadência: ${e.message}`),
  });

  // Inscreve leads
  const inscrever = useMutation({
    mutationFn: async () => {
      if (!selectedCadence || !idSegmento) throw new Error("Selecione uma cadência");
      const { data, error } = await supabase.functions.invoke("amelia-cadencia-proxy", {
        body: {
          action: "enroll_leads",
          id_empresa: idEmpresa,
          id_segmento: idSegmento,
          cadence_id: selectedCadence,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao inscrever leads");
      return data;
    },
    onSuccess: (data) => {
      const enrolled = data.enrollment?.enrolled ?? 0;
      const skipped = data.enrollment?.skipped_already_enrolled ?? 0;
      toast.success(
        `✅ ${enrolled} leads inscritos na cadência. ${skipped > 0 ? `${skipped} já estavam inscritos. ` : ""}${data.inelegiveis_sem_nome_telefone > 0 ? `${data.inelegiveis_sem_nome_telefone} leads ignorados (sem nome ou telefone).` : ""}`,
        { duration: 8000 }
      );
      onOpenChange(false);
      setSelectedCadence(null);
    },
    onError: (e: any) => toast.error(`Erro ao inscrever leads: ${e.message}`, { duration: 10000 }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Automatizar Cadência na Amélia
          </DialogTitle>
          <DialogDescription>
            Segmento: <strong>{nomeSegmento}</strong> · {totalLeads} leads totais
          </DialogDescription>
        </DialogHeader>

        {!empresaSuportada ? (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Empresa não suportada</p>
              <p className="text-muted-foreground mt-1">
                A Amélia CRM atende apenas Tokeniza e Blue Consult no momento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md border">
              ℹ️ Apenas leads com <strong>nome e telefone válido</strong> serão enviados à Amélia.
              Telefones são normalizados para o formato internacional (+55).
            </div>

            {!showCreateForm ? (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cadências de {empresaSuportada}
                  </Label>
                  {loadingCad ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando cadências...
                    </div>
                  ) : errCad ? (
                    <p className="text-sm text-destructive py-2">Erro: {(errCad as Error).message}</p>
                  ) : (
                    <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                      {(cadencias || []).length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">
                          Nenhuma cadência ativa para esta empresa.
                        </p>
                      )}
                      {(cadencias || [])
                        .slice()
                        .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
                        .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCadence(c.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedCadence === c.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/50"
                          } ${!c.ativo ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                  c.ativo ? "bg-green-500" : "bg-red-500"
                                }`}
                                title={c.ativo ? "Cadência ativa" : "Cadência inativa"}
                                aria-label={c.ativo ? "Ativa" : "Inativa"}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{c.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{c.codigo}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[10px]">{c.canal_principal}</Badge>
                              {(c.steps_count ?? 0) > 0 && (
                                <Badge variant="secondary" className="text-[10px]">{c.steps_count} steps</Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Criar nova cadência
                </Button>

                <Button
                  className="w-full"
                  disabled={!selectedCadence || inscrever.isPending}
                  onClick={() => inscrever.mutate()}
                >
                  {inscrever.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Inscrevendo...</>
                  ) : (
                    <><Bot className="h-4 w-4 mr-1" /> Inscrever leads na cadência</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cad-nome">Nome da cadência</Label>
                    <Input
                      id="cad-nome"
                      placeholder="Ex: Reativação MQL Frio"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cad-codigo">Código (uppercase, sem espaços)</Label>
                    <Input
                      id="cad-codigo"
                      placeholder="Ex: REATIVACAO_MQL_FRIO"
                      value={novoCodigo}
                      onChange={(e) => setNovoCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cad-canal">Canal principal</Label>
                    <Select value={novoCanal} onValueChange={setNovoCanal}>
                      <SelectTrigger id="cad-canal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                        <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                        <SelectItem value="LIGACAO">Ligação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cad-desc">Descrição (opcional)</Label>
                    <Textarea
                      id="cad-desc"
                      placeholder="O que esta cadência faz..."
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={criarCadencia.isPending || !novoNome || !novoCodigo}
                    onClick={() => criarCadencia.mutate()}
                  >
                    {criarCadencia.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando...</>
                    ) : "Criar cadência"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 A cadência será criada vazia. Configure os passos (templates, intervalos) depois na Amélia.
                </p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
