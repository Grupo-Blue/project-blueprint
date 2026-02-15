import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { startOfMonth, endOfMonth, format, getDaysInMonth, getDate, eachDayOfInterval, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePeriodo } from "@/contexts/PeriodoContext";

interface PacingOrcamentoProps {
  empresaId: string;
}

export const PacingOrcamento = ({ empresaId }: PacingOrcamentoProps) => {
  const { getDataReferencia } = usePeriodo();
  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);
  const diasNoMes = getDaysInMonth(dataReferencia);
  const diaAtual = getDate(new Date());
  const isCurrentMonth = format(new Date(), "yyyy-MM") === format(dataReferencia, "yyyy-MM");

  // Buscar meta de verba da empresa
  const { data: empresa } = useQuery({
    queryKey: ["empresa-meta-verba", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("nome, meta_verba_mensal")
        .eq("id_empresa", empresaId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh a cada 10 minutos
  });

  // Buscar métricas diárias do período
  const { data: metricasDiarias } = useQuery({
    queryKey: ["metricas-diarias-pacing", empresaId, inicioMes.toISOString()],
    queryFn: async () => {
      // Buscar campanhas da empresa
      const { data: contas } = await supabase
        .from("conta_anuncio")
        .select("id_conta")
        .eq("id_empresa", empresaId);

      if (!contas || contas.length === 0) return [];

      const { data: campanhas } = await supabase
        .from("campanha")
        .select("id_campanha")
        .in("id_conta", contas.map(c => c.id_conta));

      if (!campanhas || campanhas.length === 0) return [];

      const { data, error } = await supabase
        .from("campanha_metricas_dia")
        .select("data, verba_investida")
        .in("id_campanha", campanhas.map(c => c.id_campanha))
        .like("fonte_conversoes", "METRICOOL_%_DAILY")
        .gte("data", format(inicioMes, "yyyy-MM-dd"))
        .lte("data", format(fimMes, "yyyy-MM-dd"))
        .order("data");

      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh a cada 10 minutos
  });

  const metaMensal = empresa?.meta_verba_mensal || 0;
  
  // Agrupar gastos por dia e calcular acumulado
  const gastosPorDia = metricasDiarias?.reduce((acc, m) => {
    const dia = m.data;
    acc[dia] = (acc[dia] || 0) + Number(m.verba_investida);
    return acc;
  }, {} as Record<string, number>) || {};

  // Calcular gasto total acumulado
  const gastoTotal = Object.values(gastosPorDia).reduce((sum, v) => sum + v, 0);

  // Gerar dados para o gráfico
  const dias = eachDayOfInterval({ start: inicioMes, end: fimMes });
  let acumulado = 0;
  const chartData = dias.map((dia, index) => {
    const diaFormatado = format(dia, "yyyy-MM-dd");
    const gastoDia = gastosPorDia[diaFormatado] || 0;
    acumulado += gastoDia;
    
    const metaIdeal = (metaMensal / diasNoMes) * (index + 1);
    const diaNumero = index + 1;
    
    // Só mostrar dados até hoje se for o mês atual
    const mostrarDado = !isCurrentMonth || diaNumero <= diaAtual;
    
    return {
      dia: format(dia, "dd"),
      diaCompleto: format(dia, "dd/MM"),
      gasto: mostrarDado ? acumulado : null,
      meta: metaIdeal,
      gastoDia: mostrarDado ? gastoDia : null,
    };
  });

  // Cálculos de pacing
  const ritmoIdeal = (metaMensal / diasNoMes) * (isCurrentMonth ? diaAtual : diasNoMes);
  const projecaoFimMes = isCurrentMonth && diaAtual > 0 
    ? (gastoTotal / diaAtual) * diasNoMes 
    : gastoTotal;
  const percentualMeta = metaMensal > 0 ? (gastoTotal / metaMensal) * 100 : 0;
  const diferencaRitmo = gastoTotal - ritmoIdeal;
  const percentualRitmo = ritmoIdeal > 0 ? (gastoTotal / ritmoIdeal) * 100 : 0;

  // Status do pacing
  type StatusType = "on_track" | "below" | "above" | "critical";
  let status: StatusType = "on_track";
  let statusLabel = "No ritmo";
  let StatusIcon = CheckCircle;
  let statusColor = "text-green-500";

  if (percentualRitmo < 70) {
    status = "critical";
    statusLabel = "Muito abaixo do ritmo";
    StatusIcon = AlertTriangle;
    statusColor = "text-red-500";
  } else if (percentualRitmo < 90) {
    status = "below";
    statusLabel = "Abaixo do ritmo";
    StatusIcon = TrendingDown;
    statusColor = "text-yellow-500";
  } else if (percentualRitmo > 110) {
    status = "above";
    statusLabel = "Acima do orçamento";
    StatusIcon = TrendingUp;
    statusColor = "text-orange-500";
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (!metaMensal || metaMensal === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pacing de Orçamento
          </CardTitle>
          <CardDescription>
            Acompanhamento de gasto vs meta mensal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Meta de verba mensal não configurada para esta empresa. 
              Configure na página de Empresas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Pacing de Orçamento - {format(dataReferencia, "MMMM yyyy", { locale: ptBR })}
        </CardTitle>
        <CardDescription>
          Acompanhamento de gasto vs meta mensal de {formatCurrency(metaMensal)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="bg-muted/50 p-2 md:p-4 rounded-lg">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Gasto Atual</div>
            <div className="text-base md:text-2xl font-bold">{formatCurrency(gastoTotal)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">
              {percentualMeta.toFixed(1)}% da meta
            </div>
          </div>
          
          <div className="bg-muted/50 p-2 md:p-4 rounded-lg">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Ritmo Ideal</div>
            <div className="text-base md:text-2xl font-bold">{formatCurrency(ritmoIdeal)}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">
              Dia {isCurrentMonth ? diaAtual : diasNoMes}/{diasNoMes}
            </div>
          </div>
          
          <div className="bg-muted/50 p-2 md:p-4 rounded-lg">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Projeção</div>
            <div className="text-base md:text-2xl font-bold">{formatCurrency(projecaoFimMes)}</div>
            <div className={`text-[10px] md:text-xs ${projecaoFimMes > metaMensal ? "text-orange-500" : projecaoFimMes < metaMensal * 0.8 ? "text-yellow-500" : "text-green-500"}`}>
              {projecaoFimMes > metaMensal ? "Acima" : projecaoFimMes < metaMensal * 0.8 ? "Abaixo" : "Dentro"}
            </div>
          </div>
          
          <div className="bg-muted/50 p-2 md:p-4 rounded-lg">
            <div className="text-xs md:text-sm text-muted-foreground mb-1">Status</div>
            <div className={`text-sm md:text-xl font-bold flex items-center gap-1 md:gap-2 ${statusColor}`}>
              <StatusIcon className="h-4 w-4 md:h-5 md:w-5" />
              <span className="truncate">{statusLabel}</span>
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground truncate">
              {diferencaRitmo >= 0 ? "+" : ""}{formatCurrency(diferencaRitmo)}
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso do orçamento</span>
            <span className="font-medium">{percentualMeta.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(percentualMeta, 100)} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>R$ 0</span>
            <span>{formatCurrency(metaMensal)}</span>
          </div>
        </div>

        {/* Gráfico de linha */}
        <div className="h-48 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dia" 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                className="text-muted-foreground"
                width={40}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Dia ${label}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <ReferenceLine 
                y={metaMensal} 
                stroke="hsl(var(--destructive))" 
                strokeDasharray="5 5" 
              />
              <Line 
                type="monotone" 
                dataKey="meta" 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3"
                dot={false}
                name="Ritmo Ideal"
              />
              <Line 
                type="monotone" 
                dataKey="gasto" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                name="Gasto Acumulado"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Alertas baseados no status */}
        {status === "critical" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Gasto muito abaixo do esperado ({percentualRitmo.toFixed(0)}% do ritmo ideal). 
              Verifique se há problemas nas campanhas ou se a meta precisa ser ajustada.
            </AlertDescription>
          </Alert>
        )}
        
        {status === "above" && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Gasto acima do ritmo planejado. Projeção de {formatCurrency(projecaoFimMes)} 
              para o fim do mês ({((projecaoFimMes / metaMensal) * 100).toFixed(0)}% da meta).
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
