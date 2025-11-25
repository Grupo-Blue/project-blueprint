import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Building2
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmpresaMetrica {
  id_empresa: string;
  nome: string;
  verba_investida: number;
  leads_total: number;
  cpl: number;
  cac: number;
  vendas: number;
  cpl_maximo: number;
  cac_maximo: number;
}

export default function DashboardDirecao() {
  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-atual"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .lte("data_inicio", hoje)
        .gte("data_fim", hoje)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresa").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: metricas, isLoading } = useQuery({
    queryKey: ["metricas-direcao", semanaAtual?.id_semana],
    queryFn: async () => {
      if (!semanaAtual) return [];

      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select(`
          *,
          empresa:id_empresa (nome, cpl_maximo, cac_maximo)
        `)
        .eq("id_semana", semanaAtual.id_semana);

      if (error) throw error;
      
      return data.map((m: any) => ({
        id_empresa: m.id_empresa,
        nome: m.empresa.nome,
        verba_investida: m.verba_investida,
        leads_total: m.leads_total,
        cpl: m.cpl,
        cac: m.cac,
        vendas: m.vendas,
        cpl_maximo: m.empresa.cpl_maximo,
        cac_maximo: m.empresa.cac_maximo,
      })) as EmpresaMetrica[];
    },
    enabled: !!semanaAtual,
  });

  const { data: acoesAprovacao } = useQuery({
    queryKey: ["acoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acao")
        .select(`
          *,
          empresa:id_empresa (nome)
        `)
        .eq("status", "PENDENTE")
        .order("data_criacao", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const { data: ultimosAprendizados } = useQuery({
    queryKey: ["ultimos-aprendizados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aprendizado_semana")
        .select(`
          *,
          empresa:id_empresa (nome),
          semana:id_semana (numero_semana, ano)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const totais = metricas?.reduce(
    (acc, m) => ({
      verba: acc.verba + m.verba_investida,
      leads: acc.leads + m.leads_total,
      vendas: acc.vendas + m.vendas,
    }),
    { verba: 0, leads: 0, vendas: 0 }
  ) || { verba: 0, leads: 0, vendas: 0 };

  const cplMedio = totais.leads > 0 ? totais.verba / totais.leads : 0;
  const cacMedio = totais.vendas > 0 ? totais.verba / totais.vendas : 0;

  const alertas = metricas?.filter(
    (m) => (m.cpl && m.cpl > m.cpl_maximo) || (m.cac && m.cac > m.cac_maximo)
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard Direção</h1>
            <p className="text-muted-foreground mt-2">
              Visão executiva consolidada
              {semanaAtual && ` - Semana ${semanaAtual.numero_semana}/${semanaAtual.ano}`}
            </p>
          </div>
        </div>

        {/* Alertas Críticos */}
        {alertas.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Alertas Críticos ({alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id_empresa}
                  className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{alerta.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {alerta.cpl && alerta.cpl > alerta.cpl_maximo &&
                        `CPL: R$ ${alerta.cpl.toFixed(2)} (máximo: R$ ${alerta.cpl_maximo.toFixed(2)}) `}
                      {alerta.cac && alerta.cac > alerta.cac_maximo &&
                        `CAC: R$ ${alerta.cac.toFixed(2)} (máximo: R$ ${alerta.cac_maximo.toFixed(2)})`}
                    </p>
                  </div>
                  <Badge variant="destructive">Acima do limite</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Verba Investida</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totais.verba.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Consolidado de {empresas?.length || 0} empresas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leads Totais</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totais.leads}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CPL médio: R$ {cplMedio.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totais.vendas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CAC médio: R$ {cacMedio.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{empresas?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {alertas.length} com alertas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Métricas por Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metricas?.map((metrica) => (
                <div
                  key={metrica.id_empresa}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{metrica.nome}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Verba: R$ {metrica.verba_investida.toLocaleString("pt-BR")}</span>
                      <span>Leads: {metrica.leads_total}</span>
                      <span>Vendas: {metrica.vendas}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CPL: R$ {metrica.cpl?.toFixed(2) || "N/A"}
                      </p>
                      {metrica.cpl && metrica.cpl > metrica.cpl_maximo ? (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Acima do limite
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Dentro do limite
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        CAC: R$ {metrica.cac?.toFixed(2) || "N/A"}
                      </p>
                      {metrica.cac && metrica.cac > metrica.cac_maximo ? (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Acima do limite
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Dentro do limite
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ações Pendentes de Aprovação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ações Pendentes de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acoesAprovacao?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma ação pendente
                  </p>
                ) : (
                  acoesAprovacao?.map((acao: any) => (
                    <div
                      key={acao.id_acao}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{acao.tipo_acao}</p>
                          <p className="text-xs text-muted-foreground">{acao.empresa.nome}</p>
                          <p className="text-xs">
                            {format(new Date(acao.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge>{acao.categoria}</Badge>
                      </div>
                    </div>
                  ))
                )}
                <Link to="/aprovacoes">
                  <Button variant="outline" className="w-full">
                    Ver Todas as Aprovações
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Últimos Aprendizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Últimos Aprendizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ultimosAprendizados?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum aprendizado registrado
                  </p>
                ) : (
                  ultimosAprendizados?.map((aprendizado: any) => (
                    <div
                      key={aprendizado.id_aprendizado}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{aprendizado.empresa.nome}</p>
                          <Badge variant="outline" className="text-xs">
                            {aprendizado.tipo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {aprendizado.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Semana {aprendizado.semana.numero_semana}/{aprendizado.semana.ano}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <Link to="/aprendizados">
                  <Button variant="outline" className="w-full">
                    Ver Todos os Aprendizados
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
