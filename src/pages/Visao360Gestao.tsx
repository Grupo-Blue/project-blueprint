import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Crosshair, BarChart3, Settings2, Trophy, Loader2, Save, RefreshCw,
  TrendingUp, TrendingDown, Clock, Target, Activity, AlertCircle, CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { formatCurrency, cn } from "@/lib/utils";

interface ScoreCfg {
  peso_nivel: number;
  peso_prioridade: number;
  bonus_procuracao_30d: number;
  bonus_procuracao_60d: number;
  bonus_aprovacao: number;
  bonus_fidelidade_por_ano: number;
  bonus_fidelidade_max: number;
  penalty_inatividade_por_mes: number;
}

interface GestaoKpis {
  periodo_dias: number;
  total_acoes: number;
  ganhos: number;
  perdidos: number;
  em_aberto: number;
  tempo_medio_dias: number;
  por_fila: Array<{ fila: string; ganhos: number; perdidos: number; abertos: number; taxa: number }>;
  ranking_vendedores: Array<{ vendedor_nome: string; vendedor_id: string; acoes: number; ganhos: number; valor_ganho: number }>;
  serie_temporal: Array<{ dia: string; acoes: number; ganhos: number }>;
}

const FILA_LABEL: Record<string, string> = {
  renovacao: "Renovação",
  upsell: "Upsell",
  resgate: "Resgate",
  winback: "Win-back",
  sem_fila: "Sem fila",
};
const FILA_COLOR: Record<string, string> = {
  renovacao: "bg-emerald-600",
  upsell: "bg-blue-600",
  resgate: "bg-amber-600",
  winback: "bg-purple-600",
  sem_fila: "bg-muted-foreground",
};

