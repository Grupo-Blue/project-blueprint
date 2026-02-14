import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampanhaCard } from "./CampanhaSuperTrunfo";
import { NotaSaudeCampanha } from "./NotaSaudeCampanha";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ComparativoCampanhasProps {
  campanhas: CampanhaCard[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinhaComparacao {
  label: string;
  valores: number[];
  formato: 'numero' | 'moeda' | 'percentual' | 'multiplicador';
  menorMelhor?: boolean;
}

export function ComparativoCampanhas({ campanhas, open, onOpenChange }: ComparativoCampanhasProps) {
  if (campanhas.length < 2) return null;

  const linhas: LinhaComparacao[] = [
    { label: 'Impressões', valores: campanhas.map(c => c.impressoes), formato: 'numero' },
    { label: 'Cliques', valores: campanhas.map(c => c.cliques), formato: 'numero' },
    { label: 'CTR', valores: campanhas.map(c => c.ctr), formato: 'percentual' },
    { label: 'Leads', valores: campanhas.map(c => c.leads), formato: 'numero' },
    { label: 'MQLs', valores: campanhas.map(c => c.mqls), formato: 'numero' },
    { label: 'Vendas', valores: campanhas.map(c => c.vendas), formato: 'numero' },
    { label: 'Verba', valores: campanhas.map(c => c.verba_investida), formato: 'moeda' },
    { label: 'CPL', valores: campanhas.map(c => c.cpl), formato: 'moeda', menorMelhor: true },
    { label: 'ROAS', valores: campanhas.map(c => c.roas), formato: 'multiplicador' },
  ];

  const formatVal = (v: number, f: string) => {
    if (f === 'moeda') return formatCurrency(v);
    if (f === 'percentual') return `${v.toFixed(2)}%`;
    if (f === 'multiplicador') return `${v.toFixed(2)}x`;
    return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString();
  };

  const getBestIndex = (valores: number[], menorMelhor?: boolean) => {
    if (valores.every(v => v === 0)) return -1;
    const fn = menorMelhor
      ? (a: number, b: number) => (a > 0 && (b === 0 || a < b))
      : (a: number, b: number) => a > b;
    let best = 0;
    for (let i = 1; i < valores.length; i++) {
      if (fn(valores[i], valores[best])) best = i;
    }
    return best;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparativo de Campanhas</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 text-muted-foreground">Métrica</th>
                {campanhas.map(c => (
                  <th key={c.id_campanha} className="p-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium text-xs truncate max-w-[120px]">{c.nome}</span>
                      <NotaSaudeCampanha nota={c.score.nota} pontuacao={c.score.pontuacao} tamanho="sm" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(linha => {
                const best = getBestIndex(linha.valores, linha.menorMelhor);
                return (
                  <tr key={linha.label} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium text-muted-foreground">{linha.label}</td>
                    {linha.valores.map((v, i) => (
                      <td key={i} className={cn(
                        "p-2 text-center font-semibold",
                        i === best && best !== -1 ? 'text-green-600' : ''
                      )}>
                        {formatVal(v, linha.formato)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
