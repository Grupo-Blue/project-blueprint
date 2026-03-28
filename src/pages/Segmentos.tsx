import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fingerprint, Users, Plus, Eye, Trash2, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIPOS_SEGMENTO = [
  { value: "alta_intencao", label: "Alta Intenção", desc: "Visitou LP + eventos recentes, sem venda" },
  { value: "aquecimento", label: "Aquecimento", desc: "Mautic page_hits > 3, engajamento crescente" },
  { value: "quase_cliente", label: "Quase Cliente", desc: "Stage avançado sem venda" },
  { value: "cliente_quente", label: "Cliente Quente", desc: "Comprou + voltou ao site recentemente" },
  { value: "reativacao", label: "Reativação", desc: "MQL inativo há 30+ dias" },
];

const Segmentos = () => {
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const queryClient = useQueryClient();
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  const empresaId = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: segmentos, isLoading } = useQuery({
    queryKey: ["segmentos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lead_segmento")
        .select("*")
        .eq("id_empresa", empresaId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: membrosCount } = useQuery({
    queryKey: ["segmentos-membros-count", empresaId],
    queryFn: async () => {
      if (!empresaId || !segmentos) return {};
      const counts: Record<string, number> = {};
      for (const seg of segmentos) {
        const { count } = await supabase
          .from("lead_segmento_membro")
          .select("*", { count: "exact", head: true })
          .eq("id_segmento", seg.id)
          .is("removido_em", null);
        counts[seg.id] = count || 0;
      }
      return counts;
    },
    enabled: !!segmentos && segmentos.length > 0,
  });

  const { data: membros } = useQuery({
    queryKey: ["segmento-membros", selectedSegmento],
    queryFn: async () => {
      if (!selectedSegmento) return [];
      const { data, error } = await supabase
        .from("lead_segmento_membro")
        .select(`
          id_lead,
          adicionado_em,
          lead:id_lead (
            nome_lead,
            email,
            telefone,
            stage_atual,
            origem_canal
          )
        `)
        .eq("id_segmento", selectedSegmento)
        .is("removido_em", null)
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSegmento,
  });

  const criarSegmento = useMutation({
    mutationFn: async () => {
      if (!empresaId || !novoNome || !novoTipo) throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("lead_segmento").insert({
        id_empresa: empresaId,
        nome: novoNome,
        descricao: novaDescricao,
        regras: { tipo: novoTipo },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segmentos"] });
      setShowCreate(false);
      setNovoNome("");
      setNovoTipo("");
      setNovaDescricao("");
      toast.success("Segmento criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const recalcular = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("calcular-segmentos", {
        body: { time: "manual" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segmentos"] });
      queryClient.invalidateQueries({ queryKey: ["segmentos-membros-count"] });
      queryClient.invalidateQueries({ queryKey: ["segmento-membros"] });
      toast.success("Segmentos recalculados!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            Segmentos Dinâmicos
          </h2>
          <p className="text-sm text-muted-foreground">Segmentação automática baseada em comportamento real</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalcular.isPending ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Segmento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Segmento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome do segmento" value={novoNome} onChange={e => setNovoNome(e.target.value)} />
                <Select value={novoTipo} onValueChange={setNovoTipo}>
                  <SelectTrigger><SelectValue placeholder="Tipo de regra" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_SEGMENTO.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} — {t.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Descrição (opcional)" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} />
                <Button onClick={() => criarSegmento.mutate()} disabled={criarSegmento.isPending} className="w-full">
                  Criar Segmento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!empresaId && (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">Selecione uma empresa para ver os segmentos.</p>
        </GlassCard>
      )}

      {empresaId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Segments List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Segmentos</h3>
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
              </div>
            ) : (
              (segmentos || []).map(seg => {
                const regras = seg.regras as any;
                const count = membrosCount?.[seg.id] || 0;
                const isSelected = selectedSegmento === seg.id;
                return (
                  <GlassCard
                    key={seg.id}
                    className={`p-4 cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50"}`}
                    onClick={() => setSelectedSegmento(seg.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{seg.nome}</p>
                        <p className="text-xs text-muted-foreground">{seg.descricao || regras?.tipo}</p>
                      </div>
                      <Badge variant={count > 0 ? "default" : "secondary"} className="text-xs">
                        {count} leads
                      </Badge>
                    </div>
                  </GlassCard>
                );
              })
            )}
            {!isLoading && (!segmentos || segmentos.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum segmento. Clique em "Recalcular" para criar os padrão.
              </p>
            )}
          </div>

          {/* Members Table */}
          <div className="lg:col-span-2">
            {selectedSegmento ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Leads do Segmento
                    <Badge variant="outline" className="ml-auto">{membros?.length || 0} resultados</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Adicionado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(membros || []).map((m: any) => (
                        <TableRow key={m.id_lead}>
                          <TableCell className="font-medium">{m.lead?.nome_lead || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.lead?.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{m.lead?.stage_atual || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{m.lead?.origem_canal || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.adicionado_em ? format(new Date(m.adicionado_em), "dd/MM HH:mm") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!membros || membros.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum lead neste segmento
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <GlassCard className="p-12 text-center">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Selecione um segmento para ver os leads</p>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Segmentos;
