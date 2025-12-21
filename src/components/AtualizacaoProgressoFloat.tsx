import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FaseExecucao {
  nome: string;
  jobs: string[];
  status: "pendente" | "executando" | "concluido" | "erro";
  duracao_ms?: number;
  erro?: string;
}

interface AtualizacaoProgressoFloatProps {
  empresaNome: string;
  fases: FaseExecucao[];
  duracaoTotal?: number;
  concluido: boolean;
  sucesso: boolean;
  erro?: string;
  onClose: () => void;
}

const FASES_INICIAIS: FaseExecucao[] = [
  { nome: "Importar Campanhas", jobs: ["importar-campanhas-meta", "importar-campanhas-google"], status: "pendente" },
  { nome: "Coletar Métricas", jobs: ["coletar-metricas-meta", "coletar-metricas-google"], status: "pendente" },
  { nome: "Coletar Criativos", jobs: ["coletar-criativos-meta", "coletar-criativos-google"], status: "pendente" },
  { nome: "Sincronizar Leads", jobs: ["sincronizar-pipedrive", "vincular-leads-criativos"], status: "pendente" },
  { nome: "Enriquecer Leads", jobs: ["monitorar-enriquecimento-leads"], status: "pendente" },
  { nome: "Calcular Métricas", jobs: ["calcular-metricas-diarias"], status: "pendente" },
];

export function AtualizacaoProgressoFloat({
  empresaNome,
  fases,
  duracaoTotal,
  concluido,
  sucesso,
  erro,
  onClose,
}: AtualizacaoProgressoFloatProps) {
  const [expanded, setExpanded] = useState(true);
  const fasesExibir = fases.length > 0 ? fases : FASES_INICIAIS;
  const faseAtual = fasesExibir.find(f => f.status === "executando");
  const fasesCompletas = fasesExibir.filter(f => f.status === "concluido").length;

  const getStatusIcon = (status: FaseExecucao["status"]) => {
    switch (status) {
      case "concluido":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "erro":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "executando":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDuracao = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border border-border rounded-lg shadow-lg animate-fade-in">
      {/* Header - sempre visível */}
      <div 
        className={cn(
          "flex items-center justify-between p-3 cursor-pointer",
          expanded && "border-b border-border"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {!concluido && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {concluido && sucesso && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {concluido && !sucesso && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {concluido 
                ? (sucesso ? "Atualização concluída" : "Atualização com erros") 
                : "Atualizando..."}
            </span>
            <span className="text-xs text-muted-foreground">
              {concluido 
                ? formatDuracao(duracaoTotal)
                : faseAtual 
                  ? faseAtual.nome 
                  : `${fasesCompletas}/${fasesExibir.length} fases`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
          {concluido && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
          {fasesExibir.map((fase, index) => (
            <div
              key={fase.nome}
              className={cn(
                "flex items-center justify-between p-2 rounded-md text-sm transition-colors",
                fase.status === "executando" && "bg-primary/5",
                fase.status === "concluido" && "bg-green-50 dark:bg-green-950/20",
                fase.status === "erro" && "bg-destructive/5",
                fase.status === "pendente" && "opacity-50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">
                  {index + 1}.
                </span>
                {getStatusIcon(fase.status)}
                <span className={cn(
                  "text-xs",
                  fase.status === "executando" && "font-medium"
                )}>
                  {fase.nome}
                </span>
              </div>
              {fase.duracao_ms !== undefined && fase.duracao_ms > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatDuracao(fase.duracao_ms)}
                </span>
              )}
            </div>
          ))}

          {erro && (
            <div className="p-2 rounded-md bg-destructive/10 border border-destructive/30 mt-2">
              <p className="text-xs text-destructive">{erro}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { FASES_INICIAIS };
export type { FaseExecucao };
