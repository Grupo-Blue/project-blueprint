import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Receipt, Building2, Bitcoin, TrendingUp, AlertTriangle, DollarSign,
  Home, Car, PiggyBank, Landmark, Briefcase, Search, ExternalLink, Users,
  ChevronLeft, ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const BLUE_EMPRESA_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";
const PAGE_SIZE = 20;

type TipoOportunidade = "todos" | "tributario" | "investidor" | "empresarial" | "cripto" | "imobiliario";
type Ordenacao = "patrimonio" | "investimentos" | "variacao";

const TIPO_LABELS: Record<TipoOportunidade, string> = {
  todos: "Todos os tipos",
  tributario: "Tributário",
  investidor: "Investidor",
  empresarial: "Empresarial",
  cripto: "Cripto",
  imobiliario: "Imobiliário",
};

interface Insight {
  tipo: TipoOportunidade;
  icone: React.ElementType;
  titulo: string;
  descricao: string;
  cor: string;
}

interface DeclaracaoRow {
  id: string;
  cpf: string;
  nome_contribuinte: string;
  exercicio: number;
  ano_calendario: number;
  id_lead: string | null;
  ocupacao: string | null;
  uf: string | null;
  possui_atividade_rural: boolean | null;
  resultado_atividade_rural: number | null;
  patrimonio_total: number;
  patrimonio_anterior: number;
  variacao_patrimonio: number;
  total_dividas: number;
  patrimonio_liquido: number;
  imoveis: number;
  veiculos: number;
  participacoes: number;
  aplicacoes: number;
  depositos: number;
  fundos: number;
  cripto: number;
  total_investimentos: number;
  qtd_imoveis: number;
  qtd_veiculos: number;
  qtd_participacoes: number;
  qtd_cripto: number;
  nome_lead: string | null;
  lead_email: string | null;
  lead_telefone: string | null;
  lead_stage: string | null;
  lead_venda_realizada: boolean | null;
  lead_tokeniza_investidor: boolean | null;
  lead_tokeniza_valor_investido: number | null;
}

function gerarInsights(d: DeclaracaoRow): Insight[] {
  const insights: Insight[] = [];

  if (d.qtd_imoveis >= 3) {
    insights.push({ tipo: "imobiliario", icone: Home, titulo: `Portfólio imobiliário (${d.qtd_imoveis} imóveis)`,
      descricao: `${formatCurrency(d.imoveis)} em imóveis — perfil para tokenização imobiliária / FIIs.`, cor: "text-blue-600" });
  } else if (d.imoveis > 1_000_000) {
    insights.push({ tipo: "imobiliario", icone: Home, titulo: "Patrimônio imobiliário relevante",
      descricao: `${formatCurrency(d.imoveis)} em imóveis declarados.`, cor: "text-blue-600" });
  }
  if (d.qtd_participacoes > 0) {
    insights.push({ tipo: "empresarial", icone: Building2, titulo: `Sócio em ${d.qtd_participacoes} empresa(s)`,
      descricao: `${formatCurrency(d.participacoes)} em participações societárias — planejamento societário/tributário.`, cor: "text-indigo-600" });
  }
  if (d.total_investimentos > 200_000) {
    insights.push({ tipo: "investidor", icone: TrendingUp, titulo: "Investidor qualificado",
      descricao: `${formatCurrency(d.total_investimentos)} em aplicações, fundos e depósitos — perfil para diversificação via Tokeniza.`, cor: "text-green-600" });
  }
  if (d.patrimonio_liquido > 1_000_000) {
    insights.push({ tipo: "investidor", icone: DollarSign, titulo: "Alto patrimônio líquido",
      descricao: `${formatCurrency(d.patrimonio_liquido)} de patrimônio líquido — investidor profissional / private.`, cor: "text-emerald-700" });
  }
  if (d.patrimonio_anterior > 0 && d.variacao_patrimonio / d.patrimonio_anterior > 0.3) {
    insights.push({ tipo: "investidor", icone: TrendingUp, titulo: "Crescimento patrimonial expressivo",
      descricao: `+${((d.variacao_patrimonio / d.patrimonio_anterior) * 100).toFixed(0)}% no ano (${formatCurrency(d.variacao_patrimonio)}).`, cor: "text-green-700" });
  }
  if (d.qtd_cripto > 0) {
    insights.push({ tipo: "cripto", icone: Bitcoin, titulo: `Criptoativos declarados (${d.qtd_cripto})`,
      descricao: `${formatCurrency(d.cripto)} em criptoativos — familiarizado com ativos digitais e tokenização.`, cor: "text-purple-600" });
  }
  if (d.total_dividas > 0 && d.patrimonio_total > 0 && d.total_dividas / d.patrimonio_total > 0.4) {
    insights.push({ tipo: "tributario", icone: AlertTriangle, titulo: "Endividamento elevado",
      descricao: `Dívidas representam ${((d.total_dividas / d.patrimonio_total) * 100).toFixed(0)}% do patrimônio (${formatCurrency(d.total_dividas)}).`, cor: "text-amber-600" });
  }
  if (d.possui_atividade_rural) {
    insights.push({ tipo: "empresarial", icone: Briefcase, titulo: "Possui atividade rural",
      descricao: d.resultado_atividade_rural ? `Resultado declarado: ${formatCurrency(d.resultado_atividade_rural)}.` : "Potencial para planejamento agro/tributário rural.",
      cor: "text-lime-700" });
  }
  if (d.total_investimentos > 300_000 && d.id_lead && !d.lead_tokeniza_investidor) {
    insights.push({ tipo: "investidor", icone: TrendingUp, titulo: "Cross-sell Tokeniza",
      descricao: `${formatCurrency(d.total_investimentos)} em investimentos tradicionais e ainda sem aporte na Tokeniza.`, cor: "text-cyan-600" });
  }
  return insights;
}

