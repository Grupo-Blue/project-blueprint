import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, GitCompare } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { CampanhaSuperTrunfo, CampanhaCard } from "@/components/campanhas/CampanhaSuperTrunfo";
import { CriativoRankingData } from "@/components/campanhas/CriativoRankingCard";
import { ComparativoCampanhas } from "@/components/campanhas/ComparativoCampanhas";
import { calcularNotaTopo, calcularNotaFundo, TipoFunil } from "@/lib/campanha-scoring";

type PeriodoFiltro = '7d' | '30d' | 'mes_atual' | 'mes_anterior';
type PlataformaFiltro = 'todas' | 'META' | 'GOOGLE';
type OrdenacaoFiltro = 'nota' | 'cpl' | 'roas' | 'leads' | 'verba';

const RelatorioCreativos = () => {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [plataforma, setPlataforma] = useState<PlataformaFiltro>('todas');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoFiltro>('nota');
  const [comparando, setComparando] = useState(false);
  const [selecionadasComparar, setSelecionadasComparar] = useState<string[]>([]);
  const [comparativoAberto, setComparativoAberto] = useState(false);

  const getDatas = () => {
    const hoje = new Date();
    switch (periodo) {
      case '7d': return { inicio: subDays(hoje, 7), fim: hoje };
      case '30d': return { inicio: subDays(hoje, 30), fim: hoje };
      case 'mes_atual': return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) };
      case 'mes_anterior': const m = subMonths(hoje, 1); return { inicio: startOfMonth(m), fim: endOfMonth(m) };
    }
  };

  const { inicio: dataInicio, fim: dataFim } = getDatas();

  const { data: campanhasRaw, isLoading, refetch } = useQuery({
    queryKey: ["analise-campanhas", empresaSelecionada, periodo],
    queryFn: async () => {
      if (!empresaSelecionada) return [];

      // 1. Buscar campanhas ativas da empresa
      const { data: campanhasData } = await supabase
        .from("campanha")
        .select("id_campanha, nome, ativa, tipo_funil, conta_anuncio:id_conta(id_empresa, plataforma)")
        .eq("ativa", true);

      const campanhasDaEmpresa = (campanhasData || []).filter(
        c => c.conta_anuncio?.id_empresa === empresaSelecionada
      );
      if (campanhasDaEmpresa.length === 0) return [];

      const campIds = campanhasDaEmpresa.map(c => c.id_campanha);

      // 2. Métricas de campanha
      const { data: metricasCamp } = await supabase
        .from("campanha_metricas_dia")
        .select("*")
        .in("id_campanha", campIds)
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .lte("data", format(dataFim, "yyyy-MM-dd"));

      // 3. Criativos
      const { data: criativosData } = await supabase
        .from("criativo")
        .select("id_criativo, descricao, tipo, url_midia, url_preview, id_campanha, ativo, id_anuncio_externo")
        .in("id_campanha", campIds);

      const criatIds = (criativosData || []).map(c => c.id_criativo);

      // 4. Métricas de criativos
      let metricasCri: any[] = [];
      if (criatIds.length > 0) {
        const { data } = await supabase
          .from("criativo_metricas_dia")
          .select("*")
          .in("id_criativo", criatIds)
          .gte("data", format(dataInicio, "yyyy-MM-dd"))
          .lte("data", format(dataFim, "yyyy-MM-dd"));
        metricasCri = data || [];
      }

      // 5. Leads vinculados
      let leadsData: any[] = [];
      if (criatIds.length > 0) {
        const { data } = await supabase
          .from("lead")
          .select("id_criativo, is_mql, venda_realizada, valor_venda")
          .in("id_criativo", criatIds)
          .gte("data_criacao", format(dataInicio, "yyyy-MM-dd"))
          .lte("data_criacao", format(dataFim, "yyyy-MM-dd"));
        leadsData = data || [];
      }

      // Agregar métricas por campanha
      const metricasPorCamp: Record<string, { impressoes: number; cliques: number; verba: number; leads: number; conversoes: number; valor_conv: number }> = {};
      (metricasCamp || []).forEach(m => {
        if (!metricasPorCamp[m.id_campanha]) metricasPorCamp[m.id_campanha] = { impressoes: 0, cliques: 0, verba: 0, leads: 0, conversoes: 0, valor_conv: 0 };
        const c = metricasPorCamp[m.id_campanha];
        c.impressoes += m.impressoes || 0;
        c.cliques += m.cliques || 0;
        c.verba += m.verba_investida || 0;
        c.leads += m.leads || 0;
        c.conversoes += m.conversoes || 0;
        c.valor_conv += m.valor_conversao || 0;
      });

      // Agregar métricas por criativo
      const metPorCri: Record<string, { impressoes: number; cliques: number; verba: number; leadsMetrica: number }> = {};
      metricasCri.forEach(m => {
        if (!metPorCri[m.id_criativo]) metPorCri[m.id_criativo] = { impressoes: 0, cliques: 0, verba: 0, leadsMetrica: 0 };
        metPorCri[m.id_criativo].impressoes += m.impressoes || 0;
        metPorCri[m.id_criativo].cliques += m.cliques || 0;
        metPorCri[m.id_criativo].verba += m.verba_investida || 0;
        metPorCri[m.id_criativo].leadsMetrica += m.leads || 0;
      });

      const leadsPorCri: Record<string, { total: number; mqls: number; vendas: number; valor: number }> = {};
      leadsData.forEach(l => {
        if (!l.id_criativo) return;
        if (!leadsPorCri[l.id_criativo]) leadsPorCri[l.id_criativo] = { total: 0, mqls: 0, vendas: 0, valor: 0 };
        leadsPorCri[l.id_criativo].total += 1;
        if (l.is_mql) leadsPorCri[l.id_criativo].mqls += 1;
        if (l.venda_realizada) { leadsPorCri[l.id_criativo].vendas += 1; leadsPorCri[l.id_criativo].valor += l.valor_venda || 0; }
      });

      return campanhasDaEmpresa.map(camp => {
        const mc = metricasPorCamp[camp.id_campanha] || { impressoes: 0, cliques: 0, verba: 0, leads: 0, conversoes: 0, valor_conv: 0 };
        const criativosCamp = (criativosData || []).filter(c => c.id_campanha === camp.id_campanha);

        // Construir dados dos criativos
        const criativos: CriativoRankingData[] = criativosCamp.map(cr => {
          const mCr = metPorCri[cr.id_criativo] || { impressoes: 0, cliques: 0, verba: 0, leadsMetrica: 0 };
          const lCr = leadsPorCri[cr.id_criativo] || { total: 0, mqls: 0, vendas: 0, valor: 0 };
          const totalLeads = lCr.total > 0 ? lCr.total : mCr.leadsMetrica;
          return {
            id_criativo: cr.id_criativo,
            descricao: cr.descricao,
            tipo: cr.tipo,
            url_midia: cr.url_midia,
            url_preview: cr.url_preview,
            impressoes: mCr.impressoes,
            cliques: mCr.cliques,
            leads: totalLeads,
            vendas: lCr.vendas,
            verba_investida: mCr.verba,
            ctr: mCr.impressoes > 0 ? (mCr.cliques / mCr.impressoes) * 100 : 0,
            cpl: totalLeads > 0 ? mCr.verba / totalLeads : 0,
            roas: mCr.verba > 0 ? lCr.valor / mCr.verba : 0,
            valor_vendas: lCr.valor,
            isSemConversao: mCr.verba > 0 && totalLeads === 0,
          };
        }).filter(c => c.impressoes > 0 || c.verba_investida > 0);

        // Marcar estrela (melhor CPL com leads > 0)
        const comLeads = criativos.filter(c => c.leads > 0);
        if (comLeads.length > 0) {
          const melhor = comLeads.reduce((a, b) => a.cpl < b.cpl ? a : b);
          const idx = criativos.findIndex(c => c.id_criativo === melhor.id_criativo);
          if (idx >= 0) criativos[idx].isEstrela = true;
        }

        // Ordenar criativos por CPL (menor = melhor)
        criativos.sort((a, b) => {
          if (a.leads > 0 && b.leads === 0) return -1;
          if (a.leads === 0 && b.leads > 0) return 1;
          return a.cpl - b.cpl;
        });

        // Totalizar leads/mqls/vendas via criativos
        const totalLeads = criativos.reduce((s, c) => s + c.leads, 0) || mc.leads;
        const totalMqls = criativos.reduce((s, c) => s + (leadsPorCri[c.id_criativo]?.mqls || 0), 0);
        const totalVendas = criativos.reduce((s, c) => s + c.vendas, 0);
        const totalValorVendas = criativos.reduce((s, c) => s + c.valor_vendas, 0);

        return {
          id_campanha: camp.id_campanha,
          nome: camp.nome,
          plataforma: camp.conta_anuncio?.plataforma || 'META',
          tipo_funil: (camp.tipo_funil as TipoFunil) || 'fundo',
          ativa: camp.ativa,
          impressoes: mc.impressoes,
          cliques: mc.cliques,
          leads: totalLeads,
          mqls: totalMqls,
          vendas: totalVendas,
          valor_vendas: totalValorVendas,
          verba_investida: mc.verba,
          ctr: mc.impressoes > 0 ? (mc.cliques / mc.impressoes) * 100 : 0,
          cpl: totalLeads > 0 ? mc.verba / totalLeads : 0,
          roas: mc.verba > 0 ? totalValorVendas / mc.verba : 0,
          criativos,
          criativos_ativos: criativosCamp.filter(c => c.ativo).length,
          criativos_total: criativosCamp.length,
          tem_alerta: criativos.some(c => c.isFadiga || c.isSemConversao),
        };
      });
    },
    enabled: !!empresaSelecionada,
    refetchInterval: 5 * 60 * 1000,
  });

  // Calcular scores
  const campanhas: CampanhaCard[] = useMemo(() => {
    if (!campanhasRaw) return [];
    const cplMedio = (() => {
      const comLeads = campanhasRaw.filter(c => c.leads > 0);
      if (comLeads.length === 0) return undefined;
      const totalVerba = comLeads.reduce((s, c) => s + c.verba_investida, 0);
      const totalLeads = comLeads.reduce((s, c) => s + c.leads, 0);
      return totalLeads > 0 ? totalVerba / totalLeads : undefined;
    })();

    return campanhasRaw.map(c => {
      const metricas = { impressoes: c.impressoes, cliques: c.cliques, verba_investida: c.verba_investida, leads: c.leads, mqls: c.mqls, vendas: c.vendas, valor_vendas: c.valor_vendas };
      const score = c.tipo_funil === 'topo' ? calcularNotaTopo(metricas) : calcularNotaFundo(metricas, cplMedio);
      return { ...c, score };
    });
  }, [campanhasRaw]);

  // Filtrar + ordenar
  const campanhasFiltradas = useMemo(() => {
    let list = campanhas;
    if (plataforma !== 'todas') list = list.filter(c => c.plataforma === plataforma);

    list.sort((a, b) => {
      switch (ordenacao) {
        case 'nota': return b.score.pontuacao - a.score.pontuacao;
        case 'cpl': return (a.cpl || 999999) - (b.cpl || 999999);
        case 'roas': return b.roas - a.roas;
        case 'leads': return b.leads - a.leads;
        case 'verba': return b.verba_investida - a.verba_investida;
        default: return 0;
      }
    });
    return list;
  }, [campanhas, plataforma, ordenacao]);

  const updateTipoFunil = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: TipoFunil }) => {
      const { error } = await supabase.from("campanha").update({ tipo_funil: tipo } as any).eq("id_campanha", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analise-campanhas"] });
      toast.success("Tipo de funil atualizado");
    },
  });

  const toggleComparar = (id: string) => {
    setSelecionadasComparar(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56" />)}
        </div>
      </div>
    );
  }

  const campanhasComparar = campanhas.filter(c => selecionadasComparar.includes(c.id_campanha));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Análise de Campanhas</h1>
          <p className="text-sm text-muted-foreground">{campanhasFiltradas.length} campanhas ativas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={v => setPeriodo(v as PeriodoFiltro)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
              <SelectItem value="mes_anterior">Mês anterior</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plataforma} onValueChange={v => setPlataforma(v as PlataformaFiltro)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="META">Meta</SelectItem>
              <SelectItem value="GOOGLE">Google</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordenacao} onValueChange={v => setOrdenacao(v as OrdenacaoFiltro)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nota">Nota</SelectItem>
              <SelectItem value="cpl">CPL</SelectItem>
              <SelectItem value="roas">ROAS</SelectItem>
              <SelectItem value="leads">Leads</SelectItem>
              <SelectItem value="verba">Verba</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={comparando ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (comparando && selecionadasComparar.length >= 2) {
                setComparativoAberto(true);
              } else {
                setComparando(!comparando);
                setSelecionadasComparar([]);
              }
            }}
          >
            <GitCompare className="h-4 w-4 mr-1" />
            {comparando ? `Comparar (${selecionadasComparar.length})` : 'Comparar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid de Cards */}
      {campanhasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhuma campanha ativa encontrada</p>
          <p className="text-sm mt-1">Verifique se existem campanhas cadastradas para esta empresa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campanhasFiltradas.map(c => (
            <CampanhaSuperTrunfo
              key={c.id_campanha}
              campanha={c}
              onTipoFunilChange={(id, tipo) => updateTipoFunil.mutate({ id, tipo })}
              comparando={comparando}
              onToggleComparar={toggleComparar}
              selecionadaComparar={selecionadasComparar.includes(c.id_campanha)}
            />
          ))}
        </div>
      )}

      {/* Comparativo */}
      <ComparativoCampanhas
        campanhas={campanhasComparar}
        open={comparativoAberto}
        onOpenChange={(open) => {
          setComparativoAberto(open);
          if (!open) { setComparando(false); setSelecionadasComparar([]); }
        }}
      />
    </div>
  );
};

export default RelatorioCreativos;
