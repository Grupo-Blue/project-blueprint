import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaseExecucao {
  nome: string;
  jobs: string[];
  status: "pendente" | "executando" | "concluido" | "erro";
  duracao_ms?: number;
  erro?: string;
}

interface AtualizacaoProgressoModalProps {
  open: boolean;
  onClose: () => void;
  empresaNome: string;
  fases: FaseExecucao[];
  duracaoTotal?: number;
  concluido: boolean;
  sucesso: boolean;
  erro?: string;
}

const FASES_INICIAIS: FaseExecucao[] = [
  { nome: "Importar Campanhas", jobs: ["importar-campanhas-meta", "importar-campanhas-google"], status: "pendente" },
  { nome: "Coletar Métricas", jobs: ["coletar-metricas-meta", "coletar-metricas-google"], status: "pendente" },
  { nome: "Coletar Criativos", jobs: ["coletar-criativos-meta", "coletar-criativos-google"], status: "pendente" },
  { nome: "Sincronizar Leads", jobs: ["sincronizar-pipedrive", "vincular-leads-criativos"], status: "pendente" },
  { nome: "Enriquecer Leads", jobs: ["monitorar-enriquecimento-leads"], status: "pendente" },
  { nome: "Calcular Métricas", jobs: ["calcular-metricas-diarias"], status: "pendente" },
];

export function AtualizacaoProgressoModal({
  open,
  onClose,
  empresaNome,
  fases,
  duracaoTotal,
  concluido,
  sucesso,
  erro,
}: AtualizacaoProgressoModalProps) {
  const fasesExibir = fases.length > 0 ? fases : FASES_INICIAIS;
  const faseAtual = fasesExibir.findIndex(f => f.status === "executando");

  const getStatusIcon = (status: FaseExecucao["status"]) => {
    switch (status) {
      case "concluido":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "erro":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "executando":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatDuracao = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && concluido && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!concluido && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {concluido && sucesso && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {concluido && !sucesso && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            Atualizando {empresaNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {fasesExibir.map((fase, index) => (
            <div
              key={fase.nome}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                fase.status === "executando" && "bg-primary/5 border-primary/30",
                fase.status === "concluido" && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                fase.status === "erro" && "bg-destructive/5 border-destructive/30",
                fase.status === "pendente" && "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}.
                </span>
                {getStatusIcon(fase.status)}
                <div>
                  <p className="font-medium text-sm">{fase.nome}</p>
                  {fase.erro && (
                    <p className="text-xs text-destructive mt-1">{fase.erro}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {fase.duracao_ms !== undefined && fase.duracao_ms > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuracao(fase.duracao_ms)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {concluido && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="font-medium">Tempo total:</span>
              <span className="font-mono text-lg">{formatDuracao(duracaoTotal)}</span>
            </div>
            
            {erro && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive">{erro}</p>
              </div>
            )}

            <Button onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {!concluido && (
          <div className="text-center text-sm text-muted-foreground">
            <p>Aguarde enquanto os dados são atualizados...</p>
            <p className="text-xs mt-1">Isso pode levar alguns segundos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { FASES_INICIAIS };
export type { FaseExecucao };
