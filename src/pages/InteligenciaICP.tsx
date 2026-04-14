import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Brain, Plus, Sparkles, Target, Trash2, Edit, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

const CAMPOS_ICP = [
  { campo: "irpf_renda_anual", label: "Renda Anual IRPF", categoria: "renda", tipo: "range" },
  { campo: "irpf_patrimonio_total", label: "Patrimônio Total", categoria: "patrimonio", tipo: "range" },
  { campo: "irpf_valor_investimentos", label: "Investimentos Financeiros", categoria: "investidor", tipo: "range" },
  { campo: "irpf_valor_cripto", label: "Valor em Cripto", categoria: "investidor", tipo: "range" },
  { campo: "irpf_possui_empresas", label: "Possui Empresas", categoria: "renda", tipo: "boolean" },
  { campo: "irpf_possui_cripto", label: "Possui Cripto", categoria: "investidor", tipo: "boolean" },
  { campo: "irpf_complexidade_declaracao", label: "Complexidade Declaração", categoria: "renda", tipo: "select", opcoes: ["baixa", "media", "alta"] },
  { campo: "tokeniza_investidor", label: "Investidor Tokeniza", categoria: "investidor", tipo: "boolean" },
  { campo: "tokeniza_qtd_investimentos", label: "Qtd Investimentos Tokeniza", categoria: "investidor", tipo: "range" },
  { campo: "tokeniza_valor_investido", label: "Valor Investido Tokeniza", categoria: "investidor", tipo: "range" },
];

const CATEGORIAS_PESO = [
  { key: "renda", label: "Faixa de Renda" },
  { key: "patrimonio", label: "Patrimônio/Bens" },
  { key: "investidor", label: "Perfil Investidor" },
  { key: "comportamento", label: "Comportamento Digital" },
  { key: "linkedin", label: "LinkedIn/Cargo" },
  { key: "utm", label: "UTM/Origem" },
  { key: "amelia", label: "Amélia ICP" },
];

interface Criterio {
  campo: string;
  operador: string;
  valor: any;
  categoria: string;
}

