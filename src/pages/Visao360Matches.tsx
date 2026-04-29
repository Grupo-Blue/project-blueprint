import { useState, useEffect } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Crosshair, Search, Check, X, ChevronLeft, ChevronRight, Loader2, RefreshCw, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type StatusFiltro = "pendente" | "confirmado" | "rejeitado" | "todos";

interface MatchRow {
  id: string;
  base_origem: string;
  raw_id: string;
  raw_nome: string;
  raw_client_key: string;
  candidato_client_key: string;
  candidato_nome: string;
  similaridade: number;
  status: string;
  resolvido_em: string | null;
  observacao: string | null;
  created_at: string;
}

function useDebounce<T>(value: T, delay = 400): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

const Visao360Matches = () => {
  const { isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const qc = useQueryClient();

  const [status, setStatus] = useState<StatusFiltro>("pendente");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [confirmando, setConfirmando] = useState<{ row: MatchRow; decisao: "confirmar" | "rejeitar" } | null>(null);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const buscaDeb = useDebounce(busca, 400);
  useEffect(() => { setPagina(1); }, [status, buscaDeb]);

  const { data: kpis, refetch: refetchKpis } = useQuery({
    queryKey: ["blue-match-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_match_revisao_kpis");
      if (error) throw error;
      return (data?.[0] || null) as null | { pendentes: number; confirmados: number; rejeitados: number; total: number };
    },
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["blue-match-list", status, buscaDeb, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_match_revisao_listar", {
        _status: status,
        _busca: buscaDeb || null,
        _limite: PAGE_SIZE,
        _offset: (pagina - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as any[];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return { rows: rows as MatchRow[], total };
    },
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const abrirConfirmacao = (row: MatchRow, decisao: "confirmar" | "rejeitar") => {
    setObservacao("");
    setConfirmando({ row, decisao });
  };

  const executar = async () => {
    if (!confirmando) return;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("blue_match_revisao_resolver", {
        _id: confirmando.row.id,
        _decisao: confirmando.decisao,
        _observacao: observacao || null,
      });
      if (error) throw error;
      toast.success(confirmando.decisao === "confirmar" ? "Match confirmado e unificado" : "Match rejeitado");
      setConfirmando(null);
      refetch(); refetchKpis();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setEnviando(false);
    }
  };

  const reprocessar = async () => {
    toast.info("Reprocessando consolidação…");
    try {
      const { error } = await supabase.functions.invoke("blue-cliente-360-build", { body: {} });
      if (error) throw error;
      toast.success("Visão 360 atualizada");
      qc.invalidateQueries({ queryKey: ["blue-v360-list"] });
      qc.invalidateQueries({ queryKey: ["blue-v360-kpis"] });
    } catch (e: any) {
      toast.error("Falha ao reprocessar: " + (e?.message || e));
    }
  };

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  const simPct = (s: number) => `${(s * 100).toFixed(1)}%`;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Revisão de Matches — Visão 360 Blue
          </h1>
          <p className="text-sm text-muted-foreground">
            Pares com similaridade entre 70% e 85% precisam de confirmação humana.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reprocessar}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reprocessar consolidação
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {!kpis ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)
        ) : (
          <>
            <GlassCard className="p-4 text-center">
              <p className="text-2xl font-extrabold text-amber-600">{kpis.pendentes.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Pendentes</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-2xl font-extrabold text-emerald-600">{kpis.confirmados.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Confirmados</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-2xl font-extrabold text-rose-600">{kpis.rejeitados.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Rejeitados</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">{kpis.total.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </GlassCard>
          </>
        )}
      </div>

      {/* Filtros */}
      <GlassCard className="p-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFiltro)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Lista */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-muted rounded-2xl" />)}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Crosshair className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {status === "pendente"
              ? "Nenhum match pendente. Tudo resolvido!"
              : "Nenhum registro encontrado."}
          </p>
        </GlassCard>
      ) : (
        <>
          {isFetching && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
            </div>
          )}
          <div className="space-y-3">
            {data.rows.map(m => {
              const score = m.similaridade;
              const corScore =
                score >= 0.82 ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/30"
                : score >= 0.76 ? "text-amber-700 bg-amber-500/10 border-amber-500/30"
                : "text-rose-700 bg-rose-500/10 border-rose-500/30";
              return (
                <GlassCard key={m.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
                    {/* RAW */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase">{m.base_origem}</Badge>
                        <span className="text-[10px] text-muted-foreground">registro novo</span>
                      </div>
                      <p className="font-bold text-foreground truncate">{m.raw_nome}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{m.raw_client_key}</p>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center gap-1">
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", corScore)}>
                        {simPct(score)}
                      </span>
                    </div>

                    {/* CANDIDATO */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px] uppercase">existente</Badge>
                        <span className="text-[10px] text-muted-foreground">cliente já consolidado</span>
                      </div>
                      <p className="font-bold text-foreground truncate">{m.candidato_nome}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{m.candidato_client_key}</p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 justify-end">
                      {m.status === "pendente" ? (
                        <>
                          <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-700 hover:bg-rose-500/10"
                            onClick={() => abrirConfirmacao(m, "rejeitar")}>
                            <X className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => abrirConfirmacao(m, "confirmar")}>
                            <Check className="h-4 w-4 mr-1" /> Confirmar
                          </Button>
                        </>
                      ) : (
                        <Badge className={cn("text-[10px]",
                          m.status === "confirmado" ? "bg-emerald-600" : "bg-rose-600"
                        )}>
                          {m.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {m.observacao && (
                    <p className="text-xs text-muted-foreground mt-2 italic border-t border-border/50 pt-2">
                      "{m.observacao}"
                    </p>
                  )}
                </GlassCard>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-5">
            <p className="text-xs text-muted-foreground">
              Página {pagina} de {totalPaginas} · {data.total.toLocaleString("pt-BR")} registros
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Confirmação */}
      <AlertDialog open={!!confirmando} onOpenChange={(o) => !o && !enviando && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando?.decisao === "confirmar" ? "Confirmar vínculo?" : "Rejeitar vínculo?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {confirmando?.decisao === "confirmar"
                    ? "Os dois registros abaixo serão tratados como o mesmo cliente. O registro novo será unificado ao cliente existente."
                    : "Os dois registros abaixo permanecerão separados. Nenhuma unificação será feita."}
                </p>
                {confirmando && (
                  <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/30">
                    <p className="text-xs"><strong>Novo ({confirmando.row.base_origem}):</strong> {confirmando.row.raw_nome}</p>
                    <p className="text-xs"><strong>Existente:</strong> {confirmando.row.candidato_nome}</p>
                    <p className="text-xs text-muted-foreground">Similaridade: {simPct(confirmando.row.similaridade)}</p>
                  </div>
                )}
                <Textarea
                  placeholder="Observação (opcional)…"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); executar(); }}
              disabled={enviando}
              className={confirmando?.decisao === "confirmar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {confirmando?.decisao === "confirmar" ? "Confirmar" : "Rejeitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Visao360Matches;
