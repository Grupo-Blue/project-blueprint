import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Crosshair, Users, TrendingUp, Target, RefreshCw, Send, Download, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const CAMPO_LABELS: Record<string, string> = {
  irpf_renda_anual: "Renda Anual",
  irpf_patrimonio_total: "Patrimônio",
  irpf_valor_investimentos: "Investimentos",
  irpf_possui_empresas: "Possui Empresas",
  irpf_possui_cripto: "Possui Cripto",
  irpf_valor_cripto: "Valor Cripto",
  tokeniza_investidor: "Investidor Tokeniza",
  tokeniza_qtd_investimentos: "Qtd Invest. Tokeniza",
  tokeniza_valor_investido: "Valor Tokeniza",
  mautic_score_alto: "Score Mautic Alto",
  mautic_engajado: "Engajado Mautic",
  linkedin_senioridade: "Senioridade LinkedIn",
  amelia_icp: "ICP Amélia",
};

const InteligenciaMatch = () => {
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const queryClient = useQueryClient();
  const [selectedIcp, setSelectedIcp] = useState<string>("");
  const [minScore, setMinScore] = useState(30);

  const empresaId = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: icps } = useQuery({
    queryKey: ["icp-perfis", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase.from("icp_perfil").select("*").eq("id_empresa", empresaId).order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ["icp-matches", selectedIcp, minScore],
    queryFn: async () => {
      if (!selectedIcp) return [];
      const { data, error } = await supabase
        .from("icp_match")
        .select(`
          id, score_match, campos_match, campos_faltantes, calculated_at,
          lead:id_lead (id_lead, nome_lead, email, telefone, stage_atual, origem_canal, irpf_renda_anual, tokeniza_investidor, venda_realizada)
        `)
        .eq("id_icp", selectedIcp)
        .gte("score_match", minScore)
        .order("score_match", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedIcp,
  });

  const { data: kpis } = useQuery({
    queryKey: ["icp-match-kpis", selectedIcp],
    queryFn: async () => {
      if (!selectedIcp) return null;
      const { count: total } = await supabase.from("icp_match").select("*", { count: "exact", head: true }).eq("id_icp", selectedIcp);
      const { count: high } = await supabase.from("icp_match").select("*", { count: "exact", head: true }).eq("id_icp", selectedIcp).gte("score_match", 80);
      const { count: medium } = await supabase.from("icp_match").select("*", { count: "exact", head: true }).eq("id_icp", selectedIcp).gte("score_match", 50).lt("score_match", 80);
      return { total: total || 0, high: high || 0, medium: medium || 0 };
    },
    enabled: !!selectedIcp,
  });

  const recalcular = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calcular-icp-match", {
        body: selectedIcp ? { id_icp: selectedIcp } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["icp-matches"] });
      queryClient.invalidateQueries({ queryKey: ["icp-match-kpis"] });
      toast.success(`${data?.total_matches || 0} matches calculados`);
    },
    onError: (e) => toast.error(e.message),
  });

  const exportCSV = async () => {
    if (!matches || matches.length === 0) return;
    const rows = matches.map((m: any) => ({
      nome: m.lead?.nome_lead || "",
      email: m.lead?.email || "",
      telefone: m.lead?.telefone || "",
      score: m.score_match,
      stage: m.lead?.stage_atual || "",
      canal: m.lead?.origem_canal || "",
      campos_match: (m.campos_match || []).join("; "),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${(r as any)[h] || ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-icp-${selectedIcp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  const selectedIcpObj = icps?.find(i => i.id === selectedIcp);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Match de Leads
          </h2>
          <p className="text-sm text-muted-foreground">Leads ranqueados por compatibilidade com perfis ICP</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalcular.isPending ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!matches || matches.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 mb-5">
        <div className="flex-1 max-w-xs">
          <label className="text-xs text-muted-foreground mb-1 block">Perfil ICP</label>
          <Select value={selectedIcp} onValueChange={setSelectedIcp}>
            <SelectTrigger><SelectValue placeholder="Selecionar ICP" /></SelectTrigger>
            <SelectContent>
              {(icps || []).map(icp => (
                <SelectItem key={icp.id} value={icp.id}>{icp.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground mb-1 block">Score mínimo: {minScore}</label>
          <Slider value={[minScore]} onValueChange={([v]) => setMinScore(v)} min={0} max={90} step={10} />
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">Total de Matches</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{kpis.high}</p>
            <p className="text-xs text-muted-foreground">Score ≥ 80</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{kpis.medium}</p>
            <p className="text-xs text-muted-foreground">Score 50-79</p>
          </GlassCard>
        </div>
      )}

      {/* Results */}
      {!selectedIcp ? (
        <GlassCard className="p-8 text-center">
          <Crosshair className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Selecione um perfil ICP para ver os leads compatíveis.</p>
        </GlassCard>
      ) : loadingMatches ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedIcpObj?.nome} — {matches?.length || 0} resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Score</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Campos Match</TableHead>
                  <TableHead>Faltantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches || []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={m.score_match} className="w-12 h-2" />
                        <span className={`text-xs font-bold ${m.score_match >= 80 ? "text-green-600" : m.score_match >= 50 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {m.score_match}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{m.lead?.nome_lead || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.lead?.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{m.lead?.stage_atual || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m.campos_match || []).slice(0, 3).map((c: string, i: number) => (
                          <Badge key={i} variant="default" className="text-[9px] px-1">
                            {CAMPO_LABELS[c] || c}
                          </Badge>
                        ))}
                        {(m.campos_match || []).length > 3 && (
                          <Badge variant="secondary" className="text-[9px]">+{(m.campos_match || []).length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m.campos_faltantes || []).slice(0, 2).map((c: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px] px-1 text-amber-600 border-amber-300">
                            {CAMPO_LABELS[c] || c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!matches || matches.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum match encontrado. Clique em "Recalcular" para gerar os scores.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default InteligenciaMatch;