const InteligenciaICP = () => {
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingIcp, setEditingIcp] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [pesos, setPesos] = useState<Record<string, number>>({
    renda: 25, patrimonio: 20, investidor: 15, comportamento: 15, linkedin: 10, utm: 10, amelia: 5,
  });

  const empresaId = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: icps, isLoading } = useQuery({
    queryKey: ["icp-perfis", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("icp_perfil")
        .select("*")
        .eq("id_empresa", empresaId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: matchCounts } = useQuery({
    queryKey: ["icp-match-counts", empresaId],
    queryFn: async () => {
      if (!icps || icps.length === 0) return {};
      const counts: Record<string, { total: number; high: number }> = {};
      for (const icp of icps) {
        const { count: total } = await supabase
          .from("icp_match")
          .select("*", { count: "exact", head: true })
          .eq("id_icp", icp.id);
        const { count: high } = await supabase
          .from("icp_match")
          .select("*", { count: "exact", head: true })
          .eq("id_icp", icp.id)
          .gte("score_match", 70);
        counts[icp.id] = { total: total || 0, high: high || 0 };
      }
      return counts;
    },
    enabled: !!icps && icps.length > 0,
  });

  const salvarIcp = useMutation({
    mutationFn: async () => {
      if (!empresaId || !nome) throw new Error("Preencha o nome do ICP");
      const regras = { criterios, pesos };
      if (editingIcp) {
        const { error } = await supabase
          .from("icp_perfil")
          .update({ nome, descricao, regras })
          .eq("id", editingIcp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("icp_perfil")
          .insert({ id_empresa: empresaId, nome, descricao, regras });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["icp-perfis"] });
      resetForm();
      toast.success(editingIcp ? "ICP atualizado!" : "ICP criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletarIcp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("icp_perfil").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["icp-perfis"] });
      toast.success("ICP removido");
    },
    onError: (e) => toast.error(e.message),
  });

  const calcularMatches = useMutation({
    mutationFn: async (idIcp?: string) => {
      const { data, error } = await supabase.functions.invoke("calcular-icp-match", {
        body: idIcp ? { id_icp: idIcp } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["icp-match-counts"] });
      toast.success(`Matches calculados: ${data?.total_matches || 0} leads avaliados`);
    },
    onError: (e) => toast.error(e.message),
  });

  const gerarICPAuto = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa");
      // Fetch leads with sales to generate ICP profile
      const { data: leadsVenda, error } = await supabase
        .from("lead")
        .select("irpf_renda_anual, irpf_patrimonio_total, irpf_valor_investimentos, irpf_possui_empresas, irpf_possui_cripto, tokeniza_investidor, tokeniza_qtd_investimentos, tokeniza_valor_investido, irpf_complexidade_declaracao")
        .eq("id_empresa", empresaId)
        .eq("venda_realizada", true)
        .limit(1000);
      if (error) throw error;
      if (!leadsVenda || leadsVenda.length === 0) throw new Error("Nenhum lead com venda encontrado");

      // Calculate medians
      const getMedian = (vals: number[]) => {
        const sorted = vals.filter(v => v != null).sort((a, b) => a - b);
        if (sorted.length === 0) return 0;
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      const rendas = leadsVenda.map(l => l.irpf_renda_anual).filter(Boolean) as number[];
      const patrimonios = leadsVenda.map(l => l.irpf_patrimonio_total).filter(Boolean) as number[];
      const investimentos = leadsVenda.map(l => l.irpf_valor_investimentos).filter(Boolean) as number[];
      const possuiEmpresa = leadsVenda.filter(l => l.irpf_possui_empresas === true).length;
      const possuiCripto = leadsVenda.filter(l => l.irpf_possui_cripto === true).length;

      const autoCriterios: Criterio[] = [];

      if (rendas.length > 5) {
        autoCriterios.push({ campo: "irpf_renda_anual", operador: "gte", valor: Math.round(getMedian(rendas) * 0.7), categoria: "renda" });
      }
      if (patrimonios.length > 5) {
        autoCriterios.push({ campo: "irpf_patrimonio_total", operador: "gte", valor: Math.round(getMedian(patrimonios) * 0.6), categoria: "patrimonio" });
      }
      if (investimentos.length > 5) {
        autoCriterios.push({ campo: "irpf_valor_investimentos", operador: "gte", valor: Math.round(getMedian(investimentos) * 0.5), categoria: "investidor" });
      }
      if (possuiEmpresa / leadsVenda.length > 0.4) {
        autoCriterios.push({ campo: "irpf_possui_empresas", operador: "is_true", valor: true, categoria: "renda" });
      }
      if (possuiCripto / leadsVenda.length > 0.3) {
        autoCriterios.push({ campo: "irpf_possui_cripto", operador: "is_true", valor: true, categoria: "investidor" });
      }

      return { criterios: autoCriterios, stats: { total: leadsVenda.length, rendas: rendas.length, patrimonios: patrimonios.length } };
    },
    onSuccess: (data) => {
      setCriterios(data.criterios);
      setNome("ICP Auto-gerado");
      setDescricao(`Gerado a partir de ${data.stats.total} leads com venda`);
      setShowCreate(true);
      toast.success(`Perfil gerado com ${data.criterios.length} critérios a partir de ${data.stats.total} vendas`);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setShowCreate(false);
    setEditingIcp(null);
    setNome("");
    setDescricao("");
    setCriterios([]);
    setPesos({ renda: 25, patrimonio: 20, investidor: 15, comportamento: 15, linkedin: 10, utm: 10, amelia: 5 });
  };

  const editIcp = (icp: any) => {
    setEditingIcp(icp);
    setNome(icp.nome);
    setDescricao(icp.descricao || "");
    const regras = icp.regras as any;
    setCriterios(regras?.criterios || []);
    setPesos(regras?.pesos || { renda: 25, patrimonio: 20, investidor: 15, comportamento: 15, linkedin: 10, utm: 10, amelia: 5 });
    setShowCreate(true);
  };

  const addCriterio = () => {
    setCriterios([...criterios, { campo: CAMPOS_ICP[0].campo, operador: "gte", valor: 0, categoria: CAMPOS_ICP[0].categoria }]);
  };

  const updateCriterio = (idx: number, updates: Partial<Criterio>) => {
    const novo = [...criterios];
    novo[idx] = { ...novo[idx], ...updates };
    if (updates.campo) {
      const def = CAMPOS_ICP.find(c => c.campo === updates.campo);
      if (def) novo[idx].categoria = def.categoria;
    }
    setCriterios(novo);
  };

  const removeCriterio = (idx: number) => {
    setCriterios(criterios.filter((_, i) => i !== idx));
  };

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Motor de Perfis ICP
          </h2>
          <p className="text-sm text-muted-foreground">Defina o perfil ideal de cliente com base nos dados reais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gerarICPAuto.mutate()} disabled={gerarICPAuto.isPending}>
            <Sparkles className={`h-4 w-4 mr-1 ${gerarICPAuto.isPending ? "animate-spin" : ""}`} />
            Gerar ICP Automático
          </Button>
          <Button variant="outline" size="sm" onClick={() => calcularMatches.mutate()} disabled={calcularMatches.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${calcularMatches.isPending ? "animate-spin" : ""}`} />
            Calcular Matches
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo ICP
          </Button>
        </div>
      </div>

      {!empresaId && (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">Selecione uma empresa para gerenciar os perfis ICP.</p>
        </GlassCard>
      )}

      {empresaId && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)
          ) : (
            (icps || []).map(icp => {
              const regras = icp.regras as any;
              const counts = matchCounts?.[icp.id];
              return (
                <GlassCard key={icp.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-foreground">{icp.nome}</h3>
                        {icp.auto_gerado && <Badge variant="secondary" className="text-[10px]">Auto</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{icp.descricao}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editIcp(icp)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletarIcp.mutate(icp.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(regras?.criterios || []).length} critérios</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {counts?.total || 0} matches
                      </span>
                      {counts?.high ? (
                        <>
                          <span>•</span>
                          <Badge variant="default" className="text-[10px] px-1">{counts.high} score ≥70</Badge>
                        </>
                      ) : null}
                    </div>

                    {(regras?.criterios || []).slice(0, 3).map((c: any, i: number) => {
                      const def = CAMPOS_ICP.find(d => d.campo === c.campo);
                      return (
                        <Badge key={i} variant="outline" className="text-[10px] mr-1">
                          {def?.label || c.campo} {c.operador} {Array.isArray(c.valor) ? c.valor.join("-") : String(c.valor)}
                        </Badge>
                      );
                    })}
                    {(regras?.criterios || []).length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">+{(regras?.criterios || []).length - 3} mais</Badge>
                    )}
                  </div>

                  <div className="mt-3 flex gap-1">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => calcularMatches.mutate(icp.id)} disabled={calcularMatches.isPending}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Recalcular
                    </Button>
                  </div>
                </GlassCard>
              );
            })
          )}
          {!isLoading && (!icps || icps.length === 0) && (
            <GlassCard className="p-8 text-center col-span-full">
              <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum ICP definido.</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Gerar ICP Automático" para criar com base nos dados reais de vendas.</p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetForm(); else setShowCreate(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIcp ? "Editar ICP" : "Novo Perfil ICP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Blue Premium" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Perfil do cliente ideal..." />
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">Critérios de Match</Label>
                <Button variant="outline" size="sm" onClick={addCriterio}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {criterios.map((c, idx) => {
                  const def = CAMPOS_ICP.find(d => d.campo === c.campo);
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Select value={c.campo} onValueChange={v => updateCriterio(idx, { campo: v })}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPOS_ICP.map(campo => (
                            <SelectItem key={campo.campo} value={campo.campo}>{campo.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={c.operador} onValueChange={v => updateCriterio(idx, { operador: v })}>
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gte">≥</SelectItem>
                          <SelectItem value="lte">≤</SelectItem>
                          <SelectItem value="eq">=</SelectItem>
                          <SelectItem value="is_true">Sim</SelectItem>
                          <SelectItem value="is_false">Não</SelectItem>
                          <SelectItem value="contains">Contém</SelectItem>
                        </SelectContent>
                      </Select>
                      {!["is_true", "is_false"].includes(c.operador) && (
                        <Input
                          className="w-[120px] h-8 text-xs"
                          value={c.valor}
                          onChange={e => updateCriterio(idx, { valor: e.target.value })}
                          placeholder="Valor"
                        />
                      )}
                      <Badge variant="outline" className="text-[10px] shrink-0">{c.categoria}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCriterio(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="font-semibold mb-2 block">Pesos por Categoria (%)</Label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIAS_PESO.map(cat => (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">{cat.label}</span>
                    <Slider
                      value={[pesos[cat.key] || 0]}
                      onValueChange={([v]) => setPesos({ ...pesos, [cat.key]: v })}
                      min={0} max={50} step={5}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{pesos[cat.key]}%</span>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => salvarIcp.mutate()} disabled={salvarIcp.isPending} className="w-full">
              {editingIcp ? "Salvar Alterações" : "Criar ICP"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InteligenciaICP;
