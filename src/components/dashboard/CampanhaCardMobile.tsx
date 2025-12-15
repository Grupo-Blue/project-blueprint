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

// Ícone Meta (Facebook)
const MetaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z"/>
  </svg>
);

// Ícone Google
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Helper para obter ícone da plataforma
const getPlataformaIcon = (plataforma?: string) => {
  if (plataforma === "META") {
    return <MetaIcon className="h-4 w-4 text-[#1877F2]" />;
  } else if (plataforma === "GOOGLE") {
    return <GoogleIcon className="h-4 w-4" />;
  }
  return null;
};

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
                  {getPlataformaIcon(campanha.plataforma)}
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
