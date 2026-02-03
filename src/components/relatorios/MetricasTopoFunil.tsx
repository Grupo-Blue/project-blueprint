import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Eye, MousePointer, TrendingUp, DollarSign } from "lucide-react";

interface MetricasTopoFunilProps {
  impressoes: number;
  cliques: number;
  verba: number;
}

export function MetricasTopoFunil({ impressoes, cliques, verba }: MetricasTopoFunilProps) {
  const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
  const cpc = cliques > 0 ? verba / cliques : 0;

  const metricas = [
    {
      label: "Impressões",
      valor: impressoes.toLocaleString("pt-BR"),
      icon: <Eye className="h-4 w-4" />,
    },
    {
      label: "Cliques",
      valor: cliques.toLocaleString("pt-BR"),
      icon: <MousePointer className="h-4 w-4" />,
    },
    {
      label: "CTR Médio",
      valor: `${ctr.toFixed(2)}%`,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "CPC Médio",
      valor: formatCurrency(cpc),
      icon: <DollarSign className="h-4 w-4" />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Métricas de Topo de Funil</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricas.map((metrica) => (
            <div key={metrica.label} className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center mb-2 text-muted-foreground">
                {metrica.icon}
              </div>
              <p className="text-2xl font-bold">{metrica.valor}</p>
              <p className="text-xs text-muted-foreground">{metrica.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
