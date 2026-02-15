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
        .select("id_campanha, nome, ativa, tipo_funil, conta_anuncio:id_conta(id_empresa, plataforma, id_externo)")
        .eq("ativa", true);

      const campanhasDaEmpresa = (campanhasData || []).filter(
        c => c.conta_anuncio?.id_empresa === empresaSelecionada
      );

      // 1b. Buscar campanhas pausadas que tenham keywords vinculadas
      const { data: keywordCampIds } = await supabase
        .from("google_ads_keyword")
        .select("id_campanha")
        .eq("id_empresa", empresaSelecionada)
        .not("id_campanha", "is", null);

      const pausedIdsWithKeywords = [...new Set((keywordCampIds || []).map(k => k.id_campanha).filter(Boolean))] as string[];
      const activeIds = campanhasDaEmpresa.map(c => c.id_campanha);
      const missingPausedIds = pausedIdsWithKeywords.filter(id => !activeIds.includes(id));

      if (missingPausedIds.length > 0) {
        const { data: pausedCampanhas } = await supabase
          .from("campanha")
          .select("id_campanha, nome, ativa, tipo_funil, conta_anuncio:id_conta(id_empresa, plataforma, id_externo)")
          .in("id_campanha", missingPausedIds);

        const pausedDaEmpresa = (pausedCampanhas || []).filter(
          c => c.conta_anuncio?.id_empresa === empresaSelecionada
        );
        campanhasDaEmpresa.push(...pausedDaEmpresa);
      }

      if (campanhasDaEmpresa.length === 0) return [];

      const campIds = campanhasDaEmpresa.map(c => c.id_campanha);

      // 2. Métricas de campanha
      const { data: metricasCamp } = await supabase
        .from("campanha_metricas_dia")
        .select("*")
        .in("id_campanha", campIds)
        .not("fonte_conversoes", "is", null)
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .lte("data", format(dataFim, "yyyy-MM-dd"));

      // 3. Criativos (incluindo dados da conta para links permanentes)
      const { data: criativosData } = await supabase
        .from("criativo")
        .select("id_criativo, descricao, tipo, url_midia, url_preview, id_campanha, ativo, id_anuncio_externo, url_video")
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

      // 5. Leads vinculados via criativo
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

      // 5b. Leads vinculados via id_campanha_vinculada (sem criativo)
      let leadsCampanhaData: any[] = [];
      if (campIds.length > 0) {
        const { data } = await supabase
          .from("lead")
          .select("id_campanha_vinculada, id_criativo, is_mql, venda_realizada, valor_venda")
          .in("id_campanha_vinculada", campIds)
          .is("id_criativo", null)
          .gte("data_criacao", format(dataInicio, "yyyy-MM-dd"))
          .lte("data_criacao", format(dataFim, "yyyy-MM-dd"));
        leadsCampanhaData = data || [];
      }

      // Agregar métricas por campanha
      const metricasPorCamp: Record<string, { impressoes: number; cliques: number; verba: number; leads: number; conversoes: number; valor_conv: number; alcance: number; frequencia: number; cpc_medio: number }> = {};
      (metricasCamp || []).forEach(m => {
        if (!metricasPorCamp[m.id_campanha]) metricasPorCamp[m.id_campanha] = { impressoes: 0, cliques: 0, verba: 0, leads: 0, conversoes: 0, valor_conv: 0, alcance: 0, frequencia: 0, cpc_medio: 0 };
        const c = metricasPorCamp[m.id_campanha];
        c.impressoes += m.impressoes || 0;
        c.cliques += m.cliques || 0;
        c.verba += m.verba_investida || 0;
        c.leads += m.leads || 0;
        c.conversoes += (m as any).conversoes || 0;
        c.valor_conv += (m as any).valor_conversao || 0;
        c.alcance += (m as any).alcance || 0;
        if ((m as any).cpc_medio > 0) c.cpc_medio = (m as any).cpc_medio;
      });

      // Agregar métricas por criativo (incluindo alcance, frequência, video_views)
      const metPorCri: Record<string, { impressoes: number; cliques: number; verba: number; leadsMetrica: number; alcance: number; frequencia: number; video_views: number }> = {};
      metricasCri.forEach(m => {
        if (!metPorCri[m.id_criativo]) metPorCri[m.id_criativo] = { impressoes: 0, cliques: 0, verba: 0, leadsMetrica: 0, alcance: 0, frequencia: 0, video_views: 0 };
        metPorCri[m.id_criativo].impressoes += m.impressoes || 0;
        metPorCri[m.id_criativo].cliques += m.cliques || 0;
        metPorCri[m.id_criativo].verba += m.verba_investida || 0;
        metPorCri[m.id_criativo].leadsMetrica += m.leads || 0;
        metPorCri[m.id_criativo].alcance += (m as any).alcance || 0;
        if ((m as any).frequencia > 0) metPorCri[m.id_criativo].frequencia = (m as any).frequencia;
        metPorCri[m.id_criativo].video_views += (m as any).video_views || 0;
      });

      const leadsPorCri: Record<string, { total: number; mqls: number; vendas: number; valor: number }> = {};
      leadsData.forEach(l => {
        if (!l.id_criativo) return;
        if (!leadsPorCri[l.id_criativo]) leadsPorCri[l.id_criativo] = { total: 0, mqls: 0, vendas: 0, valor: 0 };
        leadsPorCri[l.id_criativo].total += 1;
        if (l.is_mql) leadsPorCri[l.id_criativo].mqls += 1;
        if (l.venda_realizada) { leadsPorCri[l.id_criativo].vendas += 1; leadsPorCri[l.id_criativo].valor += l.valor_venda || 0; }
      });

      // Agregar leads vinculados por campanha (sem criativo)
      const leadsPorCampanha: Record<string, { total: number; mqls: number; vendas: number; valor: number }> = {};
      leadsCampanhaData.forEach(l => {
        const cId = l.id_campanha_vinculada;
        if (!cId) return;
        if (!leadsPorCampanha[cId]) leadsPorCampanha[cId] = { total: 0, mqls: 0, vendas: 0, valor: 0 };
        leadsPorCampanha[cId].total += 1;
        if (l.is_mql) leadsPorCampanha[cId].mqls += 1;
        if (l.venda_realizada) { leadsPorCampanha[cId].vendas += 1; leadsPorCampanha[cId].valor += l.valor_venda || 0; }
      });

      // Mapear conta_id_externo por campanha
      const contaIdExternoPorCamp: Record<string, string | null> = {};
      campanhasDaEmpresa.forEach(c => {
        contaIdExternoPorCamp[c.id_campanha] = c.conta_anuncio?.id_externo || null;
      });

      return campanhasDaEmpresa.map(camp => {
        const mc = metricasPorCamp[camp.id_campanha] || { impressoes: 0, cliques: 0, verba: 0, leads: 0, conversoes: 0, valor_conv: 0, alcance: 0, frequencia: 0, cpc_medio: 0 };
        const criativosCamp = (criativosData || []).filter(c => c.id_campanha === camp.id_campanha);
        const contaIdExterno = contaIdExternoPorCamp[camp.id_campanha] || null;

        // Construir dados dos criativos
        const criativos: CriativoRankingData[] = criativosCamp.map(cr => {
          const mCr = metPorCri[cr.id_criativo] || { impressoes: 0, cliques: 0, verba: 0, leadsMetrica: 0, alcance: 0, frequencia: 0, video_views: 0 };
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
            id_anuncio_externo: cr.id_anuncio_externo,
            conta_id_externo: contaIdExterno,
            alcance: mCr.alcance,
            frequencia: mCr.frequencia,
            video_views: mCr.video_views,
          };
        });

        // Marcar estrela (melhor CPL com leads > 0)
        const comLeads = criativos.filter(c => c.leads > 0);
        if (comLeads.length > 0) {
          const melhor = comLeads.reduce((a, b) => a.cpl < b.cpl ? a : b);
          const idx = criativos.findIndex(c => c.id_criativo === melhor.id_criativo);
          if (idx >= 0) criativos[idx].isEstrela = true;
        }

        // Ordenar criativos: com dados primeiro, depois por CPL (menor = melhor)
        criativos.sort((a, b) => {
          const aTemDados = a.impressoes > 0 || a.verba_investida > 0 || a.leads > 0;
          const bTemDados = b.impressoes > 0 || b.verba_investida > 0 || b.leads > 0;
          if (aTemDados && !bTemDados) return -1;
          if (!aTemDados && bTemDados) return 1;
          if (a.leads > 0 && b.leads === 0) return -1;
          if (a.leads === 0 && b.leads > 0) return 1;
          return a.cpl - b.cpl;
        });

        // Totalizar leads/mqls/vendas via criativos (atribuição direta)
        const vendasDiretas = criativos.reduce((s, c) => s + c.vendas, 0);
        const valorDireto = criativos.reduce((s, c) => s + c.valor_vendas, 0);
        
        // Leads vinculados por campanha (sem criativo identificado)
        const lCamp = leadsPorCampanha[camp.id_campanha] || { total: 0, mqls: 0, vendas: 0, valor: 0 };
        
        const totalLeads = (criativos.reduce((s, c) => s + c.leads, 0) + lCamp.total) || mc.leads;
        const totalMqls = criativos.reduce((s, c) => s + (leadsPorCri[c.id_criativo]?.mqls || 0), 0) + lCamp.mqls;
        const totalVendas = vendasDiretas + lCamp.vendas;
        const totalValorVendas = valorDireto + lCamp.valor;

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
          vendas_diretas: vendasDiretas,
          vendas_campanha: lCamp.vendas,
          valor_vendas: totalValorVendas,
          verba_investida: mc.verba,
          ctr: mc.impressoes > 0 ? (mc.cliques / mc.impressoes) * 100 : 0,
          cpl: totalLeads > 0 ? mc.verba / totalLeads : 0,
          roas: mc.verba > 0 ? totalValorVendas / mc.verba : 0,
          criativos,
          criativos_ativos: criativosCamp.filter(c => c.ativo).length,
          criativos_total: criativosCamp.length,
          tem_alerta: criativos.some(c => c.isFadiga || c.isSemConversao),
          alcance: mc.alcance,
          frequencia: mc.frequencia,
          cpc_medio: mc.cpc_medio,
          conversoes: mc.conversoes,
          valor_conversao: mc.valor_conv,
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
          <p className="text-sm text-muted-foreground">{campanhasFiltradas.length} campanhas</p>
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

      {/* Grid de Cards separado por plataforma */}
      {campanhasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhuma campanha ativa encontrada</p>
          <p className="text-sm mt-1">Verifique se existem campanhas cadastradas para esta empresa</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Google Ads */}
          {campanhasFiltradas.some(c => c.plataforma === 'GOOGLE') && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Google Ads</h2>
                  <p className="text-xs text-muted-foreground">{campanhasFiltradas.filter(c => c.plataforma === 'GOOGLE').length} campanhas</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campanhasFiltradas.filter(c => c.plataforma === 'GOOGLE').map(c => {
                  const isSearch = c.nome.toUpperCase().includes('SEARCH');
                  return (
                    <CampanhaSuperTrunfo
                      key={c.id_campanha}
                      campanha={c}
                      onTipoFunilChange={(id, tipo) => updateTipoFunil.mutate({ id, tipo })}
                      comparando={comparando}
                      onToggleComparar={toggleComparar}
                      selecionadaComparar={selecionadasComparar.includes(c.id_campanha)}
                      isGoogleSearch={isSearch}
                      id_empresa={empresaSelecionada}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Divisor entre plataformas */}
          {campanhasFiltradas.some(c => c.plataforma === 'GOOGLE') && campanhasFiltradas.some(c => c.plataforma === 'META') && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            </div>
          )}

          {/* Meta Ads */}
          {campanhasFiltradas.some(c => c.plataforma === 'META') && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0081FB] flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.4 12c0-1.61-.32-2.93-.85-3.93-.7-1.31-1.72-1.97-2.68-1.97-1.17 0-2.08.56-3.32 2.14l-.72.93-.76-.96C11.82 6.63 10.87 6.1 9.7 6.1c-.99 0-1.96.66-2.63 1.82C6.56 8.86 6.2 10.26 6.2 12c0 2.48.94 4.69 2.4 5.43.4.2.8.3 1.14.3.98 0 1.73-.62 2.93-2.2l.73-.96.76.98c1.21 1.56 1.99 2.18 2.97 2.18.34 0 .73-.1 1.12-.29 1.46-.74 2.39-2.95 2.39-5.44h-.24zm-4.27 3.75c-.3 0-.72-.33-1.46-1.27l-1.42-1.84 1.4-1.82c.8-1.04 1.22-1.42 1.57-1.42.5 0 1.04.52 1.43 1.4.32.73.5 1.7.5 2.94 0 1.3-.23 2.27-.6 2.7-.22.26-.44.31-.66.31h-.76zm-8.37-.01c-.2 0-.43-.06-.65-.3-.38-.44-.61-1.42-.61-2.73 0-1.16.17-2.1.48-2.82.38-.87.9-1.35 1.38-1.35.33 0 .73.35 1.5 1.36l1.46 1.86-1.44 1.88c-.77 1.01-1.2 1.36-1.5 1.36l-.62-.26z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Meta Ads</h2>
                  <p className="text-xs text-muted-foreground">{campanhasFiltradas.filter(c => c.plataforma === 'META').length} campanhas</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campanhasFiltradas.filter(c => c.plataforma === 'META').map(c => (
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
            </div>
          )}
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
