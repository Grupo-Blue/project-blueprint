import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Crosshair, Search, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  TrendingUp, RotateCcw, ArrowUpRight, AlertTriangle, MessageCircle,
  CalendarClock, Award, User, Mail, MapPin, ShieldAlert,
  Target, Sparkles, MailX, PhoneOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClienteAcoesPanel } from "@/components/visao360/ClienteAcoesPanel";

const BLUE_EMPRESA_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";
const PAGE_SIZE = 20;

type Fila = "todas" | "renovacao" | "upsell" | "resgate" | "winback";
type Ordenacao = "score" | "nivel" | "procuracao" | "nome";

interface Cliente {
  id: string;
  client_key: string;
  nome_canonico: string;
  cpf_cnpj: string | null;
  contato_email: string | null;
  contato_whatsapp: string | null;
  uf: string | null;
  perfil_psicografico: string[] | null;
  cliente_ativo: boolean | null;
  vencimento_procuracao: string | null;
  nivel: number | null;
  prioridade: string | null;
  responsavel_cs: string | null;
  historico_anos: Record<string, string> | null;
  anos_finalizados: number | null;
  anos_pendentes: number | null;
  status_2026: string | null;
  ir_geral_2026: string | null;
  apuracao_b3_2026: string | null;
  fase_macro: string | null;
  gatilho_principal: string | null;
  oportunidades: Array<{ tipo: string; descricao: string }> | null;
  filas: string[] | null;
  score_priorizacao: number | null;
}

const FILA_META: Record<Exclude<Fila, "todas">, { label: string; icon: any; color: string; }> = {
  renovacao: { label: "Renovação", icon: RotateCcw, color: "text-emerald-600" },
  upsell: { label: "Upsell", icon: ArrowUpRight, color: "text-blue-600" },
  resgate: { label: "Resgate", icon: AlertTriangle, color: "text-amber-600" },
  winback: { label: "Win-back", icon: TrendingUp, color: "text-purple-600" },
};

function useDebounce<T>(value: T, delay = 400): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function formatDate(d: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function YearPill({ ano, status }: { ano: string; status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s.includes("final") || s.includes("entreg") || s.includes("ok")
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
      : s.includes("aprov")
      ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
      : s.includes("pend") || s.includes("aberto") || s.includes("falta")
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
      : s.includes("recusa") || s.includes("cancel") || s.includes("perd")
      ? "bg-red-500/15 text-red-700 border-red-500/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", cls)}
      title={status}>
      <strong>{ano}</strong> · <span className="truncate max-w-[110px]">{status}</span>
    </span>
  );
}

