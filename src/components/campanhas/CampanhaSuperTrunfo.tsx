import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotaSaudeCampanha } from "./NotaSaudeCampanha";
import { CriativoRankingCard, CriativoRankingData } from "./CriativoRankingCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreResult, TipoFunil } from "@/lib/campanha-scoring";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Layers } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";

export interface CampanhaCard {
  id_campanha: string;
  nome: string;
  plataforma: string;
  tipo_funil: TipoFunil;
  ativa: boolean;
  impressoes: number;
  cliques: number;
  leads: number;
  mqls: number;
  vendas: number;
  valor_vendas: number;
  verba_investida: number;
  ctr: number;
  cpl: number;
  roas: number;
  score: ScoreResult;
  criativos: CriativoRankingData[];
  criativos_ativos: number;
  criativos_total: number;
  tem_alerta: boolean;
}

interface CampanhaSuperTrunfoProps {
  campanha: CampanhaCard;
  onTipoFunilChange: (id: string, tipo: TipoFunil) => void;
  comparando?: boolean;
  onToggleComparar?: (id: string) => void;
  selecionadaComparar?: boolean;
}

const PlataformaIcon = ({ plataforma }: { plataforma: string }) => {
  if (plataforma === 'META') {
    return (
      <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
        M
      </div>
    );
  }
  if (plataforma === 'GOOGLE') {
    return (
      <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 via-red-500 to-yellow-400 flex items-center justify-center text-white text-xs font-bold">
        G
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
      ?
    </div>
  );
};

export function CampanhaSuperTrunfo({ campanha, onTipoFunilChange, comparando, onToggleComparar, selecionadaComparar }: CampanhaSuperTrunfoProps) {
  const [aberto, setAberto] = useState(false);
  const isMobile = useIsMobile();

  const formatNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  const MetricasCard = () => (
    <>
      {campanha.tipo_funil === 'topo' ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Impressões</p>
            <p className="text-lg font-bold">{formatNum(campanha.impressoes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">CTR</p>
            <p className="text-lg font-bold">{campanha.ctr.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Cliques</p>
            <p className="text-lg font-bold">{formatNum(campanha.cliques)}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Leads</p>
            <p className="text-lg font-bold">{formatNum(campanha.leads)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">MQLs</p>
            <p className="text-lg font-bold">{formatNum(campanha.mqls)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Vendas</p>
            <p className="text-lg font-bold">{campanha.vendas}</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div>
          <p className="text-[11px] text-muted-foreground">Verba</p>
          <p className="text-sm font-bold">{formatCurrency(campanha.verba_investida)}</p>
        </div>
        {campanha.tipo_funil === 'fundo' && campanha.cpl > 0 && (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">CPL</p>
            <p className="text-sm font-bold">{formatCurrency(campanha.cpl)}</p>
          </div>
        )}
        {campanha.tipo_funil === 'topo' && (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">CPC</p>
            <p className="text-sm font-bold">{campanha.cliques > 0 ? formatCurrency(campanha.verba_investida / campanha.cliques) : '-'}</p>
          </div>
        )}
      </div>
    </>
  );

  const CriativosDetalhe = () => (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Ranking de Criativos</h3>
        <Badge variant="outline" className="text-xs">{campanha.criativos.length} criativos</Badge>
      </div>
      {campanha.criativos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum criativo com dados no período</p>
      ) : (
        campanha.criativos.map((c, i) => (
          <CriativoRankingCard key={c.id_criativo} criativo={c} posicao={i + 1} />
        ))
      )}
    </div>
  );

  const cardContent = (
    <Card
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-all border-2 ${
        selecionadaComparar ? 'border-primary shadow-lg' : 'border-transparent'
      }`}
      onClick={() => {
        if (comparando && onToggleComparar) {
          onToggleComparar(campanha.id_campanha);
        } else {
          setAberto(true);
        }
      }}
    >
      {/* Header stripe */}
      <div className={`h-1.5 ${campanha.plataforma === 'META' ? 'bg-blue-600' : campanha.plataforma === 'GOOGLE' ? 'bg-gradient-to-r from-blue-500 via-red-500 to-yellow-400' : 'bg-muted'}`} />

      <CardContent className="p-4 space-y-3">
        {/* Topo: Plataforma + Nome + Badge + Nota */}
        <div className="flex items-start gap-3">
          <PlataformaIcon plataforma={campanha.plataforma} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{campanha.nome}</p>
            <div className="flex items-center gap-2 mt-1">
              <Select
                value={campanha.tipo_funil}
                onValueChange={(v) => {
                  onTipoFunilChange(campanha.id_campanha, v as TipoFunil);
                }}
              >
                <SelectTrigger
                  className="h-5 px-2 text-[10px] w-auto border-none bg-muted/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()}>
                  <SelectItem value="topo">Topo de Funil</SelectItem>
                  <SelectItem value="fundo">Fundo de Funil</SelectItem>
                </SelectContent>
              </Select>
              {comparando && (
                <Checkbox
                  checked={selecionadaComparar}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComparar?.(campanha.id_campanha);
                  }}
                  className="h-4 w-4"
                />
              )}
            </div>
          </div>
          <NotaSaudeCampanha nota={campanha.score.nota} pontuacao={campanha.score.pontuacao} tamanho="md" />
        </div>

        {/* Métricas */}
        <MetricasCard />

        {/* Rodapé */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>{campanha.criativos_ativos}/{campanha.criativos_total} criativos</span>
          </div>
          {campanha.tem_alerta && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <ChevronDown className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );

  // Mobile: collapsible inline / Desktop: dialog
  if (isMobile) {
    return (
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger asChild>
          {cardContent}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 py-3">
          <CriativosDetalhe />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <>
      {cardContent}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <PlataformaIcon plataforma={campanha.plataforma} />
              <span className="truncate">{campanha.nome}</span>
              <NotaSaudeCampanha nota={campanha.score.nota} pontuacao={campanha.score.pontuacao} tamanho="sm" />
            </DialogTitle>
          </DialogHeader>

          {/* Score details */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {campanha.score.detalhes.map(d => (
              <div key={d.metrica} className={`rounded-md p-2 text-center text-xs ${
                d.status === 'bom' ? 'bg-green-500/10 text-green-700' :
                d.status === 'medio' ? 'bg-yellow-500/10 text-yellow-700' :
                'bg-red-500/10 text-red-700'
              }`}>
                <p className="font-semibold">{d.metrica}</p>
                <p className="text-lg font-bold">{d.valor.toFixed(d.metrica === 'ROAS' ? 2 : 1)}</p>
                <p className="text-[10px] opacity-70">bench: {d.benchmark.toFixed(1)}</p>
              </div>
            ))}
          </div>

          <CriativosDetalhe />
        </DialogContent>
      </Dialog>
    </>
  );
}
