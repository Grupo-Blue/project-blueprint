import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { GlassCard } from "@/components/ui/GlassCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Lightbulb, Building2, Bitcoin, TrendingUp, AlertTriangle, DollarSign, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type TipoOportunidade = "todos" | "tributario" | "investidor" | "empresarial" | "cripto";

interface Insight {
  tipo: TipoOportunidade;
  icone: React.ElementType;
  titulo: string;
  descricao: string;
  cor: string;
}

function gerarInsights(lead: any): Insight[] {
  const insights: Insight[] = [];

  // Tributário
  if (lead.irpf_renda_anual && lead.irpf_renda_anual > 150000 && lead.irpf_complexidade_declaracao === "baixa") {
    insights.push({
      tipo: "tributario",
      icone: AlertTriangle,
      titulo: "Declaração simplificada com renda alta",
      descricao: `Renda de ${formatCurrency(lead.irpf_renda_anual)} com declaração simplificada — pode estar pagando mais imposto do que deveria.`,
      cor: "text-amber-600",
    });
  }

  if (lead.irpf_aliquota_efetiva && lead.irpf_aliquota_efetiva > 20) {
    insights.push({
      tipo: "tributario",
      icone: DollarSign,
      titulo: "Alíquota efetiva elevada",
      descricao: `Alíquota efetiva de ${lead.irpf_aliquota_efetiva.toFixed(1)}% — consultoria tributária pode reduzir a carga fiscal.`,
      cor: "text-red-600",
    });
  }

  // Empresarial
  if (lead.irpf_possui_empresas) {
    insights.push({
      tipo: "empresarial",
      icone: Building2,
      titulo: "Possui empresas declaradas",
      descricao: "Potencial para planejamento societário e tributário empresarial.",
      cor: "text-blue-600",
    });
  }

  // Investidor
  if (lead.irpf_valor_investimentos && lead.irpf_valor_investimentos > 100000) {
    insights.push({
      tipo: "investidor",
      icone: TrendingUp,
      titulo: "Perfil investidor relevante",
      descricao: `${formatCurrency(lead.irpf_valor_investimentos)} em investimentos financeiros — perfil de diversificação para tokenização.`,
      cor: "text-green-600",
    });
  }

  if (lead.irpf_patrimonio_total && lead.irpf_patrimonio_total > 500000) {
    insights.push({
      tipo: "investidor",
      icone: DollarSign,
      titulo: "Patrimônio expressivo",
      descricao: `Patrimônio de ${formatCurrency(lead.irpf_patrimonio_total)} — potencial investidor qualificado.`,
      cor: "text-green-700",
    });
  }

  // Cripto
  if (lead.irpf_possui_cripto) {
    insights.push({
      tipo: "cripto",
      icone: Bitcoin,
      titulo: "Familiarizado com ativos digitais",
      descricao: lead.irpf_valor_cripto
        ? `${formatCurrency(lead.irpf_valor_cripto)} em criptoativos declarados — já está no universo de ativos alternativos.`
        : "Possui criptoativos declarados — já é familiarizado com ativos digitais.",
      cor: "text-purple-600",
    });
  }

  // Cross-sell: Blue → Tokeniza
  if (lead.irpf_valor_investimentos && lead.irpf_valor_investimentos > 200000 && !lead.tokeniza_investidor) {
    insights.push({
      tipo: "investidor",
      icone: TrendingUp,
      titulo: "Oportunidade cross-sell Tokeniza",
      descricao: `Investimentos de ${formatCurrency(lead.irpf_valor_investimentos)} mas ainda não investiu via Tokeniza — oportunidade de diversificação.`,
      cor: "text-cyan-600",
    });
  }

  return insights;
}

const InteligenciaIRPF = () => {
  const { empresaSelecionada, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const [filtroTipo, setFiltroTipo] = useState<TipoOportunidade>("todos");

  const empresaId = empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null;

  const { data: leadsIRPF, isLoading } = useQuery({
    queryKey: ["inteligencia-irpf", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lead")
        .select("id_lead, nome_lead, email, telefone, stage_atual, origem_canal, venda_realizada, irpf_renda_anual, irpf_patrimonio_total, irpf_valor_investimentos, irpf_possui_empresas, irpf_possui_cripto, irpf_valor_cripto, irpf_complexidade_declaracao, irpf_aliquota_efetiva, tokeniza_investidor, tokeniza_qtd_investimentos, tokeniza_valor_investido")
        .eq("id_empresa", empresaId)
        .not("irpf_renda_anual", "is", null)
        .order("irpf_renda_anual", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Generate insights for all leads
  const leadsComInsights = (leadsIRPF || []).map(lead => ({
    ...lead,
    insights: gerarInsights(lead),
  })).filter(l => l.insights.length > 0);

  const leadsFiltrados = filtroTipo === "todos"
    ? leadsComInsights
    : leadsComInsights.filter(l => l.insights.some(i => i.tipo === filtroTipo));

  // KPIs
  const totalLeadsIRPF = leadsIRPF?.length || 0;
  const totalOportunidades = leadsComInsights.length;
  const oportunidadesTributario = leadsComInsights.filter(l => l.insights.some(i => i.tipo === "tributario")).length;
  const oportunidadesCrossSell = leadsComInsights.filter(l => l.insights.some(i => i.titulo.includes("cross-sell"))).length;

  if (loadingEmpresas) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!hasAccess) return <SemAcessoEmpresas />;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Oportunidades IRPF
          </h2>
          <p className="text-sm text-muted-foreground">Insights comerciais gerados a partir dos dados fiscais</p>
        </div>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoOportunidade)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="tributario">Tributário</SelectItem>
            <SelectItem value="investidor">Investidor</SelectItem>
            <SelectItem value="empresarial">Empresarial</SelectItem>
            <SelectItem value="cripto">Cripto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalLeadsIRPF}</p>
          <p className="text-xs text-muted-foreground">Leads com IRPF</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalOportunidades}</p>
          <p className="text-xs text-muted-foreground">Oportunidades</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{oportunidadesTributario}</p>
          <p className="text-xs text-muted-foreground">Tributário</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-cyan-600">{oportunidadesCrossSell}</p>
          <p className="text-xs text-muted-foreground">Cross-sell</p>
        </GlassCard>
      </div>

      {!empresaId ? (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">Selecione uma empresa para ver as oportunidades.</p>
        </GlassCard>
      ) : isLoading ? (
        <div className="animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl" />)}</div>
      ) : leadsFiltrados.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma oportunidade encontrada com dados IRPF.</p>
          <p className="text-xs text-muted-foreground mt-1">Importe declarações na página IRPF para gerar insights.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {leadsFiltrados.map(lead => (
            <GlassCard key={lead.id_lead} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-bold text-foreground">{lead.nome_lead || "Lead sem nome"}</p>
                    <Badge variant="outline" className="text-[10px]">{lead.stage_atual || "—"}</Badge>
                    {lead.venda_realizada && <Badge variant="default" className="text-[10px] bg-green-600">Cliente</Badge>}
                    {lead.irpf_renda_anual && (
                      <span className="text-xs text-muted-foreground">Renda: {formatCurrency(lead.irpf_renda_anual)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {lead.insights.map((insight, i) => {
                      const Icon = insight.icone;
                      return (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${insight.cor}`} />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{insight.titulo}</p>
                            <p className="text-[11px] text-muted-foreground">{insight.descricao}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
};

export default InteligenciaIRPF;
