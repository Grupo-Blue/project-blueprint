import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend 
} from "recharts";
import { Bitcoin, Building2, Car, TrendingUp, Wallet, Target, Users } from "lucide-react";

interface Props {
  empresaSelecionada: string;
}

export function IRPFDashboardInsights({ empresaSelecionada }: Props) {
  const { data: bens } = useQuery({
    queryKey: ['irpf-all-bens', empresaSelecionada],
    queryFn: async () => {
      const { data: declaracoes } = await supabase
        .from('irpf_declaracao')
        .select('id')
        .eq('id_empresa', empresaSelecionada)
        .eq('status_processamento', 'concluido');

      if (!declaracoes?.length) return [];

      const ids = declaracoes.map(d => d.id);
      const { data, error } = await supabase
        .from('irpf_bem_direito')
        .select('*')
        .in('id_declaracao', ids);

      if (error) throw error;
      return data;
    },
    enabled: !!empresaSelecionada,
  });

  const { data: evolucao } = useQuery({
    queryKey: ['irpf-evolucao', empresaSelecionada],
    queryFn: async () => {
      const { data: declaracoes } = await supabase
        .from('irpf_declaracao')
        .select('id')
        .eq('id_empresa', empresaSelecionada)
        .eq('status_processamento', 'concluido');

      if (!declaracoes?.length) return [];

      const ids = declaracoes.map(d => d.id);
      const { data, error } = await supabase
        .from('irpf_evolucao_patrimonial')
        .select('*')
        .in('id_declaracao', ids);

      if (error) throw error;
      return data;
    },
    enabled: !!empresaSelecionada,
  });

  const { data: declaracoesCount } = useQuery({
    queryKey: ['irpf-declaracoes-count', empresaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_declaracao')
        .select('id, cpf')
        .eq('id_empresa', empresaSelecionada)
        .eq('status_processamento', 'concluido');

      if (error) throw error;
      return data;
    },
    enabled: !!empresaSelecionada,
  });

  // Calcular distribuição de patrimônio por grupo
  const distribuicaoPatrimonio = (() => {
    if (!bens?.length) return [];

    const grupos: Record<string, { nome: string; valor: number; cor: string; icone: React.ReactNode }> = {
      '01': { nome: 'Imóveis', valor: 0, cor: 'hsl(var(--chart-1))', icone: <Building2 className="w-4 h-4" /> },
      '02': { nome: 'Veículos', valor: 0, cor: 'hsl(var(--chart-2))', icone: <Car className="w-4 h-4" /> },
      '03': { nome: 'Participações', valor: 0, cor: 'hsl(var(--chart-3))', icone: <Target className="w-4 h-4" /> },
      '04': { nome: 'Aplicações', valor: 0, cor: 'hsl(var(--chart-4))', icone: <Wallet className="w-4 h-4" /> },
      '06': { nome: 'Depósitos', valor: 0, cor: 'hsl(var(--chart-5))', icone: <Wallet className="w-4 h-4" /> },
      '07': { nome: 'Fundos', valor: 0, cor: 'hsl(215, 70%, 50%)', icone: <TrendingUp className="w-4 h-4" /> },
      '08': { nome: 'Criptoativos', valor: 0, cor: 'hsl(30, 90%, 50%)', icone: <Bitcoin className="w-4 h-4" /> },
    };

    bens.forEach(bem => {
      const grupo = grupos[bem.grupo_codigo];
      if (grupo) {
        grupo.valor += bem.valor_ano_atual || 0;
      }
    });

    return Object.entries(grupos)
      .filter(([_, g]) => g.valor > 0)
      .map(([codigo, g]) => ({
        ...g,
        codigo,
        percentual: 0,
      }));
  })();

  const totalPatrimonio = distribuicaoPatrimonio.reduce((sum, g) => sum + g.valor, 0);
  distribuicaoPatrimonio.forEach(g => {
    g.percentual = totalPatrimonio > 0 ? (g.valor / totalPatrimonio) * 100 : 0;
  });

  // Clientes com criptoativos
  const clientesComCripto = (() => {
    if (!bens?.length) return { total: 0, percentual: 0, valor: 0 };
    
    const declaracoesComCripto = new Set(
      bens.filter(b => b.grupo_codigo === '08').map(b => b.id_declaracao)
    );
    const totalDeclaracoes = new Set(bens.map(b => b.id_declaracao)).size;
    const valorCripto = bens
      .filter(b => b.grupo_codigo === '08')
      .reduce((sum, b) => sum + (b.valor_ano_atual || 0), 0);

    return {
      total: declaracoesComCripto.size,
      percentual: totalDeclaracoes > 0 ? (declaracoesComCripto.size / totalDeclaracoes) * 100 : 0,
      valor: valorCripto,
    };
  })();

  // Evolução patrimonial agregada
  const evolucaoAgregada = (() => {
    if (!evolucao?.length) return { anterior: 0, atual: 0, variacao: 0, percentual: 0 };
    
    const anterior = evolucao.reduce((sum, e) => sum + (e.patrimonio_liquido_anterior || 0), 0);
    const atual = evolucao.reduce((sum, e) => sum + (e.patrimonio_liquido_atual || 0), 0);
    const variacao = atual - anterior;
    const percentual = anterior > 0 ? (variacao / anterior) * 100 : 0;

    return { anterior, atual, variacao, percentual };
  })();

  // Perfis de investidor
  const perfisInvestidor = (() => {
    if (!bens?.length) return [];

    const declaracoesPerfil: Record<string, { imoveis: number; acoes: number; cripto: number; rf: number }> = {};

    bens.forEach(bem => {
      const decId = bem.id_declaracao;
      if (!declaracoesPerfil[decId]) {
        declaracoesPerfil[decId] = { imoveis: 0, acoes: 0, cripto: 0, rf: 0 };
      }

      const valor = bem.valor_ano_atual || 0;
      if (bem.grupo_codigo === '01') declaracoesPerfil[decId].imoveis += valor;
      else if (bem.grupo_codigo === '03') declaracoesPerfil[decId].acoes += valor;
      else if (bem.grupo_codigo === '08') declaracoesPerfil[decId].cripto += valor;
      else if (['04', '06', '07'].includes(bem.grupo_codigo)) declaracoesPerfil[decId].rf += valor;
    });

    let conservador = 0, moderado = 0, arrojado = 0;

    Object.values(declaracoesPerfil).forEach(perfil => {
      const total = perfil.imoveis + perfil.acoes + perfil.cripto + perfil.rf;
      if (total === 0) return;

      const pctRV = ((perfil.acoes + perfil.cripto) / total) * 100;

      if (pctRV < 20) conservador++;
      else if (pctRV < 50) moderado++;
      else arrojado++;
    });

    return [
      { nome: 'Conservador', valor: conservador, cor: 'hsl(142, 70%, 45%)' },
      { nome: 'Moderado', valor: moderado, cor: 'hsl(48, 90%, 50%)' },
      { nome: 'Arrojado', valor: arrojado, cor: 'hsl(0, 70%, 50%)' },
    ];
  })();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const totalClientes = new Set(declaracoesCount?.map(d => d.cpf)).size;

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Patrimônio Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPatrimonio)}</p>
              </div>
              <Wallet className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Únicos</p>
                <p className="text-2xl font-bold">{totalClientes}</p>
              </div>
              <Users className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Criptoativos</p>
                <p className="text-2xl font-bold">{clientesComCripto.total}</p>
                <p className="text-xs text-muted-foreground">
                  {clientesComCripto.percentual.toFixed(1)}% do total
                </p>
              </div>
              <Bitcoin className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Evolução Patrimonial</p>
                <p className={`text-2xl font-bold ${evolucaoAgregada.variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {evolucaoAgregada.percentual >= 0 ? '+' : ''}{evolucaoAgregada.percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(evolucaoAgregada.variacao)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribuição de Patrimônio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Patrimônio</CardTitle>
          </CardHeader>
          <CardContent>
            {distribuicaoPatrimonio.length > 0 ? (
              <div className="flex gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={distribuicaoPatrimonio}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="valor"
                    >
                      {distribuicaoPatrimonio.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {distribuicaoPatrimonio.map((item) => (
                    <div key={item.codigo} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.cor }}
                      />
                      <span className="text-sm flex-1">{item.nome}</span>
                      <span className="text-sm font-medium">
                        {item.percentual.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado disponível
              </p>
            )}
          </CardContent>
        </Card>

        {/* Perfis de Investidor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Perfis de Investidor</CardTitle>
          </CardHeader>
          <CardContent>
            {perfisInvestidor.some(p => p.valor > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={perfisInvestidor} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nome" width={100} />
                  <Tooltip 
                    formatter={(value: number) => [`${value} clientes`, 'Quantidade']}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {perfisInvestidor.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado disponível
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Oportunidades de Cross-sell */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Oportunidades de Cross-sell</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <Bitcoin className="w-5 h-5 text-orange-600" />
                <span className="font-medium">Declaração de Cripto</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {clientesComCripto.total} clientes
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(clientesComCripto.valor)} em criptoativos declarados
              </p>
              <Badge className="mt-2 bg-orange-500">Oportunidade Blue</Badge>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Ganho de Capital</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {distribuicaoPatrimonio.find(d => d.codigo === '01')?.valor ? 
                  Math.round((distribuicaoPatrimonio.find(d => d.codigo === '01')?.valor || 0) / 1000000) : 0}M
              </p>
              <p className="text-sm text-muted-foreground">
                em imóveis declarados
              </p>
              <Badge className="mt-2 bg-blue-500">Potencial GCAP</Badge>
            </div>

            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Planejamento Tributário</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {perfisInvestidor.find(p => p.nome === 'Arrojado')?.valor || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                investidores arrojados
              </p>
              <Badge className="mt-2 bg-purple-500">Alta complexidade</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
