import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, ImageOff, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AlertaRelatorio {
  tipo: "cpl_alto" | "sem_leads" | "sem_imagem" | "verba_alta";
  severidade: "warning" | "error";
  titulo: string;
  descricao: string;
  valor?: number;
  entidade?: string;
}

interface AlertasRelatorioProps {
  alertas: AlertaRelatorio[];
}

export function AlertasRelatorio({ alertas }: AlertasRelatorioProps) {
  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "cpl_alto":
        return <TrendingDown className="h-4 w-4" />;
      case "sem_leads":
        return <DollarSign className="h-4 w-4" />;
      case "sem_imagem":
        return <ImageOff className="h-4 w-4" />;
      case "verba_alta":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeveridadeCor = (severidade: string) => {
    switch (severidade) {
      case "error":
        return "border-red-500 bg-red-50 dark:bg-red-950/20";
      case "warning":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
      default:
        return "border-muted";
    }
  };

  const getBadgeVariant = (severidade: string) => {
    switch (severidade) {
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (alertas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            Alertas e Problemas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ✅ Nenhum problema detectado no período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Alertas e Problemas ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.map((alerta, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-l-4 ${getSeveridadeCor(alerta.severidade)}`}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{getIcon(alerta.tipo)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{alerta.titulo}</span>
                  <Badge variant={getBadgeVariant(alerta.severidade) as any}>
                    {alerta.severidade === "error" ? "Crítico" : "Atenção"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {alerta.descricao}
                </p>
                {alerta.entidade && (
                  <p className="text-xs text-muted-foreground mt-1">
                    → {alerta.entidade}
                  </p>
                )}
                {alerta.valor !== undefined && (
                  <p className="text-xs font-medium mt-1">
                    Valor: {formatCurrency(alerta.valor)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
