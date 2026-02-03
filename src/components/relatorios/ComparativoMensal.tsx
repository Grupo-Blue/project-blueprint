import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MetricaComparativa {
  label: string;
  valorAtual: number | null;
  valorAnterior: number | null;
  formato: "currency" | "number" | "percent";
  inverterCor?: boolean; // true para métricas onde menor é melhor (CPL, CAC)
}

interface ComparativoMensalProps {
  metricas: MetricaComparativa[];
}

export function ComparativoMensal({ metricas }: ComparativoMensalProps) {
  const calcularVariacao = (atual: number | null, anterior: number | null): number | null => {
    if (!atual || !anterior || anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const formatarValor = (valor: number | null, formato: string): string => {
    if (valor === null || valor === undefined) return "N/A";
    
    switch (formato) {
      case "currency":
        return formatCurrency(valor);
      case "percent":
        return `${valor.toFixed(1)}%`;
      case "number":
      default:
        return valor.toLocaleString("pt-BR");
    }
  };

  const getTendenciaInfo = (
    variacao: number | null,
    inverterCor: boolean = false
  ): { icon: React.ReactNode; cor: string; texto: string } => {
    if (variacao === null) {
      return {
        icon: <Minus className="h-4 w-4" />,
        cor: "text-muted-foreground",
        texto: "N/A",
      };
    }

    const positivo = variacao > 0;
    const corPositiva = inverterCor ? "text-red-500" : "text-green-500";
    const corNegativa = inverterCor ? "text-green-500" : "text-red-500";

    if (Math.abs(variacao) < 1) {
      return {
        icon: <Minus className="h-4 w-4" />,
        cor: "text-muted-foreground",
        texto: "0%",
      };
    }

    return {
      icon: positivo ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      ),
      cor: positivo ? corPositiva : corNegativa,
      texto: `${positivo ? "+" : ""}${variacao.toFixed(1)}%`,
    };
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricas.map((metrica) => {
        const variacao = calcularVariacao(metrica.valorAtual, metrica.valorAnterior);
        const tendencia = getTendenciaInfo(variacao, metrica.inverterCor);

        return (
          <Card key={metrica.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {metrica.label}
              </p>
              <p className="text-2xl font-bold mt-1">
                {formatarValor(metrica.valorAtual, metrica.formato)}
              </p>
              <div className={`flex items-center gap-1 mt-1 ${tendencia.cor}`}>
                {tendencia.icon}
                <span className="text-sm font-medium">{tendencia.texto}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mês anterior: {formatarValor(metrica.valorAnterior, metrica.formato)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