const Visao360Comercial = () => {
  const { isLoading: loadingEmpresas, hasAccess } = useEmpresa();

  // Filtros
  const [fila, setFila] = useState<Fila>("todas");
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState<string>("todas");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [perfil, setPerfil] = useState<string>("todos");
  const [nivelMin, setNivelMin] = useState<string>("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("score");
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<Cliente | null>(null);

  const buscaDeb = useDebounce(busca, 400);
  const nivelDeb = useDebounce(nivelMin, 500);

  useEffect(() => { setPagina(1); }, [fila, buscaDeb, uf, responsavel, perfil, nivelDeb, ordenacao]);

  // Facetas
  const { data: facetas } = useQuery({
    queryKey: ["blue-v360-facetas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_visao360_facetas");
      if (error) throw error;
      return (data?.[0] || { ufs: [], responsaveis: [], perfis: [], niveis: [] }) as {
        ufs: string[]; responsaveis: string[]; perfis: string[]; niveis: number[];
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  // KPIs
  const { data: kpis, isLoading: loadingKpis, refetch: refetchKpis } = useQuery({
    queryKey: ["blue-v360-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_visao360_kpis");
      if (error) throw error;
      return (data?.[0] || null) as null | {
        total: number; ativos: number; inativos: number;
        renovacao: number; upsell: number; resgate: number; winback: number;
        em_aprovacao: number; procuracao_60d: number;
      };
    },
  });

  // Lista
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["blue-v360-list", fila, buscaDeb, uf, responsavel, perfil, nivelDeb, ordenacao, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_visao360_listar", {
        _fila: fila === "todas" ? null : fila,
        _busca: buscaDeb || null,
        _uf: uf === "todas" ? null : uf,
        _responsavel: responsavel === "todos" ? null : responsavel,
        _nivel_min: nivelDeb ? Number(nivelDeb) : null,
        _nivel_max: null,
        _perfil: perfil === "todos" ? null : perfil,
        _ordenacao: ordenacao,
        _limite: PAGE_SIZE,
        _offset: (pagina - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as any[];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return { rows: rows as Cliente[], total };
    },
  });

  // Sync manual
  const sincronizar = async () => {
    toast.info("Sincronizando com o Notion…");
    try {
      const { error } = await supabase.functions.invoke("notion-blue-sync", { body: {} });
      if (error) throw error;
      toast.success("Sincronização concluída");
      refetchKpis(); refetch();
    } catch (e: any) {
      toast.error("Falha na sincronização: " + (e?.message || e));
    }
  };

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Visão 360 Comercial — Blue Consult
          </h1>
          <p className="text-sm text-muted-foreground">
            {kpis ? `${kpis.total.toLocaleString("pt-BR")} clientes consolidados · ${kpis.ativos} ativos` : "Carregando…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={sincronizar}>
          <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Notion
        </Button>
      </div>

      {/* KPIs / filas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        {loadingKpis || !kpis ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)
        ) : (
          <>
            {(["renovacao", "upsell", "resgate", "winback"] as const).map(k => {
              const meta = FILA_META[k];
              const Icon = meta.icon;
              const ativo = fila === k;
              return (
                <button
                  key={k}
                  onClick={() => setFila(ativo ? "todas" : k)}
                  className={cn(
                    "text-left transition-all rounded-2xl",
                    ativo && "ring-2 ring-primary"
                  )}
                >
                  <GlassCard className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={cn("h-5 w-5", meta.color)} />
                      <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{meta.label}</span>
                    </div>
                    <p className="text-2xl font-extrabold text-foreground">{kpis[k].toLocaleString("pt-BR")}</p>
                    <p className="text-[11px] text-muted-foreground">oportunidades</p>
                  </GlassCard>
                </button>
              );
            })}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-1">
                <Award className="h-5 w-5 text-indigo-600" />
                <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Em aprovação</span>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{kpis.em_aprovacao.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">fase atual</p>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-1">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Procuração 60d</span>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{kpis.procuracao_60d.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">vencendo</p>
            </GlassCard>
          </>
        )}
      </div>

      {/* Filtros */}
      <GlassCard className="p-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF/CNPJ ou email…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={fila} onValueChange={(v) => setFila(v as Fila)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as filas</SelectItem>
              <SelectItem value="renovacao">Renovação</SelectItem>
              <SelectItem value="upsell">Upsell</SelectItem>
              <SelectItem value="resgate">Resgate</SelectItem>
              <SelectItem value="winback">Win-back</SelectItem>
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-[110px]"><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas UFs</SelectItem>
              {(facetas?.ufs || []).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos CS</SelectItem>
              {(facetas?.responsaveis || []).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos perfis</SelectItem>
              {(facetas?.perfis || []).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Nível mín."
            value={nivelMin}
            onChange={e => setNivelMin(e.target.value)}
            className="w-[110px]"
          />
          <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Maior score</SelectItem>
              <SelectItem value="nivel">Maior nível</SelectItem>
              <SelectItem value="procuracao">Procuração vencendo</SelectItem>
              <SelectItem value="nome">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Lista */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted rounded-2xl" />)}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Crosshair className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum cliente encontrado com os filtros atuais.</p>
        </GlassCard>
      ) : (
        <>
          {isFetching && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
            </div>
          )}
          <div className="space-y-3">
            {data.rows.map(c => (
              <button key={c.id} onClick={() => setSelecionado(c)} className="w-full text-left">
                <GlassCard className="p-4 hover:ring-2 hover:ring-primary/40 transition-all">
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-foreground truncate">{c.nome_canonico}</p>
                        {c.nivel != null && (
                          <Badge variant="outline" className="text-[10px]">Nível {c.nivel}</Badge>
                        )}
                        {c.prioridade && (
                          <Badge variant="outline" className="text-[10px]">{c.prioridade}</Badge>
                        )}
                        {c.cliente_ativo === false && (
                          <Badge variant="destructive" className="text-[10px]">Inativo</Badge>
                        )}
                        {(c.filas || []).map(f => (
                          <Badge key={f} className={cn("text-[10px] capitalize",
                            f === "renovacao" && "bg-emerald-600",
                            f === "upsell" && "bg-blue-600",
                            f === "resgate" && "bg-amber-600",
                            f === "winback" && "bg-purple-600",
                          )}>{f}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.cpf_cnpj && <span>{c.cpf_cnpj}</span>}
                        {c.uf && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.uf}</span>}
                        {c.responsavel_cs && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{c.responsavel_cs}</span>}
                        {c.contato_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.contato_email}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                      <p className="text-2xl font-extrabold text-primary">{Math.round(c.score_priorizacao || 0)}</p>
                    </div>
                  </div>

                  {c.gatilho_principal && (
                    <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 mb-3">
                      <p className="text-xs font-medium text-primary">⚡ {c.gatilho_principal}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-center">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">Anos finalizados</p>
                      <p className="text-sm font-bold text-emerald-700">{c.anos_finalizados ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">Anos pendentes</p>
                      <p className="text-sm font-bold text-amber-700">{c.anos_pendentes ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">Status 2026</p>
                      <p className="text-sm font-bold truncate">{c.status_2026 || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">Procuração</p>
                      <p className="text-sm font-bold">{formatDate(c.vencimento_procuracao) || "—"}</p>
                    </div>
                  </div>

                  {c.historico_anos && Object.keys(c.historico_anos).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Object.entries(c.historico_anos)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([ano, status]) => (
                          <YearPill key={ano} ano={ano} status={String(status)} />
                        ))}
                    </div>
                  )}

                  {c.oportunidades && c.oportunidades.length > 0 && (
                    <div className="space-y-1">
                      {c.oportunidades.slice(0, 3).map((o, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">→</span>
                          <span><strong className="text-foreground capitalize">{o.tipo}:</strong> {o.descricao}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(c.contato_whatsapp || c.perfil_psicografico?.length) && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 text-xs flex-wrap">
                      {c.contato_whatsapp && (
                        <a
                          href={`https://wa.me/${(c.contato_whatsapp || "").replace(/\D/g, "")}`}
                          target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                        >
                          <MessageCircle className="h-3 w-3" /> {c.contato_whatsapp}
                        </a>
                      )}
                      {(c.perfil_psicografico || []).map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </button>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-5">
            <p className="text-xs text-muted-foreground">
              Página {pagina} de {totalPaginas} · {data.total.toLocaleString("pt-BR")} clientes
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

      {/* Drawer de detalhe */}
      <Sheet open={!!selecionado} onOpenChange={(o) => !o && setSelecionado(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          {selecionado && (
            <>
              <SheetHeader>
                <SheetTitle>{selecionado.nome_canonico}</SheetTitle>
                <SheetDescription>
                  {selecionado.cpf_cnpj || "Sem CPF/CNPJ"} · Score {Math.round(selecionado.score_priorizacao || 0)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-4">
                {selecionado.gatilho_principal && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                    <p className="text-xs uppercase tracking-wider text-primary mb-1">Gatilho principal</p>
                    <p className="text-sm font-medium">{selecionado.gatilho_principal}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Fase</p>
                    <p className="text-sm font-semibold">{selecionado.fase_macro || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Responsável CS</p>
                    <p className="text-sm font-semibold">{selecionado.responsavel_cs || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Status 2026</p>
                    <p className="text-sm font-semibold">{selecionado.status_2026 || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">IR Geral 2026</p>
                    <p className="text-sm font-semibold">{selecionado.ir_geral_2026 || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Apuração B3 2026</p>
                    <p className="text-sm font-semibold">{selecionado.apuracao_b3_2026 || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Procuração</p>
                    <p className="text-sm font-semibold inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {formatDate(selecionado.vencimento_procuracao) || "—"}
                    </p>
                  </div>
                </div>

                {selecionado.historico_anos && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-2">Histórico de anos</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selecionado.historico_anos)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([ano, status]) => (
                          <YearPill key={ano} ano={ano} status={String(status)} />
                        ))}
                    </div>
                  </div>
                )}

                {selecionado.oportunidades && selecionado.oportunidades.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-2">Oportunidades</p>
                    <div className="space-y-2">
                      {selecionado.oportunidades.map((o, i) => (
                        <div key={i} className="rounded-lg border border-border p-2">
                          <p className="text-xs font-semibold capitalize text-primary">{o.tipo}</p>
                          <p className="text-sm">{o.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selecionado.contato_whatsapp && (
                  <a
                    href={`https://wa.me/${(selecionado.contato_whatsapp || "").replace(/\D/g, "")}`}
                    target="_blank" rel="noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full" variant="default">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Abrir WhatsApp · {selecionado.contato_whatsapp}
                    </Button>
                  </a>
                )}

                <div className="pt-3 border-t border-border">
                  <ClienteAcoesPanel
                    clientKey={selecionado.client_key}
                    filasCliente={selecionado.filas || []}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Visao360Comercial;
