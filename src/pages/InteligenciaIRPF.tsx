import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Receipt, Building2, Bitcoin, TrendingUp, AlertTriangle, DollarSign,
  Home, Car, PiggyBank, Landmark, Briefcase, Search, ExternalLink, Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "react-router-dom";

const BLUE_EMPRESA_ID = "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db";

type TipoOportunidade = "todos" | "tributario" | "investidor" | "empresarial" | "cripto" | "imobiliario";

interface Insight {
  tipo: TipoOportunidade;
  icone: React.ElementType;
  titulo: string;
  descricao: string;
  cor: string;
}

interface DeclaracaoAgregada {
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
  // Agregações
  patrimonio_total: number;
  patrimonio_anterior: number;
  variacao_patrimonio: number;
  total_dividas: number;
  patrimonio_liquido: number;
  // Por grupo
  imoveis: number;
  veiculos: number;
  participacoes: number;
  aplicacoes: number;
  depositos: number;
  fundos: number;
  cripto: number;
  // Flags
  qtd_imoveis: number;
  qtd_veiculos: number;
  qtd_participacoes: number;
  qtd_cripto: number;
  // Lead vinculado
  lead?: {
    nome_lead: string | null;
    email: string | null;
    telefone: string | null;
    stage_atual: string | null;
    venda_realizada: boolean | null;
    tokeniza_investidor: boolean | null;
    tokeniza_valor_investido: number | null;
  } | null;
}

function gerarInsights(d: DeclaracaoAgregada): Insight[] {
  const insights: Insight[] = [];

  // Imobiliário
  if (d.qtd_imoveis >= 3) {
    insights.push({
      tipo: "imobiliario",
      icone: Home,
      titulo: `Portfólio imobiliário (${d.qtd_imoveis} imóveis)`,
      descricao: `${formatCurrency(d.imoveis)} em imóveis — perfil para tokenização imobiliária / FIIs.`,
      cor: "text-blue-600",
    });
  } else if (d.imoveis > 1_000_000) {
    insights.push({
      tipo: "imobiliario",
      icone: Home,
      titulo: "Patrimônio imobiliário relevante",
      descricao: `${formatCurrency(d.imoveis)} em imóveis declarados.`,
      cor: "text-blue-600",
    });
  }

  // Empresarial
  if (d.qtd_participacoes > 0) {
    insights.push({
      tipo: "empresarial",
      icone: Building2,
      titulo: `Sócio em ${d.qtd_participacoes} empresa(s)`,
      descricao: `${formatCurrency(d.participacoes)} em participações societárias — planejamento societário/tributário.`,
      cor: "text-indigo-600",
    });
  }

  // Investidor
  const totalInvestimentos = d.aplicacoes + d.fundos + d.depositos;
  if (totalInvestimentos > 200_000) {
    insights.push({
      tipo: "investidor",
      icone: TrendingUp,
      titulo: "Investidor qualificado",
      descricao: `${formatCurrency(totalInvestimentos)} em aplicações, fundos e depósitos — perfil para diversificação via Tokeniza.`,
      cor: "text-green-600",
    });
  }

  if (d.patrimonio_liquido > 1_000_000) {
    insights.push({
      tipo: "investidor",
      icone: DollarSign,
      titulo: "Alto patrimônio líquido",
      descricao: `${formatCurrency(d.patrimonio_liquido)} de patrimônio líquido — investidor profissional / private.`,
      cor: "text-emerald-700",
    });
  }

  // Variação patrimonial
  if (d.patrimonio_anterior > 0 && d.variacao_patrimonio / d.patrimonio_anterior > 0.3) {
    insights.push({
      tipo: "investidor",
      icone: TrendingUp,
      titulo: "Crescimento patrimonial expressivo",
      descricao: `+${((d.variacao_patrimonio / d.patrimonio_anterior) * 100).toFixed(0)}% no ano (${formatCurrency(d.variacao_patrimonio)}).`,
      cor: "text-green-700",
    });
  }

  // Cripto
  if (d.qtd_cripto > 0) {
    insights.push({
      tipo: "cripto",
      icone: Bitcoin,
      titulo: `Criptoativos declarados (${d.qtd_cripto})`,
      descricao: `${formatCurrency(d.cripto)} em criptoativos — familiarizado com ativos digitais e tokenização.`,
      cor: "text-purple-600",
    });
  }

  // Tributário — endividamento alto
  if (d.total_dividas > 0 && d.patrimonio_total > 0 && d.total_dividas / d.patrimonio_total > 0.4) {
    insights.push({
      tipo: "tributario",
      icone: AlertTriangle,
      titulo: "Endividamento elevado",
      descricao: `Dívidas representam ${((d.total_dividas / d.patrimonio_total) * 100).toFixed(0)}% do patrimônio (${formatCurrency(d.total_dividas)}).`,
      cor: "text-amber-600",
    });
  }

  // Atividade rural
  if (d.possui_atividade_rural) {
    insights.push({
      tipo: "empresarial",
      icone: Briefcase,
      titulo: "Possui atividade rural",
      descricao: d.resultado_atividade_rural
        ? `Resultado declarado: ${formatCurrency(d.resultado_atividade_rural)}.`
        : "Potencial para planejamento agro/tributário rural.",
      cor: "text-lime-700",
    });
  }

  // Cross-sell Tokeniza
  if (totalInvestimentos > 300_000 && d.lead && !d.lead.tokeniza_investidor) {
    insights.push({
      tipo: "investidor",
      icone: TrendingUp,
      titulo: "Cross-sell Tokeniza",
      descricao: `${formatCurrency(totalInvestimentos)} em investimentos tradicionais e ainda sem aporte na Tokeniza.`,
      cor: "text-cyan-600",
    });
  }

  return insights;
}

