import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TIPOS = [
  { value: "total", label: "Total" },
  { value: "new_business", label: "New Business" },
  { value: "renovacao", label: "Renovação" },
];
const currentYear = new Date().getFullYear();

interface MetaForm {
  ano: number;
  mes: number;
  tipo_negocio: string;
  meta_receita: number;
  meta_vendas: number;
  meta_leads: number;
  indice_sazonal: number;
}

const defaultForm: MetaForm = {
  ano: currentYear,
  mes: 1,
  tipo_negocio: "total",
  meta_receita: 0,
  meta_vendas: 0,
  meta_leads: 0,
  indice_sazonal: 1.0,
};

const MetasComerciais = () => {
  const { empresaSelecionada } = useEmpresa();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MetaForm>(defaultForm);
  const [filtroAno, setFiltroAno] = useState(currentYear);

  const empresaId = empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-comerciais", empresaId, filtroAno],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("meta_comercial")
        .select("*")
        .eq("id_empresa", empresaId)
        .eq("ano", filtroAno)
        .order("mes")
        .order("tipo_negocio");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: MetaForm) => {
      if (!empresaId) throw new Error("Selecione uma empresa");
      const payload = { ...formData, id_empresa: empresaId };
      if (editingId) {
        const { error } = await supabase
          .from("meta_comercial")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("meta_comercial")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-comerciais"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
      toast({ title: editingId ? "Meta atualizada" : "Meta criada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_comercial").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-comerciais"] });
      toast({ title: "Meta removida" });
    },
  });

  const openEdit = (meta: any) => {
    setEditingId(meta.id);
    setForm({
      ano: meta.ano,
      mes: meta.mes,
      tipo_negocio: meta.tipo_negocio,
      meta_receita: meta.meta_receita,
      meta_vendas: meta.meta_vendas,
      meta_leads: meta.meta_leads,
      indice_sazonal: meta.indice_sazonal,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" /> Metas Comerciais
          </h1>
          <p className="text-sm text-muted-foreground">Configure metas mensais e índices sazonais</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(filtroAno)} onValueChange={(v) => setFiltroAno(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew} disabled={!empresaId}>
                <Plus className="h-4 w-4 mr-1" /> Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Meta" : "Nova Meta"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Ano</Label>
                    <Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Mês</Label>
                    <Select value={String(form.mes)} onValueChange={(v) => setForm({ ...form, mes: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.tipo_negocio} onValueChange={(v) => setForm({ ...form, tipo_negocio: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Meta Receita (R$)</Label>
                    <Input type="number" value={form.meta_receita} onChange={(e) => setForm({ ...form, meta_receita: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Meta Vendas</Label>
                    <Input type="number" value={form.meta_vendas} onChange={(e) => setForm({ ...form, meta_vendas: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Meta Leads</Label>
                    <Input type="number" value={form.meta_leads} onChange={(e) => setForm({ ...form, meta_leads: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Índice Sazonal</Label>
                    <Input type="number" step="0.1" value={form.indice_sazonal} onChange={(e) => setForm({ ...form, indice_sazonal: Number(e.target.value) })} />
                  </div>
                </div>
                <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!empresaId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecione uma empresa específica para gerenciar metas.
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas {filtroAno}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !metas?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta cadastrada para {filtroAno}.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Sazonal</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metas.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{MESES[m.mes - 1]}</TableCell>
                        <TableCell className="capitalize">{TIPOS.find((t) => t.value === m.tipo_negocio)?.label || m.tipo_negocio}</TableCell>
                        <TableCell className="text-right">{fmt(m.meta_receita)}</TableCell>
                        <TableCell className="text-right">{m.meta_vendas}</TableCell>
                        <TableCell className="text-right">{m.meta_leads}</TableCell>
                        <TableCell className="text-right">{m.indice_sazonal?.toFixed(1)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(m)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(m.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MetasComerciais;
