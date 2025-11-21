import { AlertTriangle, Image } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface CriativoAlertCardProps {
  campanha: string;
  criativosAtivos: number;
  empresa?: string;
}

export const CriativoAlertCard = ({
  campanha,
  criativosAtivos,
  empresa,
}: CriativoAlertCardProps) => {
  const isCritico = criativosAtivos === 0;

  return (
    <Alert variant={isCritico ? "destructive" : "default"} className="border-l-4">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span className="font-bold">{campanha}</span>
        <Badge variant={isCritico ? "destructive" : "secondary"}>
          {criativosAtivos} {criativosAtivos === 1 ? "Criativo" : "Criativos"} Ativo{criativosAtivos !== 1 ? "s" : ""}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        {empresa && (
          <div className="text-sm">
            <span className="font-medium">Empresa:</span> {empresa}
          </div>
        )}
        <div className="text-sm">
          {isCritico ? (
            <span className="font-medium text-destructive">
              ⚠️ Nenhum criativo ativo - campanha pode estar pausada ou sem material
            </span>
          ) : (
            <span className="font-medium">
              ⚠️ Apenas {criativosAtivos} criativo ativo - recomenda-se ter pelo menos 2 criativos para teste A/B
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
          <div className="flex items-center gap-1">
            <Image className="h-3 w-3" />
            <span>Adicione mais criativos para melhorar a performance da campanha</span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
