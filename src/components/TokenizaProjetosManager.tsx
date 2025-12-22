import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Check, AlertCircle, Save, RefreshCw, Search, Copy } from "lucide-react";

interface ProjetoComContagem {
  project_id: string;
  nome: string | null;
  investimentos_count: number;
}

export function TokenizaProjetosManager() {
  const queryClient = useQueryClient();
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [isUpdatingLeads, setIsUpdatingLeads] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar projetos cadastrados
  const { data: projetosCadastrados } = useQuery({
    queryKey: ["tokeniza-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokeniza_projeto")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar project_ids únicos dos investimentos com contagem
  const { data: projectIdsComContagem, isLoading } = useQuery({
    queryKey: ["tokeniza-project-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokeniza_investimento")
        .select("project_id");
      
      if (error) throw error;
      
      // Contar por project_id
      const contagem: Record<string, number> = {};
      data?.forEach(inv => {
        if (inv.project_id) {
          contagem[inv.project_id] = (contagem[inv.project_id] || 0) + 1;
        }
      });
      
      return contagem;
    },
  });

  // Combinar dados
  const projetosConsolidados: ProjetoComContagem[] = projectIdsComContagem
    ? Object.entries(projectIdsComContagem)
        .map(([project_id, count]) => {
          const cadastrado = projetosCadastrados?.find(p => p.project_id === project_id);
          return {
            project_id,
            nome: cadastrado?.nome || null,
            investimentos_count: count,
          };
        })
        .sort((a, b) => {
          // Sem nome primeiro, depois por contagem
          if (a.nome && !b.nome) return 1;
          if (!a.nome && b.nome) return -1;
          return b.investimentos_count - a.investimentos_count;
        })
    : [];

  // Filtrar projetos pela busca
  const projetosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return projetosConsolidados;
    
    const termo = searchTerm.toLowerCase().trim();
    return projetosConsolidados.filter(projeto => 
      projeto.project_id.toLowerCase().includes(termo) ||
      (projeto.nome && projeto.nome.toLowerCase().includes(termo))
    );
  }, [projetosConsolidados, searchTerm]);

  // Mutation para salvar nome
  const saveMutation = useMutation({
    mutationFn: async ({ project_id, nome }: { project_id: string; nome: string }) => {
      const existente = projetosCadastrados?.find(p => p.project_id === project_id);
      
      if (existente) {
        const { error } = await supabase
          .from("tokeniza_projeto")
          .update({ nome })
          .eq("project_id", project_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tokeniza_projeto")
          .insert({ project_id, nome });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokeniza-projetos"] });
      toast.success("Nome do projeto salvo!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  const handleSave = (project_id: string) => {
    const nome = editingNames[project_id]?.trim();
    if (!nome) {
      toast.error("Digite um nome para o projeto");
      return;
    }
    saveMutation.mutate({ project_id, nome });
    setEditingNames(prev => {
      const newState = { ...prev };
      delete newState[project_id];
      return newState;
    });
  };

  // Atualizar leads existentes com nomes
  const handleUpdateLeads = async () => {
    if (!projetosCadastrados || projetosCadastrados.length === 0) {
      toast.error("Cadastre nomes de projetos primeiro");
      return;
    }

    setIsUpdatingLeads(true);
    try {
      // Para cada projeto cadastrado, atualizar leads correspondentes
      let atualizados = 0;
      
      for (const projeto of projetosCadastrados) {
        // Buscar investimentos com este project_id
        const { data: investimentos } = await supabase
          .from("tokeniza_investimento")
          .select("id_externo")
          .eq("project_id", projeto.project_id);
        
        if (investimentos && investimentos.length > 0) {
          const idsExternos = investimentos.map(inv => `tokeniza_inv_${inv.id_externo}`);
          
          // Atualizar leads em batches
          const batchSize = 100;
          for (let i = 0; i < idsExternos.length; i += batchSize) {
            const batch = idsExternos.slice(i, i + batchSize);
            const { error } = await supabase
              .from("lead")
              .update({ tokeniza_projeto_nome: projeto.nome })
              .in("id_lead_externo", batch);
            
            if (!error) {
              atualizados += batch.length;
            }
          }
        }
      }

      toast.success(`${atualizados} leads atualizados com nomes de projetos!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      toast.error("Erro ao atualizar leads: " + error.message);
    } finally {
      setIsUpdatingLeads(false);
    }
  };

  const semNome = projetosConsolidados.filter(p => !p.nome).length;
  const comNome = projetosConsolidados.filter(p => p.nome).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando projetos...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Projetos Tokeniza (Crowdfundings)
            </CardTitle>
            <CardDescription>
              Cadastre os nomes dos projetos/crowdfundings para exibir nos leads
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3 text-green-600" /> {comNome} cadastrados
            </Badge>
            {semNome > 0 && (
              <Badge variant="outline" className="gap-1 text-yellow-600">
                <AlertCircle className="h-3 w-3" /> {semNome} sem nome
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {projetosConsolidados.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhum project_id encontrado nos investimentos. Execute a sincronização Tokeniza primeiro.
          </p>
        ) : (
          <>
            {/* Campo de busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Project ID ou Nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {projetosFiltrados.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum projeto encontrado para "{searchTerm}"
              </p>
            ) : (
              <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project ID</TableHead>
                    <TableHead>Nome do Crowdfunding</TableHead>
                    <TableHead className="text-center">Investimentos</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projetosFiltrados.map((projeto) => (
                    <TableRow key={projeto.project_id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          <span title={projeto.project_id}>{projeto.project_id.substring(0, 8)}...</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(projeto.project_id);
                              toast.success("Project ID copiado!");
                            }}
                            title="Copiar Project ID completo"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Nome do crowdfunding..."
                          value={editingNames[projeto.project_id] ?? projeto.nome ?? ""}
                          onChange={(e) => setEditingNames(prev => ({
                            ...prev,
                            [projeto.project_id]: e.target.value
                          }))}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {projeto.investimentos_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {projeto.nome ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> Cadastrado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            <AlertCircle className="h-3 w-3 mr-1" /> Sem nome
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(projeto.project_id)}
                          disabled={saveMutation.isPending || !editingNames[projeto.project_id]}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleUpdateLeads}
                disabled={isUpdatingLeads || comNome === 0}
                variant="secondary"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isUpdatingLeads ? 'animate-spin' : ''}`} />
                {isUpdatingLeads ? 'Atualizando...' : 'Atualizar Leads Existentes'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