// Hook de debounce
function useDebounce<T>(value: T, delay = 400): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

const InteligenciaIRPF = () => {
  const { isLoading: loadingEmpresas, hasAccess } = useEmpresa();

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<TipoOportunidade>("todos");
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState<string>("todas");
  const [exercicio, setExercicio] = useState<string>("todos");
  const [patrimonioMin, setPatrimonioMin] = useState<string>("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("patrimonio");
  const [pagina, setPagina] = useState(1);

  const buscaDeb = useDebounce(busca, 400);
  const patrimonioDeb = useDebounce(patrimonioMin, 500);

  // Reset de página ao mudar filtros
  useEffect(() => { setPagina(1); }, [filtroTipo, buscaDeb, uf, exercicio, patrimonioDeb, ordenacao]);

  // Facetas (UFs/exercícios)
  const { data: facetas } = useQuery({
    queryKey: ["irpf-int-facetas", BLUE_EMPRESA_ID],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("irpf_inteligencia_facetas", { _id_empresa: BLUE_EMPRESA_ID });
      if (error) throw error;
      return (data?.[0] || { ufs: [], exercicios: [] }) as { ufs: string[]; exercicios: number[] };
    },
    staleTime: 10 * 60 * 1000,
  });

  // KPIs
  const { data: kpis, isLoading: loadingKpis, refetch: refetchKpis } = useQuery({
    queryKey: ["irpf-int-kpis", BLUE_EMPRESA_ID],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("irpf_inteligencia_kpis", { _id_empresa: BLUE_EMPRESA_ID });
      if (error) throw error;
      return (data?.[0] || null) as null | {
        total_decs: number; patrimonio_total: number; sem_lead: number;
        imobiliario: number; investidor: number; empresarial: number;
        cripto: number; tributario: number; total_oportunidades: number;
      };
    },
  });

  // Página
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["irpf-int-list", BLUE_EMPRESA_ID, buscaDeb, uf, exercicio, filtroTipo, patrimonioDeb, ordenacao, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("irpf_inteligencia_listar", {
        _id_empresa: BLUE_EMPRESA_ID,
        _busca: buscaDeb || null,
        _uf: uf === "todas" ? null : uf,
        _exercicio: exercicio === "todos" ? null : Number(exercicio),
        _tipo: filtroTipo,
        _patrimonio_min: patrimonioDeb ? Number(patrimonioDeb) : null,
        _ordenacao: ordenacao,
        _limite: PAGE_SIZE,
        _offset: (pagina - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as any[];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return { rows: rows as DeclaracaoRow[], total };
    },
  });

  const refresh = async () => {
    const { error } = await supabase.rpc("refresh_mv_irpf_inteligencia");
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    toast.success("Dados atualizados");
    refetchKpis();
    refetch();
  };

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Oportunidades IRPF
          </h2>
          <p className="text-sm text-muted-foreground">
            {kpis ? `${kpis.total_decs.toLocaleString("pt-BR")} declarações importadas` : "Carregando…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar dados
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        {loadingKpis || !kpis ? (
          Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)
        ) : (
          <>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-foreground">{kpis.total_decs.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Declarações</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-primary">{kpis.total_oportunidades.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground">Oportunidades</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(kpis.patrimonio_total)}</p>
              <p className="text-[11px] text-muted-foreground">Patrim. líquido total</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-blue-600">{kpis.imobiliario}</p>
              <p className="text-[11px] text-muted-foreground">Imobiliário</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-green-600">{kpis.investidor}</p>
              <p className="text-[11px] text-muted-foreground">Investidor</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-purple-600">{kpis.cripto}</p>
              <p className="text-[11px] text-muted-foreground">Cripto</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-xl font-bold text-amber-600">{kpis.sem_lead}</p>
              <p className="text-[11px] text-muted-foreground">Sem lead vinculado</p>
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
              placeholder="Nome, CPF ou email…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoOportunidade)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-[110px]"><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas UFs</SelectItem>
              {(facetas?.ufs || []).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={exercicio} onValueChange={setExercicio}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Exercício" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos exerc.</SelectItem>
              {(facetas?.exercicios || []).map(e => <SelectItem key={e} value={String(e)}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Patrim. mín. R$"
            value={patrimonioMin}
            onChange={e => setPatrimonioMin(e.target.value)}
            className="w-[150px]"
          />
          <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="patrimonio">Maior patrimônio líquido</SelectItem>
              <SelectItem value="investimentos">Maior em investimentos</SelectItem>
              <SelectItem value="variacao">Maior variação patrimonial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Lista */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl" />)}</div>
      ) : !data || data.rows.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma oportunidade encontrada com os filtros atuais.</p>
        </GlassCard>
      ) : (
        <>
          {isFetching && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
            </div>
          )}
          <div className="space-y-3">
            {data.rows.map(d => {
              const insights = gerarInsights(d);
              return (
                <GlassCard key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-foreground truncate">
                          {d.nome_lead || d.nome_contribuinte || "Sem nome"}
                        </p>
                        <Badge variant="outline" className="text-[10px]">Exerc. {d.exercicio}</Badge>
                        {d.uf && <Badge variant="outline" className="text-[10px]">{d.uf}</Badge>}
                        {d.lead_stage && <Badge variant="outline" className="text-[10px]">{d.lead_stage}</Badge>}
                        {d.lead_venda_realizada && <Badge className="text-[10px] bg-green-600">Cliente</Badge>}
                        {d.lead_tokeniza_investidor && <Badge className="text-[10px] bg-cyan-600">Tokeniza</Badge>}
                        {!d.id_lead && <Badge variant="destructive" className="text-[10px]">Sem lead</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>CPF: {d.cpf}</span>
                        {d.ocupacao && <span>• {d.ocupacao}</span>}
                        {d.lead_email && <span>• {d.lead_email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.id_lead && (
                        <Link to={`/leads?id=${d.id_lead}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Users className="h-3 w-3" /> Ver lead
                        </Link>
                      )}
                      <Link to="/irpf-importacoes" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Declaração
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3 text-center">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">Patrim. líquido</p>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(d.patrimonio_liquido)}</p>
                    </div>
                    {d.imoveis > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Home className="h-3 w-3" />Imóveis ({d.qtd_imoveis})</p>
                        <p className="text-sm font-bold text-blue-700">{formatCurrency(d.imoveis)}</p>
                      </div>
                    )}
                    {(d.aplicacoes + d.fundos) > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><PiggyBank className="h-3 w-3" />Investimentos</p>
                        <p className="text-sm font-bold text-green-700">{formatCurrency(d.aplicacoes + d.fundos)}</p>
                      </div>
                    )}
                    {d.depositos > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Landmark className="h-3 w-3" />Depósitos</p>
                        <p className="text-sm font-bold text-cyan-700">{formatCurrency(d.depositos)}</p>
                      </div>
                    )}
                    {d.participacoes > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Building2 className="h-3 w-3" />Participações ({d.qtd_participacoes})</p>
                        <p className="text-sm font-bold text-indigo-700">{formatCurrency(d.participacoes)}</p>
                      </div>
                    )}
                    {d.cripto > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Bitcoin className="h-3 w-3" />Cripto ({d.qtd_cripto})</p>
                        <p className="text-sm font-bold text-purple-700">{formatCurrency(d.cripto)}</p>
                      </div>
                    )}
                    {d.veiculos > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Car className="h-3 w-3" />Veículos ({d.qtd_veiculos})</p>
                        <p className="text-sm font-bold text-gray-700">{formatCurrency(d.veiculos)}</p>
                      </div>
                    )}
                    {d.total_dividas > 0 && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground">Dívidas</p>
                        <p className="text-sm font-bold text-amber-700">{formatCurrency(d.total_dividas)}</p>
                      </div>
                    )}
                  </div>

                  {insights.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {insights.map((insight, i) => {
                        const Icon = insight.icone;
                        return (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${insight.cor}`} />
                            <div>
                              <p className="text-xs font-semibold text-foreground">{insight.titulo}</p>
                              <p className="text-[11px] text-muted-foreground">{insight.descricao}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {(pagina - 1) * PAGE_SIZE + 1}–{Math.min(pagina * PAGE_SIZE, data.total)} de {data.total.toLocaleString("pt-BR")}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={pagina <= 1 || isFetching} onClick={() => setPagina(p => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Pág. {pagina} / {totalPaginas}</span>
              <Button variant="outline" size="sm" disabled={pagina >= totalPaginas || isFetching} onClick={() => setPagina(p => p + 1)}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InteligenciaIRPF;
