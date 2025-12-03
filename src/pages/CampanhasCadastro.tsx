import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Campanha {
  id_campanha: string;
  id_conta: string;
  nome: string;
  id_campanha_externo: string;
  objetivo: string | null;
  url_esperada: string | null;
  ativa: boolean;
  data_criacao: string;
  created_at: string;
}

interface ContaAnuncio {
  id_conta: string;
  nome: string;
  plataforma: "META" | "GOOGLE";
  id_empresa: string;
}

interface Empresa {
  id_empresa: string;
  nome: string;
}

export default function CampanhasCadastro() {
  const { toast } = useToast();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [contas, setContas] = useState<ContaAnuncio[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);

  const [idConta, setIdConta] = useState("");
  const [nome, setNome] = useState("");
  const [idCampanhaExterno, setIdCampanhaExterno] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [urlEsperada, setUrlEsperada] = useState("");
  const [ativa, setAtiva] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campanhasRes, contasRes, empresasRes] = await Promise.all([
        supabase.from("campanha").select("*").order("created_at", { ascending: false }),
        supabase.from("conta_anuncio").select("*").order("nome"),
        supabase.from("empresa").select("id_empresa, nome").order("nome"),
      ]);

      if (campanhasRes.error) throw campanhasRes.error;
      if (contasRes.error) throw contasRes.error;
      if (empresasRes.error) throw empresasRes.error;

      setCampanhas(campanhasRes.data || []);
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
    setIdConta("");
    setNome("");
    setIdCampanhaExterno("");
    setObjetivo("");
    setUrlEsperada("");
    setAtiva(true);
    setEditingCampanha(null);
  };

  const handleEdit = (campanha: Campanha) => {
    setEditingCampanha(campanha);
    setIdConta(campanha.id_conta);
    setNome(campanha.nome);
    setIdCampanhaExterno(campanha.id_campanha_externo);
    setObjetivo(campanha.objetivo || "");
    setUrlEsperada(campanha.url_esperada || "");
    setAtiva(campanha.ativa);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

    try {
      const { error } = await supabase.from("campanha").delete().eq("id_campanha", id);

      if (error) throw error;

      toast({ title: "Campanha excluída com sucesso" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir campanha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idConta || !nome || !idCampanhaExterno) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const campanhaData = {
        id_conta: idConta,
        nome,
        id_campanha_externo: idCampanhaExterno,
        objetivo: objetivo || null,
        url_esperada: urlEsperada || null,
        ativa,
      };

      if (editingCampanha) {
        const { error } = await supabase
          .from("campanha")
          .update(campanhaData)
          .eq("id_campanha", editingCampanha.id_campanha);

        if (error) throw error;
        toast({ title: "Campanha atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("campanha").insert(campanhaData);

        if (error) throw error;
        toast({ title: "Campanha criada com sucesso" });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar campanha",
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

  const getContaNome = (idConta: string) => {
    const conta = contas.find((c) => c.id_conta === idConta);
    if (!conta) return "Desconhecida";
    const empresa = empresas.find((e) => e.id_empresa === conta.id_empresa);
    return `${conta.nome} (${empresa?.nome || "?"})`;
  };

  const getContaPlataforma = (idConta: string) => {
    return contas.find((c) => c.id_conta === idConta)?.plataforma || "?";
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Campanhas</h1>
            <p className="text-muted-foreground">
              Gerencie as campanhas vinculadas às contas de anúncio
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingCampanha ? "Editar Campanha" : "Nova Campanha"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCampanha
                      ? "Atualize os dados da campanha"
                      : "Adicione uma nova campanha"}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="conta">Conta de Anúncio *</Label>
                    <Select value={idConta} onValueChange={setIdConta}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.map((conta) => {
                          const empresa = empresas.find((e) => e.id_empresa === conta.id_empresa);
                          return (
                            <SelectItem key={conta.id_conta} value={conta.id_conta}>
                              {conta.nome} ({empresa?.nome}) - {conta.plataforma}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Campanha *</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Black Friday 2024"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idExterno">ID Externo da Campanha *</Label>
                    <Input
                      id="idExterno"
                      value={idCampanhaExterno}
                      onChange={(e) => setIdCampanhaExterno(e.target.value)}
                      placeholder="Ex: 23850000000000000 (Meta) ou 123456789 (Google)"
                    />
                    <p className="text-xs text-muted-foreground">
                      ID da campanha na plataforma de anúncios
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objetivo">Objetivo (Opcional)</Label>
                    <Textarea
                      id="objetivo"
                      value={objetivo}
                      onChange={(e) => setObjetivo(e.target.value)}
                      placeholder="Ex: Aumentar vendas do produto X em 30%"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="urlEsperada">URL de Destino Esperada (com UTMs)</Label>
                    <Textarea
                      id="urlEsperada"
                      value={urlEsperada}
                      onChange={(e) => setUrlEsperada(e.target.value)}
                      placeholder="https://seusite.com.br/pagina?utm_source=facebook&utm_medium=cpc&utm_campaign=nome_campanha&utm_content={{ad.id}}"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole aqui a URL completa com todos os parâmetros UTM que você configurou nos anúncios. 
                      O sistema usará essa URL como referência para validar se os UTMs estão configurados corretamente.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="ativa" checked={ativa} onCheckedChange={setAtiva} />
                    <Label htmlFor="ativa">Campanha ativa</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">
                    {editingCampanha ? "Atualizar" : "Criar"} Campanha
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campanhas.map((campanha) => (
            <Card key={campanha.id_campanha}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{campanha.nome}</CardTitle>
                    <CardDescription>{getContaNome(campanha.id_conta)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(campanha)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(campanha.id_campanha)}
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
                    {getContaPlataforma(campanha.id_conta)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID Externo:</span>
                  <span className="font-mono text-xs">{campanha.id_campanha_externo}</span>
                </div>
                {campanha.objetivo && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Objetivo:</span>
                    <p className="text-xs mt-1">{campanha.objetivo}</p>
                  </div>
                )}
                {campanha.url_esperada && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">URL Esperada:</span>
                    <p className="text-xs mt-1 truncate text-blue-600">{campanha.url_esperada}</p>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={campanha.ativa ? "text-green-600" : "text-red-600"}>
                    {campanha.ativa ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {campanhas.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma campanha cadastrada</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira campanha
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
