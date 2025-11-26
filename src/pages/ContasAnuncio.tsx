import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContaAnuncio {
  id_conta: string;
  id_empresa: string;
  plataforma: "META" | "GOOGLE";
  nome: string;
  id_externo: string;
  ativa: boolean;
  created_at: string;
}

interface Empresa {
  id_empresa: string;
  nome: string;
}

export default function ContasAnuncio() {
  const { toast } = useToast();
  const [contas, setContas] = useState<ContaAnuncio[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaAnuncio | null>(null);

  const [idEmpresa, setIdEmpresa] = useState("");
  const [plataforma, setPlataforma] = useState<"META" | "GOOGLE">("META");
  const [nome, setNome] = useState("");
  const [idExterno, setIdExterno] = useState("");
  const [ativa, setAtiva] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contasRes, empresasRes] = await Promise.all([
        supabase.from("conta_anuncio").select("*").order("created_at", { ascending: false }),
        supabase.from("empresa").select("id_empresa, nome").order("nome"),
      ]);

      if (contasRes.error) throw contasRes.error;
      if (empresasRes.error) throw empresasRes.error;

      setContas(contasRes.data || []);
      setEmpresas(empresasRes.data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIdEmpresa("");
    setPlataforma("META");
    setNome("");
    setIdExterno("");
    setAtiva(true);
    setEditingConta(null);
  };

  const handleEdit = (conta: ContaAnuncio) => {
    setEditingConta(conta);
    setIdEmpresa(conta.id_empresa);
    setPlataforma(conta.plataforma);
    setNome(conta.nome);
    setIdExterno(conta.id_externo);
    setAtiva(conta.ativa);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conta?")) return;

    try {
      const { error } = await supabase.from("conta_anuncio").delete().eq("id_conta", id);

      if (error) throw error;

      toast({ title: "Conta excluída com sucesso" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir conta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idEmpresa || !nome || !idExterno) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const contaData = {
        id_empresa: idEmpresa,
        plataforma,
        nome,
        id_externo: idExterno,
        ativa,
      };

      if (editingConta) {
        const { error } = await supabase
          .from("conta_anuncio")
          .update(contaData)
          .eq("id_conta", editingConta.id_conta);

        if (error) throw error;
        toast({ title: "Conta atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("conta_anuncio").insert(contaData);

        if (error) throw error;
        toast({ title: "Conta criada com sucesso" });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar conta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const getEmpresaNome = (id: string) => {
    return empresas.find((e) => e.id_empresa === id)?.nome || "Desconhecida";
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Contas de Anúncio</h1>
            <p className="text-muted-foreground">
              Gerencie as contas de anúncio do Meta e Google Ads
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingConta ? "Editar Conta" : "Nova Conta de Anúncio"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingConta
                      ? "Atualize os dados da conta"
                      : "Adicione uma nova conta de anúncio"}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Empresa *</Label>
                    <Select value={idEmpresa} onValueChange={setIdEmpresa}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                            {empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="plataforma">Plataforma *</Label>
                    <Select value={plataforma} onValueChange={(v: "META" | "GOOGLE") => setPlataforma(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="META">Meta Ads</SelectItem>
                        <SelectItem value="GOOGLE">Google Ads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Conta *</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Conta Principal Meta"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idExterno">ID Externo *</Label>
                    <Input
                      id="idExterno"
                      value={idExterno}
                      onChange={(e) => setIdExterno(e.target.value)}
                      placeholder={plataforma === "META" ? "Ex: act_123456789" : "Ex: 123-456-7890"}
                    />
                    <p className="text-xs text-muted-foreground">
                      {plataforma === "META"
                        ? "ID da conta de anúncio do Meta (act_...)"
                        : "ID da conta Google Ads (xxx-xxx-xxxx)"}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="ativa" checked={ativa} onCheckedChange={setAtiva} />
                    <Label htmlFor="ativa">Conta ativa</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">
                    {editingConta ? "Atualizar" : "Criar"} Conta
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contas.map((conta) => (
            <Card key={conta.id_conta}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{conta.nome}</CardTitle>
                    <CardDescription>{getEmpresaNome(conta.id_empresa)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(conta)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(conta.id_conta)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plataforma:</span>
                  <span className="font-medium">
                    {conta.plataforma === "META" ? "Meta Ads" : "Google Ads"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID Externo:</span>
                  <span className="font-mono text-xs">{conta.id_externo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={conta.ativa ? "text-green-600" : "text-red-600"}>
                    {conta.ativa ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {contas.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma conta cadastrada</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira conta
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
