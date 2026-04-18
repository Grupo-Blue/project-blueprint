import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Fingerprint, Users, Plus, RefreshCw, Layers, MoreHorizontal, Send, Download, Facebook, MessageCircle } from "lucide-react";
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

  // --- Segment Actions ---
  const syncMautic = useMutation({
    mutationFn: async (id_segmento: string) => {
      const { data, error } = await supabase.functions.invoke("sincronizar-segmento-mautic", {
        body: { id_segmento },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Mautic sincronizado: ${data.adicionados} leads adicionados`);
      queryClient.invalidateQueries({ queryKey: ["segmentos"] });
    },
    onError: (e) => toast.error(`Erro Mautic: ${e.message}`),
  });

  const exportMeta = useMutation({
    mutationFn: async (id_segmento: string) => {
      const { data, error } = await supabase.functions.invoke("exportar-segmento-meta", {
        body: { id_segmento },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Meta Ads: ${data.usuarios_enviados} usuários enviados para Custom Audience`);
      queryClient.invalidateQueries({ queryKey: ["segmentos"] });
    },
    onError: (e) => toast.error(`Erro Meta: ${e.message}`),
  });

  const disparoWhatsApp = useMutation({
    mutationFn: async (id_segmento: string) => {
      const seg = segmentos?.find(s => s.id === id_segmento);
      const { data, error } = await supabase.functions.invoke("disparar-segmento-whatsapp", {
        body: { id_segmento, nome_disparo: `Segmento: ${seg?.nome || id_segmento}` },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Disparo WhatsApp criado com ${data.leads_com_telefone} leads`);
    },
    onError: (e) => toast.error(`Erro WhatsApp: ${e.message}`),
  });

  const exportCSV = async (id_segmento: string) => {
    try {
      const { data, error } = await supabase
        .from("lead_segmento_membro")
        .select("lead:id_lead (nome_lead, email, telefone, stage_atual, origem_canal)")
        .eq("id_segmento", id_segmento)
        .is("removido_em", null);

      if (error) throw error;

      const rows = (data || []).map((m: any) => ({
        nome: m.lead?.nome_lead || "",
        email: m.lead?.email || "",
        telefone: m.lead?.telefone || "",
        stage: m.lead?.stage_atual || "",
        canal: m.lead?.origem_canal || "",
      }));

      const headers = ["nome", "email", "telefone", "stage", "canal"];
      const csv = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${(r as any)[h] || ""}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const seg = segmentos?.find(s => s.id === id_segmento);
      a.download = `segmento-${seg?.nome || "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado!");
    } catch (e: any) {
      toast.error(`Erro ao exportar: ${e.message}`);
    }
  };

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  const selectedSeg = segmentos?.find(s => s.id === selectedSegmento);

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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground truncate">{seg.nome}</p>
                          {seg.mautic_segment_id && <Badge variant="outline" className="text-[10px] px-1">Mautic</Badge>}
                          {seg.meta_audience_id && <Badge variant="outline" className="text-[10px] px-1">Meta</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{seg.descricao || regras?.tipo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={count > 0 ? "default" : "secondary"} className="text-xs">
                          {count} leads
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={() => syncMautic.mutate(seg.id)}
                              disabled={syncMautic.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Sincronizar Mautic
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => exportMeta.mutate(seg.id)}
                              disabled={exportMeta.isPending}
                            >
                              <Facebook className="h-4 w-4 mr-2" />
                              Enviar Meta Ads
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => disparoWhatsApp.mutate(seg.id)}
                              disabled={disparoWhatsApp.isPending}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Disparar WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportCSV(seg.id)}>
                              <Download className="h-4 w-4 mr-2" />
                              Exportar CSV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {selectedSeg?.nome || "Leads do Segmento"}
                      <Badge variant="outline" className="ml-2">{membros?.length || 0} resultados</Badge>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => syncMautic.mutate(selectedSegmento)}
                        disabled={syncMautic.isPending}
                      >
                        <Send className="h-3 w-3 mr-1" /> Mautic
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => exportMeta.mutate(selectedSegmento)}
                        disabled={exportMeta.isPending}
                      >
                        <Facebook className="h-3 w-3 mr-1" /> Meta
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => disparoWhatsApp.mutate(selectedSegmento)}
                        disabled={disparoWhatsApp.isPending}
                      >
                        <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => exportCSV(selectedSegmento)}
                      >
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                    </div>
                  </div>
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