const Visao360Gestao = () => {
  const { isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const { isAdmin } = useUserEmpresas();
  const [periodo, setPeriodo] = useState<string>("30");
  const [reproc, setReproc] = useState(false);

  const { data: kpis, isLoading: loadingKpis, refetch: refetchKpis } = useQuery({
    queryKey: ["blue-gestao-kpis", periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_visao360_gestao_kpis", { _dias: Number(periodo) });
      if (error) throw error;
      return data as unknown as GestaoKpis;
    },
  });

  const { data: cfg, isLoading: loadingCfg, refetch: refetchCfg } = useQuery({
    queryKey: ["blue-score-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_score_config_get");
      if (error) throw error;
      return data as unknown as ScoreCfg;
    },
  });

  const [form, setForm] = useState<ScoreCfg | null>(null);
  // sincroniza form quando cfg carrega
  if (cfg && !form) setForm(cfg);

  const [saving, setSaving] = useState(false);
  const salvar = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("blue_score_config_save", {
        _peso_nivel: form.peso_nivel,
        _peso_prioridade: form.peso_prioridade,
        _bonus_procuracao_30d: form.bonus_procuracao_30d,
        _bonus_procuracao_60d: form.bonus_procuracao_60d,
        _bonus_aprovacao: form.bonus_aprovacao,
        _bonus_fidelidade_por_ano: form.bonus_fidelidade_por_ano,
        _bonus_fidelidade_max: form.bonus_fidelidade_max,
        _penalty_inatividade_por_mes: form.penalty_inatividade_por_mes,
      });
      if (error) throw error;
      toast.success("Pesos salvos");
      refetchCfg();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const recalcular = async () => {
    setReproc(true);
    toast.info("Recalculando scores…");
    try {
      const { error } = await supabase.functions.invoke("blue-cliente-360-build", { body: {} });
      if (error) throw error;
      toast.success("Visão 360 recalculada com os novos pesos");
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e));
    } finally {
      setReproc(false);
    }
  };

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  const setF = (k: keyof ScoreCfg, v: string) => {
    if (!form) return;
    setForm({ ...form, [k]: Number(v) || 0 });
  };

  const taxaConv = kpis && (kpis.ganhos + kpis.perdidos) > 0
    ? (kpis.ganhos / (kpis.ganhos + kpis.perdidos) * 100).toFixed(1)
    : "0";

  // Série compacta
  const maxSerie = Math.max(1, ...(kpis?.serie_temporal.map(s => s.acoes) || [1]));

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Gestão da Visão 360 — Blue Consult
          </h1>
          <p className="text-sm text-muted-foreground">KPIs comerciais e configuração do score de priorização</p>
        </div>
      </div>

      <Tabs defaultValue="kpis">
        <TabsList>
          <TabsTrigger value="kpis"><BarChart3 className="h-4 w-4 mr-2" /> KPIs</TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-2" /> Pesos do score</TabsTrigger>
        </TabsList>

        {/* KPIs */}
        <TabsContent value="kpis" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Período:</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetchKpis()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </div>

          {loadingKpis || !kpis ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Total ações</span>
                  </div>
                  <p className="text-2xl font-extrabold">{kpis.total_acoes.toLocaleString("pt-BR")}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Ganhos</span>
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-700">{kpis.ganhos.toLocaleString("pt-BR")}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Perdidos</span>
                  </div>
                  <p className="text-2xl font-extrabold text-rose-700">{kpis.perdidos.toLocaleString("pt-BR")}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Em aberto</span>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-700">{kpis.em_aberto.toLocaleString("pt-BR")}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Trophy className="h-5 w-5 text-indigo-600" />
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Conversão</span>
                  </div>
                  <p className="text-2xl font-extrabold">{taxaConv}%</p>
                  <p className="text-[10px] text-muted-foreground">tempo médio: {kpis.tempo_medio_dias}d</p>
                </GlassCard>
              </div>

              {/* Conversão por fila */}
              <GlassCard className="p-4">
                <h3 className="text-sm font-bold mb-3">Conversão por fila</h3>
                {kpis.por_fila.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma ação registrada no período.</p>
                ) : (
                  <div className="space-y-2">
                    {kpis.por_fila.map(f => (
                      <div key={f.fila} className="grid grid-cols-[120px_1fr_auto] gap-3 items-center">
                        <Badge className={cn("text-[10px] justify-center", FILA_COLOR[f.fila])}>{FILA_LABEL[f.fila]}</Badge>
                        <div className="flex h-6 rounded-md overflow-hidden bg-muted/40">
                          {f.ganhos > 0 && <div className="bg-emerald-500" style={{ width: `${(f.ganhos / Math.max(1, f.ganhos + f.perdidos + f.abertos)) * 100}%` }} title={`${f.ganhos} ganhos`} />}
                          {f.perdidos > 0 && <div className="bg-rose-500" style={{ width: `${(f.perdidos / Math.max(1, f.ganhos + f.perdidos + f.abertos)) * 100}%` }} title={`${f.perdidos} perdidos`} />}
                          {f.abertos > 0 && <div className="bg-amber-500" style={{ width: `${(f.abertos / Math.max(1, f.ganhos + f.perdidos + f.abertos)) * 100}%` }} title={`${f.abertos} em aberto`} />}
                        </div>
                        <div className="text-xs text-right whitespace-nowrap">
                          <span className="text-emerald-700 font-bold">{f.ganhos}G</span> · <span className="text-rose-700 font-bold">{f.perdidos}P</span> · <span className="text-amber-700">{f.abertos}A</span>
                          <span className="ml-2 text-muted-foreground">({f.taxa}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* Série temporal */}
              <GlassCard className="p-4">
                <h3 className="text-sm font-bold mb-3">Atividade diária</h3>
                {kpis.serie_temporal.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {kpis.serie_temporal.map(s => (
                      <div key={s.dia} className="flex-1 flex flex-col items-center gap-1" title={`${s.dia}: ${s.acoes} ações, ${s.ganhos} ganhos`}>
                        <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(s.acoes / maxSerie) * 100}%`, minHeight: 2 }} />
                        {s.ganhos > 0 && (
                          <div className="w-full bg-emerald-500 rounded-b -mt-1" style={{ height: `${(s.ganhos / maxSerie) * 100}%`, minHeight: 2 }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* Ranking */}
              <GlassCard className="p-4">
                <h3 className="text-sm font-bold mb-3">Ranking de vendedores</h3>
                {kpis.ranking_vendedores.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma ação atribuída a vendedores no período.</p>
                ) : (
                  <div className="space-y-2">
                    {kpis.ranking_vendedores.map((v, i) => (
                      <div key={v.vendedor_id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                          i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground")}>
                          {i + 1}
                        </div>
                        <p className="flex-1 text-sm font-medium truncate">{v.vendedor_nome}</p>
                        <div className="text-xs text-right">
                          <p><strong>{v.ganhos}</strong> ganhos · <span className="text-muted-foreground">{v.acoes} ações</span></p>
                          {v.valor_ganho > 0 && <p className="text-emerald-700">{formatCurrency(v.valor_ganho)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </>
          )}
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="mt-4">
          <GlassCard className="p-5">
            {loadingCfg || !form ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <>
                {!isAdmin && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs">
                    Apenas administradores podem alterar os pesos. Você está em modo de leitura.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Peso por nível (×nível do cliente)</Label>
                    <Input type="number" value={form.peso_nivel} onChange={e => setF("peso_nivel", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 100. Multiplica o nível para gerar a base do score.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Peso por prioridade (×rank 1-4)</Label>
                    <Input type="number" value={form.peso_prioridade} onChange={e => setF("peso_prioridade", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 30. Urgente=4, Alta=3, Média=2, Baixa=1.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Bônus procuração ≤ 30 dias</Label>
                    <Input type="number" value={form.bonus_procuracao_30d} onChange={e => setF("bonus_procuracao_30d", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 50. Soma quando vencimento ≤ 30 dias.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Bônus procuração ≤ 60 dias</Label>
                    <Input type="number" value={form.bonus_procuracao_60d} onChange={e => setF("bonus_procuracao_60d", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 25.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Bônus em aprovação</Label>
                    <Input type="number" value={form.bonus_aprovacao} onChange={e => setF("bonus_aprovacao", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 40. Soma quando status 2026 contém "aprovação".</p>
                  </div>
                  <div>
                    <Label className="text-xs">Bônus fidelidade por ano</Label>
                    <Input type="number" value={form.bonus_fidelidade_por_ano} onChange={e => setF("bonus_fidelidade_por_ano", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 5. Multiplica anos finalizados (com cap).</p>
                  </div>
                  <div>
                    <Label className="text-xs">Bônus fidelidade máximo</Label>
                    <Input type="number" value={form.bonus_fidelidade_max} onChange={e => setF("bonus_fidelidade_max", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 25. Teto do bônus de fidelidade.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Penalidade inatividade por mês</Label>
                    <Input type="number" value={form.penalty_inatividade_por_mes} onChange={e => setF("penalty_inatividade_por_mes", e.target.value)} disabled={!isAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">Padrão: 10. Subtrai por mês desde cancelamento.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
                  <Button onClick={salvar} disabled={!isAdmin || saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar pesos
                  </Button>
                  <Button variant="outline" onClick={recalcular} disabled={reproc}>
                    {reproc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Recalcular score de todos os clientes
                  </Button>
                </div>
              </>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </>
  );
};

export default Visao360Gestao;
