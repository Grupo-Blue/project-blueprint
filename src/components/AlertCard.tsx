import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AlertCardProps {
  empresa: string;
  tipo: "CPL" | "CAC";
  valorAtual: number;
  valorMaximo: number;
  diasConsecutivos?: number;
  semanasConsecutivas?: number;
}

export const AlertCard = ({
  empresa,
  tipo,
  valorAtual,
  valorMaximo,
  diasConsecutivos,
  semanasConsecutivas,
}: AlertCardProps) => {
  const percentualAcima = ((valorAtual - valorMaximo) / valorMaximo) * 100;
  const isCritico = percentualAcima > 50;

  return (
    <Alert variant={isCritico ? "destructive" : "default"} className="border-l-4">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span className="font-bold">{empresa}</span>
        <Badge variant={isCritico ? "destructive" : "secondary"}>
          {tipo} Acima da Meta
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Valor Atual:</span>
          <span className="font-bold">
            R$ {valorAtual.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Valor Máximo:</span>
          <span>R$ {valorMaximo.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Diferença:</span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +{percentualAcima.toFixed(1)}%
          </span>
        </div>
        {diasConsecutivos && (
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            Alerta ativo há {diasConsecutivos} dias consecutivos
          </div>
        )}
        {semanasConsecutivas && (
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            Alerta ativo há {semanasConsecutivas} semanas consecutivas
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
