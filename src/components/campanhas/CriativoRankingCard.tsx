import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Star, TrendingDown, Image, Video, FileText, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

export interface CriativoRankingData {
  id_criativo: string;
  descricao: string | null;
  tipo: string;
  url_midia: string | null;
  url_preview: string | null;
  impressoes: number;
  cliques: number;
  leads: number;
  vendas: number;
  verba_investida: number;
  ctr: number;
  cpl: number;
  roas: number;
  valor_vendas: number;
  isFadiga?: boolean;
  isSemConversao?: boolean;
  isEstrela?: boolean;
}

interface CriativoRankingCardProps {
  criativo: CriativoRankingData;
  posicao: number;
}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'IMAGE': case 'IMAGEM': return <Image className="h-3 w-3" />;
    case 'VIDEO': return <Video className="h-3 w-3" />;
    default: return <FileText className="h-3 w-3" />;
  }
};

export function CriativoRankingCard({ criativo, posicao }: CriativoRankingCardProps) {
  const [imagemExpandida, setImagemExpandida] = useState(false);
  const maxFunil = Math.max(criativo.impressoes, 1);

  const etapasFunil = [
    { label: 'Imp', valor: criativo.impressoes, cor: 'bg-blue-500' },
    { label: 'Cliq', valor: criativo.cliques, cor: 'bg-cyan-500' },
    { label: 'Leads', valor: criativo.leads, cor: 'bg-amber-500' },
    { label: 'Vendas', valor: criativo.vendas, cor: 'bg-green-500' },
  ];

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow overflow-hidden">
      {/* Posição */}
      <div className="flex flex-col items-center justify-start pt-1">
        <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
          posicao <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          #{posicao}
        </span>
      </div>

      {/* Thumbnail + Preview link */}
      <div className="flex flex-col items-center gap-1">
        <div 
          className={`w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center ${criativo.url_midia ? 'cursor-pointer hover:ring-2 ring-primary/50 transition-all' : ''}`}
          onClick={(e) => {
            if (criativo.url_midia) {
              e.stopPropagation();
              setImagemExpandida(true);
            }
          }}
        >
          {criativo.url_midia ? (
            <img src={criativo.url_midia} alt="" className="w-full h-full object-cover" />
          ) : (
            getTipoIcon(criativo.tipo)
          )}
        </div>
        {(criativo.url_preview) && (
          <a
            href={criativo.url_preview}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Ver preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Image expand dialog */}
      <Dialog open={imagemExpandida} onOpenChange={setImagemExpandida}>
        <DialogContent className="max-w-2xl p-2" onClick={(e) => e.stopPropagation()}>
          {criativo.url_midia && (
            <img src={criativo.url_midia} alt={criativo.descricao || ''} className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
      <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate">
            {criativo.descricao || criativo.id_criativo.slice(0, 12)}
          </p>
          <div className="flex gap-1 flex-shrink-0">
            {criativo.isEstrela && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
            {criativo.isFadiga && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                <TrendingDown className="h-3 w-3" />Fadiga
              </Badge>
            )}
            {criativo.isSemConversao && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5 border-destructive text-destructive">
                <AlertTriangle className="h-3 w-3" />Sem conv.
              </Badge>
            )}
          </div>
        </div>

        {/* Métricas inline */}
        <div className="grid grid-cols-4 gap-1 text-xs">
          <div>
            <span className="text-muted-foreground">Leads</span>
            <p className="font-semibold">{criativo.leads}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CPL</span>
            <p className="font-semibold">{criativo.cpl > 0 ? formatCurrency(criativo.cpl) : '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">CTR</span>
            <p className="font-semibold">{criativo.ctr.toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-muted-foreground">Vendas</span>
            <p className="font-semibold">{criativo.vendas}</p>
          </div>
        </div>

        {/* Mini Funil */}
        <div className="space-y-0.5">
          {etapasFunil.map(e => {
            const pct = Math.max((e.valor / maxFunil) * 100, 2);
            return (
              <div key={e.label} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-8 text-right">{e.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${e.cor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-medium w-10 text-right">
                  {e.valor >= 1000 ? `${(e.valor / 1000).toFixed(1)}K` : e.valor}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
