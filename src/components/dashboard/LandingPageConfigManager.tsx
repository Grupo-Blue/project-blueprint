import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface LandingPageConfigManagerProps {
  idEmpresa: string;
}

interface PageConfig {
  id: string;
  url_pattern: string;
  categoria: string;
  ignorar_conversao: boolean;
  evento_conversao: string | null;
  descricao: string | null;
}

const CATEGORIAS = [
  { value: "landing_page", label: "Landing Page", color: "bg-green-500" },
  { value: "oferta", label: "Oferta/Produto", color: "bg-blue-500" },
  { value: "sistema", label: "Sistema", color: "bg-gray-500" },
  { value: "conteudo", label: "Conteúdo", color: "bg-purple-500" },
];

export function LandingPageConfigManager({ idEmpresa }: LandingPageConfigManagerProps) {
  const queryClient = useQueryClient();
  const [newPattern, setNewPattern] = useState("");
  const [newCategoria, setNewCategoria] = useState("landing_page");
  const [newDescricao, setNewDescricao] = useState("");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["landingpage-config", idEmpresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landingpage_config")
        .select("*")
        .eq("id_empresa", idEmpresa)
        .order("categoria", { ascending: true });

      if (error) throw error;
      return data as PageConfig[];
    },
  });

  const addConfigMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("landingpage_config").insert({
        id_empresa: idEmpresa,
        url_pattern: newPattern,
        categoria: newCategoria,
        ignorar_conversao: newCategoria === "sistema",
        descricao: newDescricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landingpage-config", idEmpresa] });
      setNewPattern("");
      setNewDescricao("");
      toast.success("Configuração adicionada");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PageConfig> }) => {
      const { error } = await supabase
        .from("landingpage_config")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landingpage-config", idEmpresa] });
      toast.success("Configuração atualizada");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landingpage_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landingpage-config", idEmpresa] });
      toast.success("Configuração removida");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const getCategoriaInfo = (categoria: string) => {
    return CATEGORIAS.find((c) => c.value === categoria) || CATEGORIAS[0];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configuração de Páginas
        </CardTitle>
        <CardDescription>
          Configure como cada tipo de página deve ser tratado na análise de conversão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário para adicionar */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Padrão de URL (ex: /account/*)"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={newCategoria} onValueChange={setNewCategoria}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Descrição (opcional)"
            value={newDescricao}
            onChange={(e) => setNewDescricao(e.target.value)}
            className="flex-1 min-w-[150px]"
          />
          <Button
            onClick={() => addConfigMutation.mutate()}
            disabled={!newPattern || addConfigMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* Tabela de configurações */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrão URL</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">Ignorar</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : configs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma configuração cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                configs?.map((config) => {
                  const catInfo = getCategoriaInfo(config.categoria);
                  return (
                    <TableRow key={config.id}>
                      <TableCell className="font-mono text-sm">{config.url_pattern}</TableCell>
                      <TableCell>
                        <Select
                          value={config.categoria}
                          onValueChange={(value) =>
                            updateConfigMutation.mutate({
                              id: config.id,
                              updates: { categoria: value, ignorar_conversao: value === "sistema" },
                            })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              <Badge variant="secondary" className={`${catInfo.color} text-white`}>
                                {catInfo.label}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {config.descricao || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={config.ignorar_conversao}
                          onCheckedChange={(checked) =>
                            updateConfigMutation.mutate({
                              id: config.id,
                              updates: { ignorar_conversao: checked },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteConfigMutation.mutate(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
          <span><Badge className="bg-green-500 text-white mr-1">LP</Badge> Análise de conversão normal</span>
          <span><Badge className="bg-blue-500 text-white mr-1">Oferta</Badge> Conversão = investimento real</span>
          <span><Badge className="bg-gray-500 text-white mr-1">Sistema</Badge> Ignorado na análise</span>
          <span><Badge className="bg-purple-500 text-white mr-1">Conteúdo</Badge> Apenas engajamento</span>
        </div>
      </CardContent>
    </Card>
  );
}
