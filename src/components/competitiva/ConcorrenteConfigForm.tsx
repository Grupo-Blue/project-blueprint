import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Settings,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

interface ConcorrenteForm {
  nome_concorrente: string;
  facebook_page_name: string;
  linkedin_page_url: string;
  google_advertiser_id: string;
  id_empresa: string;
  ativo: boolean;
}

const emptyForm: ConcorrenteForm = {
  nome_concorrente: "",
  facebook_page_name: "",
  linkedin_page_url: "",
  google_advertiser_id: "",
  id_empresa: "",
  ativo: true,
};

export default function ConcorrenteConfigForm() {
  const { empresaSelecionada } = useEmpresa();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConcorrenteForm>(emptyForm);

  // Fetch empresas for the select
  const { data: empresas } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("id_empresa, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch configs grouped by company
  const { data: configs, isLoading } = useQuery({
    queryKey: ["concorrente-configs", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("concorrente_config")
        .select("*, empresa:id_empresa(nome)")
        .order("nome_concorrente");
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Group configs by company
  const configsByEmpresa = (configs || []).reduce<Record<string, typeof configs>>((acc, c) => {
    const empresaNome = (c as any).empresa?.nome || "Sem empresa";
    if (!acc[empresaNome]) acc[empresaNome] = [];
    acc[empresaNome]!.push(c);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async (data: ConcorrenteForm & { id?: string }) => {
      const { id, ...rest } = data;
      if (id) {
        const { error } = await supabase.from("concorrente_config").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("concorrente_config").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Concorrente atualizado" : "Concorrente adicionado" });
      queryClient.invalidateQueries({ queryKey: ["concorrente-configs"] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("concorrente_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Concorrente removido" });
      queryClient.invalidateQueries({ queryKey: ["concorrente-configs"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  const openEdit = (config: any) => {
    setForm({
      nome_concorrente: config.nome_concorrente || "",
      facebook_page_name: config.facebook_page_name || "",
      linkedin_page_url: config.linkedin_page_url || "",
      google_advertiser_id: config.google_advertiser_id || "",
      id_empresa: config.id_empresa || "",
      ativo: config.ativo ?? true,
    });
    setEditingId(config.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm({
      ...emptyForm,
      id_empresa: empresaSelecionada !== "todas" ? empresaSelecionada : "",
    });
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome_concorrente || !form.id_empresa) {
      toast({ title: "Preencha nome e empresa", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...form, id: editingId || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Concorrentes Configurados
        </h3>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Concorrente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Concorrente" : "Novo Concorrente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={form.id_empresa} onValueChange={(v) => setForm({ ...form, id_empresa: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((e) => (
                      <SelectItem key={e.id_empresa} value={e.id_empresa}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do Concorrente *</Label>
                <Input
                  value={form.nome_concorrente}
                  onChange={(e) => setForm({ ...form, nome_concorrente: e.target.value })}
                  placeholder="Ex: Declare Cripto"
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook Page Name</Label>
                <Input
                  value={form.facebook_page_name}
                  onChange={(e) => setForm({ ...form, facebook_page_name: e.target.value })}
                  placeholder="Ex: declarecripto"
                />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn Page URL</Label>
                <Input
                  value={form.linkedin_page_url}
                  onChange={(e) => setForm({ ...form, linkedin_page_url: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Google Advertiser ID</Label>
                <Input
                  value={form.google_advertiser_id}
                  onChange={(e) => setForm({ ...form, google_advertiser_id: e.target.value })}
                  placeholder="Ex: AR12345678"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : Object.keys(configsByEmpresa).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(configsByEmpresa).map(([empresaNome, concorrentes]) => (
            <Card key={empresaNome}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  {empresaNome}
                  <Badge variant="secondary" className="ml-auto">{concorrentes!.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {concorrentes!.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.nome_concorrente}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {c.facebook_page_name && (
                          <Badge variant="outline" className="text-xs">Meta: {c.facebook_page_name}</Badge>
                        )}
                        {c.linkedin_page_url && (
                          <Badge variant="outline" className="text-xs">LinkedIn</Badge>
                        )}
                        {c.google_advertiser_id && (
                          <Badge variant="outline" className="text-xs">Google</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhum concorrente configurado</p>
            <p className="text-xs mt-1">Clique em "Adicionar Concorrente" para começar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
