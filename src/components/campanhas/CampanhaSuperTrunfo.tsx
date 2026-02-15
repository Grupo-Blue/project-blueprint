import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotaSaudeCampanha } from "./NotaSaudeCampanha";
import { CriativoRankingCard, CriativoRankingData } from "./CriativoRankingCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreResult, TipoFunil } from "@/lib/campanha-scoring";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Layers, Target, Link2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";
import { KeywordRankingTable } from "./KeywordRankingTable";

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
  vendas_diretas: number;
  vendas_campanha: number;
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
  alcance?: number;
  frequencia?: number;
  cpc_medio?: number;
  conversoes?: number;
  valor_conversao?: number;
}

interface CampanhaSuperTrunfoProps {
  campanha: CampanhaCard;
  onTipoFunilChange: (id: string, tipo: TipoFunil) => void;
  comparando?: boolean;
  onToggleComparar?: (id: string) => void;
  selecionadaComparar?: boolean;
  isGoogleSearch?: boolean;
  id_empresa?: string;
}

const PlataformaIcon = ({ plataforma }: { plataforma: string }) => {
  if (plataforma === 'META') {
    return (
      <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
          <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.93 3.78-3.93 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02Z" />
        </svg>
      </div>
    );
  }
  if (plataforma === 'GOOGLE') {
    return (
      <div className="w-7 h-7 rounded-md bg-white border border-border flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
          <path d="M5.84 14.09a6.07 6.07 0 0 1 0-4.17V7.07H2.18a10.02 10.02 0 0 0 0 9.86l3.66-2.84Z" fill="#FBBC05" />
          <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16Z" fill="#EA4335" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
      ?
    </div>
  );
};

export function CampanhaSuperTrunfo({ campanha, onTipoFunilChange, comparando, onToggleComparar, selecionadaComparar, isGoogleSearch, id_empresa }: CampanhaSuperTrunfoProps) {
  const [aberto, setAberto] = useState(false);
  const isMobile = useIsMobile();

  const formatNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();
  const [abrirDialog, setAbrirDialog] = useState(false);
  
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-lg font-bold">{campanha.vendas}</p>
                    {campanha.vendas > 0 && (
                      campanha.vendas_diretas > 0 && campanha.vendas_campanha > 0 ? (
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                      ) : campanha.vendas_diretas > 0 ? (
                        <Target className="h-3 w-3 text-green-600" />
                      ) : (
                        <Link2 className="h-3 w-3 text-amber-500" />
                      )
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {campanha.vendas_diretas > 0 && <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {campanha.vendas_diretas} via criativo</span>}
                    {campanha.vendas_campanha > 0 && <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> {campanha.vendas_campanha} via campanha</span>}
                    {campanha.vendas === 0 && 'Sem vendas atribuídas'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
    <div className="space-y-2 max-h-[60vh] overflow-y-auto overflow-x-hidden">
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
      onClick={(e) => {
        if (comparando && onToggleComparar) {
          onToggleComparar(campanha.id_campanha);
        } else if (!isMobile) {
          setAbrirDialog(true);
        }
        // On mobile, CollapsibleTrigger handles the toggle
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
          {isGoogleSearch && id_empresa ? (
            <KeywordRankingTable id_campanha={campanha.id_campanha} id_empresa={id_empresa} />
          ) : (
            <CriativosDetalhe />
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <>
      {cardContent}
      <Dialog open={abrirDialog} onOpenChange={setAbrirDialog}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto overflow-x-hidden p-0">
          <div className="p-6 space-y-4 min-w-0 w-full overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <PlataformaIcon plataforma={campanha.plataforma} />
                <span className="truncate flex-1 min-w-0">{campanha.nome}</span>
                <NotaSaudeCampanha nota={campanha.score.nota} pontuacao={campanha.score.pontuacao} tamanho="sm" />
              </DialogTitle>
            </DialogHeader>

            {/* Score details */}
            <div className="grid grid-cols-3 gap-2">
              {campanha.score.detalhes.map(d => (
                <div key={d.metrica} className={`rounded-md p-2 text-center text-xs ${
                  d.status === 'bom' ? 'bg-green-500/10 text-green-700' :
                  d.status === 'medio' ? 'bg-yellow-500/10 text-yellow-700' :
                  'bg-red-500/10 text-red-700'
                }`}>
                  <p className="font-semibold truncate">{d.metrica}</p>
                  <p className="text-lg font-bold">{d.valor.toFixed(d.metrica === 'ROAS' ? 2 : 1)}</p>
                  <p className="text-[10px] opacity-70">bench: {d.benchmark.toFixed(1)}</p>
                </div>
              ))}
            </div>

            {/* Métricas avançadas Metricool */}
            {(!!campanha.alcance || !!campanha.cpc_medio || !!campanha.conversoes) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-muted/50 text-xs">
                {!!campanha.alcance && (
                  <div className="text-center">
                    <p className="text-muted-foreground">Alcance</p>
                    <p className="font-bold text-sm">{campanha.alcance >= 1000 ? `${(campanha.alcance / 1000).toFixed(1)}K` : campanha.alcance}</p>
                  </div>
                )}
                {!!campanha.frequencia && campanha.frequencia > 0 && (
                  <div className="text-center">
                    <p className="text-muted-foreground">Frequência</p>
                    <p className="font-bold text-sm">{campanha.frequencia.toFixed(2)}</p>
                  </div>
                )}
                {!!campanha.cpc_medio && campanha.cpc_medio > 0 && (
                  <div className="text-center">
                    <p className="text-muted-foreground">CPC Médio</p>
                    <p className="font-bold text-sm">{formatCurrency(campanha.cpc_medio)}</p>
                  </div>
                )}
                {!!campanha.conversoes && campanha.conversoes > 0 && (
                  <div className="text-center">
                    <p className="text-muted-foreground">Conversões</p>
                    <p className="font-bold text-sm">{campanha.conversoes}</p>
                  </div>
                )}
              </div>
            )}

            {isGoogleSearch && id_empresa ? (
              <KeywordRankingTable id_campanha={campanha.id_campanha} id_empresa={id_empresa} />
            ) : (
              <CriativosDetalhe />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
