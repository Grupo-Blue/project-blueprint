import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, ArrowRight, TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { subMonths, startOfMonth, endOfMonth, format, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePeriodo } from "@/contexts/PeriodoContext";

interface TempoCicloProps {
  empresaId: string;
}

interface LeadComDatas {
  id_lead: string;
  data_criacao: string;
  data_mql: string | null;
  data_levantou_mao: string | null;
  data_reuniao: string | null;
  data_venda: string | null;
  venda_realizada: boolean;
  is_mql: boolean;
  levantou_mao: boolean;
  tem_reuniao: boolean;
  reuniao_realizada: boolean;
}

const calcularMediana = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calcularMedia = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  return valores.reduce((sum, v) => sum + v, 0) / valores.length;
};

export const TempoCiclo = ({ empresaId }: TempoCicloProps) => {
  const { getDataReferencia } = usePeriodo();
  const dataReferencia = getDataReferencia();
  
  // Buscar leads dos últimos 3 meses com datas de transição
  const tresMesesAtras = subMonths(dataReferencia, 3);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-ciclo", empresaId, tresMesesAtras.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select("id_lead, data_criacao, data_mql, data_levantou_mao, data_reuniao, data_venda, venda_realizada, is_mql, levantou_mao, tem_reuniao, reuniao_realizada")
        .eq("id_empresa", empresaId)
        .gte("data_criacao", tresMesesAtras.toISOString())
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      return data as LeadComDatas[];
    },
    enabled: !!empresaId,
  });

  // Calcular tempos de ciclo
  const temposLeadMql: number[] = [];
  const temposMqlLevantada: number[] = [];
  const temposLevantadaReuniao: number[] = [];
  const temposReuniaoVenda: number[] = [];
  const temposLeadVenda: number[] = [];

  leads?.forEach(lead => {
    const dataCriacao = new Date(lead.data_criacao);
    
    // Lead → MQL (usando data_mql se disponível, senão estimativa se is_mql)
    if (lead.data_mql) {
      const dias = differenceInDays(new Date(lead.data_mql), dataCriacao);
      if (dias >= 0 && dias < 365) temposLeadMql.push(dias);
    }
    
    // MQL → Levantou Mão
    if (lead.data_mql && lead.data_levantou_mao) {
      const dias = differenceInDays(new Date(lead.data_levantou_mao), new Date(lead.data_mql));
      if (dias >= 0 && dias < 365) temposMqlLevantada.push(dias);
    }
    
    // Levantou Mão → Reunião
    if (lead.data_levantou_mao && lead.data_reuniao) {
      const dias = differenceInDays(new Date(lead.data_reuniao), new Date(lead.data_levantou_mao));
      if (dias >= 0 && dias < 365) temposLevantadaReuniao.push(dias);
    }
    
    // Reunião → Venda
    if (lead.data_reuniao && lead.data_venda && lead.venda_realizada) {
      const dias = differenceInDays(new Date(lead.data_venda), new Date(lead.data_reuniao));
      if (dias >= 0 && dias < 365) temposReuniaoVenda.push(dias);
    }
    
    // Lead → Venda (ciclo completo)
    if (lead.data_venda && lead.venda_realizada) {
      const dias = differenceInDays(new Date(lead.data_venda), dataCriacao);
      if (dias >= 0 && dias < 365) temposLeadVenda.push(dias);
    }
  });

  // Calcular medianas
  const medianaLeadMql = calcularMediana(temposLeadMql);
  const medianaMqlLevantada = calcularMediana(temposMqlLevantada);
  const medianaLevantadaReuniao = calcularMediana(temposLevantadaReuniao);
  const medianaReuniaoVenda = calcularMediana(temposReuniaoVenda);
  const medianaLeadVenda = calcularMediana(temposLeadVenda);

  // Dados do gráfico de barras
  const chartData = [
    { 
      etapa: "Lead→MQL", 
      dias: medianaLeadMql, 
      amostra: temposLeadMql.length,
      cor: "hsl(var(--chart-1))"
    },
    { 
      etapa: "MQL→Levantada", 
      dias: medianaMqlLevantada, 
      amostra: temposMqlLevantada.length,
      cor: "hsl(var(--chart-2))"
    },
    { 
      etapa: "Levantada→Reunião", 
      dias: medianaLevantadaReuniao, 
      amostra: temposLevantadaReuniao.length,
      cor: "hsl(var(--chart-3))"
    },
    { 
      etapa: "Reunião→Venda", 
      dias: medianaReuniaoVenda, 
      amostra: temposReuniaoVenda.length,
      cor: "hsl(var(--chart-4))"
    },
  ].filter(d => d.amostra > 0);

  // Ciclo total
  const cicloTotal = chartData.reduce((sum, d) => sum + d.dias, 0);

  // Verificar se temos dados suficientes
  const temDadosSuficientes = temposLeadVenda.length >= 3 || chartData.some(d => d.amostra >= 3);
  const temDatasTransicao = leads?.some(l => l.data_mql || l.data_levantou_mao || l.data_reuniao);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tempo de Ciclo de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Tempo de Ciclo de Vendas
        </CardTitle>
        <CardDescription>
          Mediana de dias entre etapas do funil (últimos 3 meses)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerta se não temos datas de transição */}
        {!temDatasTransicao && temposLeadVenda.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Datas de transição entre etapas ainda não capturadas. 
              Mostrando apenas ciclo Lead→Venda. As transições serão capturadas automaticamente 
              conforme deals mudam de stage no Pipedrive.
            </AlertDescription>
          </Alert>
        )}

        {/* Diagrama visual do funil */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-4 bg-muted/30 rounded-lg">
          <div className="text-center px-3">
            <div className="text-sm font-medium">Lead</div>
            <div className="text-xs text-muted-foreground">{leads?.length || 0}</div>
          </div>
          
          {temDatasTransicao ? (
            <>
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-primary">{medianaLeadMql.toFixed(0)}d</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="text-center px-3">
                <div className="text-sm font-medium">MQL</div>
                <div className="text-xs text-muted-foreground">{temposLeadMql.length}</div>
              </div>
              
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-primary">{medianaMqlLevantada.toFixed(0)}d</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="text-center px-3">
                <div className="text-sm font-medium">Levantada</div>
                <div className="text-xs text-muted-foreground">{temposMqlLevantada.length}</div>
              </div>
              
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-primary">{medianaLevantadaReuniao.toFixed(0)}d</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="text-center px-3">
                <div className="text-sm font-medium">Reunião</div>
                <div className="text-xs text-muted-foreground">{temposLevantadaReuniao.length}</div>
              </div>
              
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-primary">{medianaReuniaoVenda.toFixed(0)}d</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-primary">{medianaLeadVenda.toFixed(0)}d</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          
          <div className="text-center px-3">
            <div className="text-sm font-medium text-green-600">Venda</div>
            <div className="text-xs text-muted-foreground">{temposLeadVenda.length}</div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Ciclo Lead→Venda</div>
            <div className="text-2xl font-bold">{medianaLeadVenda.toFixed(0)}d</div>
            <div className="text-xs text-muted-foreground">
              mediana de {temposLeadVenda.length} vendas
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Média</div>
            <div className="text-2xl font-bold">{calcularMedia(temposLeadVenda).toFixed(0)}d</div>
            <div className="text-xs text-muted-foreground">
              (outliers incluídos)
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Mais Rápido</div>
            <div className="text-2xl font-bold">
              {temposLeadVenda.length > 0 ? Math.min(...temposLeadVenda).toFixed(0) : 0}d
            </div>
            <div className="text-xs text-muted-foreground">
              ciclo mínimo
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Mais Lento</div>
            <div className="text-2xl font-bold">
              {temposLeadVenda.length > 0 ? Math.max(...temposLeadVenda).toFixed(0) : 0}d
            </div>
            <div className="text-xs text-muted-foreground">
              ciclo máximo
            </div>
          </div>
        </div>

        {/* Gráfico de barras por etapa */}
        {chartData.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}d`}
                />
                <YAxis 
                  type="category" 
                  dataKey="etapa" 
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)} dias (${props.payload.amostra} transições)`,
                    "Mediana"
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Alerta se ciclo está muito longo */}
        {medianaLeadVenda > 30 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Ciclo de vendas de {medianaLeadVenda.toFixed(0)} dias está acima do esperado. 
              Considere revisar o processo de qualificação e follow-up para acelerar conversões.
            </AlertDescription>
          </Alert>
        )}

        {/* Sem dados suficientes */}
        {!temDadosSuficientes && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Dados insuficientes para análise de ciclo de vendas. 
              São necessárias pelo menos 3 vendas concluídas para calcular a mediana.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
