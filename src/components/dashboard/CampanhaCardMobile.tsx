import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface CampanhaCardMobileProps {
  campanha: {
    id_campanha: string;
    nome: string;
    leads: number;
    verba_investida: number;
    cpl: number;
    reunioes: number;
    mqls: number;
    vendas: number;
    qtd_criativos?: number;
    qtd_criativos_ativos?: number;
    plataforma?: string;
    url_esperada?: string | null;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onVerFluxo?: () => void;
  renderCriativos?: () => React.ReactNode;
}

export function CampanhaCardMobile({ 
  campanha, 
  isExpanded, 
  onToggleExpand,
  onVerFluxo,
  renderCriativos
}: CampanhaCardMobileProps) {
  const hasAlerta = (campanha.qtd_criativos_ativos || 0) < 2;

  return (
    <Card className={cn(
      "overflow-hidden",
      hasAlerta && "border-l-4 border-l-amber-500"
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{campanha.nome}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {campanha.plataforma || "N/A"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {campanha.qtd_criativos || 0} ({campanha.qtd_criativos_ativos || 0} ativos)
                  </span>
                  {hasAlerta && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">
                  {campanha.cpl > 0 
                    ? `R$ ${campanha.cpl.toFixed(2)}` 
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">CPL</p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Leads</p>
                <p className="font-semibold">{campanha.leads}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">MQLs</p>
                <p className="font-semibold text-blue-600">{campanha.mqls}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Vendas</p>
                <p className="font-semibold text-green-600">{campanha.vendas}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Verba</p>
                <p className="font-semibold">R$ {campanha.verba_investida.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {/* Expanded: Criativos */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t space-y-2">
            <div className="flex items-center justify-between pt-3">
              <h4 className="font-semibold text-xs">Criativos</h4>
              {onVerFluxo && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onVerFluxo}>
                  Ver Fluxo
                </Button>
              )}
            </div>
            
            {renderCriativos ? renderCriativos() : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum criativo cadastrado
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
