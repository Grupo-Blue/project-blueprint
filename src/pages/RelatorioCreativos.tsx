import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, TrendingUp, DollarSign, Users, Target, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CriativoPerformance {
  id_criativo: string;
  id_criativo_externo: string;
  descricao: string | null;
  tipo: string;
  campanha_nome: string;
  total_leads: number;
  mqls: number;
  reunioes: number;
  vendas: number;
  valor_total_vendas: number;
  taxa_conversao_mql: number;
  taxa_conversao_venda: number;
  cpl_estimado: number;
}

const RelatorioCreativos = () => {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas");
  const [criativoSelecionado, setCriativoSelecionado] = useState<string | null>(null);
  
  // Query para buscar leads do criativo selecionado
  const { data: leadsDetalhados } = useQuery({
    queryKey: ["leads-criativo", criativoSelecionado],
    queryFn: async () => {
      if (!criativoSelecionado) return [];
      
      const { data, error } = await supabase
        .from("lead")
        .select("*")
        .eq("id_criativo", criativoSelecionado)
        .order("data_criacao", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!criativoSelecionado,
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: criativos, isLoading } = useQuery({
    queryKey: ["criativos-performance", empresaSelecionada],
    queryFn: async () => {
      // Query para buscar performance de criativos
      let query = supabase
        .from("criativo")
        .select(`
          id_criativo,
          id_criativo_externo,
          descricao,
          tipo,
          campanha:id_campanha (
            nome,
            conta_anuncio:id_conta (id_empresa)
          ),
          lead:lead!id_criativo (
            id_lead,
            is_mql,
            tem_reuniao,
            venda_realizada,
            valor_venda
          )
        `)
        .eq("ativo", true);

      const { data, error } = await query;
      if (error) throw error;

      // Buscar métricas de investimento de todos os criativos
      const { data: metricasData, error: metricasError } = await supabase
        .from("criativo_metricas_dia")
        .select("id_criativo, verba_investida, leads");

      if (metricasError) {
        console.error("Erro ao buscar métricas:", metricasError);
      }

      // Agrupar métricas por criativo
      const metricasPorCriativo = (metricasData || []).reduce((acc: any, m: any) => {
        if (!acc[m.id_criativo]) {
          acc[m.id_criativo] = { verba_total: 0, leads_total: 0 };
        }
        acc[m.id_criativo].verba_total += parseFloat(m.verba_investida || 0);
        acc[m.id_criativo].leads_total += parseInt(m.leads || 0);
        return acc;
      }, {});

      // Processar dados para calcular métricas
      const performance: CriativoPerformance[] = (data || [])
        .map((c: any) => {
          const leads = c.lead || [];
          
          // Filtrar por empresa se necessário
          if (empresaSelecionada !== "todas") {
            const empresaDoCriativo = c.campanha?.conta_anuncio?.id_empresa;
            if (empresaDoCriativo !== empresaSelecionada) {
              return null;
            }
          }

          const totalLeads = leads.length;
          const mqls = leads.filter((l: any) => l.is_mql).length;
          const reunioes = leads.filter((l: any) => l.tem_reuniao).length;
          const vendas = leads.filter((l: any) => l.venda_realizada).length;
          const valorTotalVendas = leads.reduce((sum: number, l: any) => sum + (l.valor_venda || 0), 0);

          // Calcular CPL com base nas métricas reais
          const metricas = metricasPorCriativo[c.id_criativo];
          const cplEstimado = metricas?.verba_total && metricas.leads_total > 0
            ? metricas.verba_total / metricas.leads_total
            : 0;

          return {
            id_criativo: c.id_criativo,
            id_criativo_externo: c.id_criativo_externo,
            descricao: c.descricao,
            tipo: c.tipo,
            campanha_nome: c.campanha?.nome || "Campanha não identificada",
            total_leads: totalLeads,
            mqls,
            reunioes,
            vendas,
            valor_total_vendas: valorTotalVendas,
            taxa_conversao_mql: totalLeads > 0 ? (mqls / totalLeads) * 100 : 0,
            taxa_conversao_venda: mqls > 0 ? (vendas / mqls) * 100 : 0,
            cpl_estimado: cplEstimado,
          };
        })
        .filter((c): c is CriativoPerformance => c !== null)
        .filter((c) => c.total_leads > 0) // Mostrar apenas criativos com leads
        .sort((a, b) => b.total_leads - a.total_leads);

      return performance;
    },
  });

  // Calcular estatísticas gerais
  const stats = {
    totalCreativos: criativos?.length || 0,
    totalLeads: criativos?.reduce((sum, c) => sum + c.total_leads, 0) || 0,
    totalVendas: criativos?.reduce((sum, c) => sum + c.vendas, 0) || 0,
    valorTotal: criativos?.reduce((sum, c) => sum + c.valor_total_vendas, 0) || 0,
    taxaMediaConversao: criativos?.length 
      ? (criativos.reduce((sum, c) => sum + c.taxa_conversao_venda, 0) / criativos.length).toFixed(1)
      : "0",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Performance de Criativos</h1>
          <p className="text-muted-foreground">
            Análise detalhada de performance por criativo de anúncio
          </p>
        </div>
        <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Empresas</SelectItem>
            {empresas?.map((empresa) => (
              <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                {empresa.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Criativos Ativos</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCreativos}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Com conversão de leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gerados pelos criativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Fechadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVendas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa média: {stats.taxaMediaConversao}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }).format(stats.valorTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita gerada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Detalhada por Criativo</CardTitle>
          <CardDescription>
            Métricas de conversão e resultados de cada criativo de anúncio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!criativos || criativos.length === 0 ? (
            <div className="text-center py-12">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum criativo com leads rastreados ainda.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Configure UTM parameters nos seus anúncios para começar o rastreamento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criativo</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">MQLs</TableHead>
                    <TableHead className="text-center">Reuniões</TableHead>
                    <TableHead className="text-center">Vendas</TableHead>
                    <TableHead className="text-center">CPL</TableHead>
                    <TableHead className="text-center">Taxa Conv.</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criativos.map((criativo) => (
                    <TableRow key={criativo.id_criativo}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {criativo.descricao || criativo.id_criativo_externo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ID: {criativo.id_criativo_externo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {criativo.campanha_nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{criativo.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {criativo.total_leads}
                      </TableCell>
                      <TableCell className="text-center">
                        {criativo.mqls}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({criativo.taxa_conversao_mql.toFixed(0)}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {criativo.reunioes}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-green-600">
                          {criativo.vendas}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {criativo.cpl_estimado > 0 ? (
                          <span className="font-mono text-sm">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(criativo.cpl_estimado)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">
                            {criativo.taxa_conversao_venda.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(criativo.valor_total_vendas)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCriativoSelecionado(criativo.id_criativo)}
                          disabled={criativo.total_leads === 0}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Leads
                          <Badge variant="secondary" className="ml-1">
                            {criativo.total_leads}
                          </Badge>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle>Como configurar o rastreamento de criativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Configure UTM Parameters nos anúncios</h4>
            <p className="text-sm text-muted-foreground">
              Adicione parâmetros UTM nas URLs de destino dos seus anúncios:
            </p>
            <code className="block mt-2 p-3 bg-muted rounded text-xs">
              ?utm_source=facebook&utm_medium=paid&utm_campaign=campanha123&utm_content=criativo_456
            </code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">2. Configure campos customizados no Pipedrive</h4>
            <p className="text-sm text-muted-foreground">
              Crie campos customizados no Pipedrive para capturar: utm_source, utm_medium, utm_campaign, utm_content, utm_term
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">3. Vincule o ID do criativo</h4>
            <p className="text-sm text-muted-foreground">
              Use o campo <code className="bg-muted px-1">utm_content</code> para enviar o ID externo do criativo cadastrado no sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para mostrar leads do criativo */}
      <Dialog open={!!criativoSelecionado} onOpenChange={(open) => !open && setCriativoSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leads do Criativo</DialogTitle>
            <DialogDescription>
              {criativos?.find(c => c.id_criativo === criativoSelecionado)?.descricao || 
               criativos?.find(c => c.id_criativo === criativoSelecionado)?.id_criativo_externo}
            </DialogDescription>
          </DialogHeader>
          
          {leadsDetalhados && leadsDetalhados.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsDetalhados.map((lead) => (
                    <TableRow key={lead.id_lead}>
                      <TableCell>{lead.nome_lead || "Sem nome"}</TableCell>
                      <TableCell>{lead.organizacao || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {lead.is_mql && <Badge variant="secondary">MQL</Badge>}
                          {lead.tem_reuniao && <Badge variant="outline">Reunião</Badge>}
                          {lead.venda_realizada && <Badge className="bg-green-600">Venda</Badge>}
                          {!lead.is_mql && !lead.tem_reuniao && !lead.venda_realizada && (
                            <Badge variant="outline">Lead</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(lead.data_criacao).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {lead.valor_venda
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(lead.valor_venda)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.url_pipedrive && (
                          <a
                            href={lead.url_pipedrive}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado para este criativo.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioCreativos;