const TIPO_LABELS: Record<TipoOportunidade, string> = {
  todos: "Todos os tipos",
  tributario: "Tributário",
  investidor: "Investidor",
  empresarial: "Empresarial",
  cripto: "Cripto",
  imobiliario: "Imobiliário",
};

const InteligenciaIRPF = () => {
  const { isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const [filtroTipo, setFiltroTipo] = useState<TipoOportunidade>("todos");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"patrimonio" | "investimentos" | "variacao">("patrimonio");

  // Carrega TODAS as declarações concluídas (paginado)
  const { data: declaracoes, isLoading: loadingDecs } = useQuery({
    queryKey: ["irpf-inteligencia-decs", BLUE_EMPRESA_ID],
    queryFn: async () => {
      const PAGE = 1000;
      const todas: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("irpf_declaracao")
          .select("id, cpf, nome_contribuinte, exercicio, ano_calendario, id_lead, ocupacao_principal_descricao, endereco_uf, possui_atividade_rural, resultado_atividade_rural, status_processamento")
          .eq("id_empresa", BLUE_EMPRESA_ID)
          .eq("status_processamento", "concluido")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        todas.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return todas;
    },
  });

  // Carrega TODOS os bens (paginado)
  const { data: bens, isLoading: loadingBens } = useQuery({
    queryKey: ["irpf-inteligencia-bens", BLUE_EMPRESA_ID],
    enabled: !!declaracoes && declaracoes.length > 0,
    queryFn: async () => {
      const decIds = (declaracoes || []).map(d => d.id);
      if (decIds.length === 0) return [];
      const PAGE = 1000;
      const todos: any[] = [];
      // Busca em chunks de 200 declarações por filtro IN para não estourar URL
      const CHUNK_DECS = 200;
      for (let i = 0; i < decIds.length; i += CHUNK_DECS) {
        const chunk = decIds.slice(i, i + CHUNK_DECS);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("irpf_bem_direito")
            .select("id_declaracao, grupo_codigo, valor_ano_atual, valor_ano_anterior")
            .in("id_declaracao", chunk)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          todos.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }
      return todos;
    },
  });

  // Carrega dívidas
  const { data: dividas, isLoading: loadingDiv } = useQuery({
    queryKey: ["irpf-inteligencia-divs", BLUE_EMPRESA_ID],
    enabled: !!declaracoes && declaracoes.length > 0,
    queryFn: async () => {
      const decIds = (declaracoes || []).map(d => d.id);
      if (decIds.length === 0) return [];
      const PAGE = 1000;
      const todos: any[] = [];
      const CHUNK_DECS = 200;
      for (let i = 0; i < decIds.length; i += CHUNK_DECS) {
        const chunk = decIds.slice(i, i + CHUNK_DECS);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("irpf_divida_onus")
            .select("id_declaracao, situacao_ano_atual")
            .in("id_declaracao", chunk)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          todos.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }
      return todos;
    },
  });

  // Leads vinculados
  const { data: leadsMap } = useQuery({
    queryKey: ["irpf-inteligencia-leads", BLUE_EMPRESA_ID],
    enabled: !!declaracoes && declaracoes.length > 0,
    queryFn: async () => {
      const leadIds = Array.from(new Set((declaracoes || []).map(d => d.id_lead).filter(Boolean)));
      if (leadIds.length === 0) return new Map();
      const PAGE = 1000;
      const todos: any[] = [];
      const CHUNK = 200;
      for (let i = 0; i < leadIds.length; i += CHUNK) {
        const chunk = leadIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("lead")
          .select("id_lead, nome_lead, email, telefone, stage_atual, venda_realizada, tokeniza_investidor, tokeniza_valor_investido")
          .in("id_lead", chunk);
        if (error) throw error;
        if (data) todos.push(...data);
      }
      const map = new Map<string, any>();
      todos.forEach(l => map.set(l.id_lead, l));
      return map;
    },
  });

  const isLoading = loadingDecs || loadingBens || loadingDiv;

  // Agrega tudo por declaração
  const agregadas: DeclaracaoAgregada[] = useMemo(() => {
    if (!declaracoes) return [];

    // Index bens por declaração
    const bensIdx = new Map<string, any[]>();
    (bens || []).forEach(b => {
      const arr = bensIdx.get(b.id_declaracao) || [];
      arr.push(b);
      bensIdx.set(b.id_declaracao, arr);
    });

    // Index dívidas
    const divIdx = new Map<string, any[]>();
    (dividas || []).forEach(d => {
      const arr = divIdx.get(d.id_declaracao) || [];
      arr.push(d);
      divIdx.set(d.id_declaracao, arr);
    });

    return declaracoes.map(dec => {
      const bs = bensIdx.get(dec.id) || [];
      const ds = divIdx.get(dec.id) || [];

      const sumBy = (codes: string[]) => bs.filter(b => codes.includes(b.grupo_codigo)).reduce((s, b) => s + Number(b.valor_ano_atual || 0), 0);
      const countBy = (codes: string[]) => bs.filter(b => codes.includes(b.grupo_codigo) && Number(b.valor_ano_atual || 0) > 0).length;

      const patrimonio_total = bs.reduce((s, b) => s + Number(b.valor_ano_atual || 0), 0);
      const patrimonio_anterior = bs.reduce((s, b) => s + Number(b.valor_ano_anterior || 0), 0);
      const total_dividas = ds.reduce((s, d) => s + Number(d.situacao_ano_atual || 0), 0);

      const imoveis = sumBy(["01", "01-99"]);
      const veiculos = sumBy(["02"]);
      const participacoes = sumBy(["03"]);
      const aplicacoes = sumBy(["04", "05"]);
      const depositos = sumBy(["06"]);
      const fundos = sumBy(["07"]);
      const cripto = sumBy(["08"]);

      return {
        id: dec.id,
        cpf: dec.cpf,
        nome_contribuinte: dec.nome_contribuinte,
        exercicio: dec.exercicio,
        ano_calendario: dec.ano_calendario,
        id_lead: dec.id_lead,
        ocupacao: dec.ocupacao_principal_descricao,
        uf: dec.endereco_uf,
        possui_atividade_rural: dec.possui_atividade_rural,
        resultado_atividade_rural: dec.resultado_atividade_rural,
        patrimonio_total,
        patrimonio_anterior,
        variacao_patrimonio: patrimonio_total - patrimonio_anterior,
        total_dividas,
        patrimonio_liquido: patrimonio_total - total_dividas,
        imoveis, veiculos, participacoes, aplicacoes, depositos, fundos, cripto,
        qtd_imoveis: countBy(["01", "01-99"]),
        qtd_veiculos: countBy(["02"]),
        qtd_participacoes: countBy(["03"]),
        qtd_cripto: countBy(["08"]),
        lead: dec.id_lead && leadsMap ? leadsMap.get(dec.id_lead) || null : null,
      } as DeclaracaoAgregada;
    });
  }, [declaracoes, bens, dividas, leadsMap]);

  // Para cada declaração, calcula insights — mantém só as que têm pelo menos 1
  const comInsights = useMemo(
    () => agregadas.map(d => ({ ...d, insights: gerarInsights(d) })).filter(d => d.insights.length > 0),
    [agregadas]
  );

  const filtradas = useMemo(() => {
    let arr = comInsights;
    if (filtroTipo !== "todos") arr = arr.filter(d => d.insights.some(i => i.tipo === filtroTipo));
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(d =>
        (d.nome_contribuinte || "").toLowerCase().includes(q) ||
        (d.cpf || "").includes(q) ||
        (d.lead?.email || "").toLowerCase().includes(q)
      );
    }
    const sorted = [...arr];
    if (ordenacao === "patrimonio") sorted.sort((a, b) => b.patrimonio_liquido - a.patrimonio_liquido);
    else if (ordenacao === "investimentos") sorted.sort((a, b) => (b.aplicacoes + b.fundos + b.cripto) - (a.aplicacoes + a.fundos + a.cripto));
    else sorted.sort((a, b) => b.variacao_patrimonio - a.variacao_patrimonio);
    return sorted.slice(0, 200); // cap visual
  }, [comInsights, filtroTipo, busca, ordenacao]);

  // KPIs
  const kpis = useMemo(() => {
    const tipos = { tributario: 0, investidor: 0, empresarial: 0, cripto: 0, imobiliario: 0 };
    comInsights.forEach(d => {
      const setT = new Set(d.insights.map(i => i.tipo));
      setT.forEach(t => { if (t !== "todos" && t in tipos) (tipos as any)[t]++; });
    });
    return {
      totalDecs: agregadas.length,
      totalOport: comInsights.length,
      patrimonioTotal: agregadas.reduce((s, d) => s + d.patrimonio_liquido, 0),
      semLead: agregadas.filter(d => !d.id_lead).length,
      ...tipos,
    };
  }, [agregadas, comInsights]);

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Oportunidades IRPF
          </h2>
          <p className="text-sm text-muted-foreground">
            Insights gerados a partir de {kpis.totalDecs.toLocaleString("pt-BR")} declarações importadas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF ou email…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 w-[220px]"
            />
          </div>
          <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="patrimonio">Maior patrimônio líquido</SelectItem>
              <SelectItem value="investimentos">Maior em investimentos</SelectItem>
              <SelectItem value="variacao">Maior variação patrimonial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoOportunidade)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        <GlassCard className="p-4 text-center">
          <p className="text-xl font-bold text-foreground">{kpis.totalDecs.toLocaleString("pt-BR")}</p>
          <p className="text-[11px] text-muted-foreground">Declarações</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xl font-bold text-primary">{kpis.totalOport.toLocaleString("pt-BR")}</p>
          <p className="text-[11px] text-muted-foreground">Oportunidades</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(kpis.patrimonioTotal)}</p>
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
          <p className="text-xl font-bold text-amber-600">{kpis.semLead}</p>
          <p className="text-[11px] text-muted-foreground">Sem lead vinculado</p>
        </GlassCard>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl" />)}</div>
      ) : filtradas.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma oportunidade encontrada com os filtros atuais.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtradas.map(d => (
            <GlassCard key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-foreground truncate">
                      {d.lead?.nome_lead || d.nome_contribuinte || "Sem nome"}
                    </p>
                    <Badge variant="outline" className="text-[10px]">Exerc. {d.exercicio}</Badge>
                    {d.uf && <Badge variant="outline" className="text-[10px]">{d.uf}</Badge>}
                    {d.lead?.stage_atual && <Badge variant="outline" className="text-[10px]">{d.lead.stage_atual}</Badge>}
                    {d.lead?.venda_realizada && <Badge className="text-[10px] bg-green-600">Cliente</Badge>}
                    {d.lead?.tokeniza_investidor && <Badge className="text-[10px] bg-cyan-600">Tokeniza</Badge>}
                    {!d.id_lead && <Badge variant="destructive" className="text-[10px]">Sem lead</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>CPF: {d.cpf}</span>
                    {d.ocupacao && <span>• {d.ocupacao}</span>}
                    {d.lead?.email && <span>• {d.lead.email}</span>}
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

              {/* Patrimônio resumo */}
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

              {/* Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {d.insights.map((insight, i) => {
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
            </GlassCard>
          ))}
          {comInsights.length > filtradas.length && (
            <p className="text-center text-xs text-muted-foreground py-2">
              Mostrando os {filtradas.length} primeiros de {comInsights.length} resultados — refine a busca para ver outros.
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default InteligenciaIRPF;
