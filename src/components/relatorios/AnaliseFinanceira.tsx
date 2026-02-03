import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Target, Wallet, PiggyBank } from "lucide-react";

interface AnaliseFinanceiraProps {
  verba: number;
  vendas: number;
  ticketMedio: number | null;
  cac: number | null;
}

export function AnaliseFinanceira({ verba, vendas, ticketMedio, cac }: AnaliseFinanceiraProps) {
  const receita = vendas * (ticketMedio || 0);
  const roas = verba > 0 ? receita / verba : 0;
  const roi = verba > 0 ? ((receita - verba) / verba) * 100 : 0;
  const lucroEstimado = receita - verba;

  const metricas = [
    {
      label: "Verba Investida",
      valor: formatCurrency(verba),
      icon: <Wallet className="h-5 w-5" />,
      cor: "text-blue-500",
    },
    {
      label: "Receita Gerada",
      valor: formatCurrency(receita),
      icon: <DollarSign className="h-5 w-5" />,
      cor: "text-green-500",
    },
    {
      label: "ROAS",
      valor: `${roas.toFixed(2)}x`,
      icon: roas >= 1 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
      cor: roas >= 1 ? "text-green-500" : "text-red-500",
    },
    {
      label: "ROI",
      valor: `${roi.toFixed(1)}%`,
      icon: roi >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
      cor: roi >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: "CAC",
      valor: cac ? formatCurrency(cac) : "N/A",
      icon: <Target className="h-5 w-5" />,
      cor: "text-orange-500",
    },
    {
      label: "Ticket Médio",
      valor: ticketMedio ? formatCurrency(ticketMedio) : "N/A",
      icon: <PiggyBank className="h-5 w-5" />,
      cor: "text-purple-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Análise Financeira</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metricas.map((metrica) => (
            <div key={metrica.label} className="p-4 bg-muted/50 rounded-lg">
              <div className={`flex items-center gap-2 mb-2 ${metrica.cor}`}>
                {metrica.icon}
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {metrica.label}
                </span>
              </div>
              <p className="text-xl font-bold">{metrica.valor}</p>
            </div>
          ))}
        </div>

        {/* Lucro Estimado em destaque */}
        <div className={`mt-4 p-4 rounded-lg border-2 ${lucroEstimado >= 0 ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-red-500 bg-red-50 dark:bg-red-950/20"}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">Lucro Bruto Estimado</span>
            <span className={`text-2xl font-bold ${lucroEstimado >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(lucroEstimado)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            (Receita - Verba Investida)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
