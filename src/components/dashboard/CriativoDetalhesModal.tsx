import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ExternalLink, Image, Video, FileText, AlertTriangle } from "lucide-react";

interface CriativoDetalhes {
  id: string;
  descricao: string;
  campanha: string;
  impressoes: number;
  cliques: number;
  leads: number;
  verba: number;
  ctr: number;
  cpl: number | null;
  idade: number;
  fatigado: boolean;
  urlPreview?: string;
  urlMidia?: string;
  urlVideo?: string;
  tipo?: string;
  alcance?: number;
  frequencia?: number;
  cpcMedio?: number;
  videoViews?: number;
  conversoes?: number;
  valorConversao?: number;
  idAnuncioExterno?: string;
}

interface CriativoDetalhesModalProps {
  criativo: CriativoDetalhes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getAdLibraryUrl(criativo: CriativoDetalhes): string | null {
  if (criativo.idAnuncioExterno) {
    return `https://www.facebook.com/ads/library/?id=${criativo.idAnuncioExterno}`;
  }
  return criativo.urlPreview || null;
}

export function CriativoDetalhesModal({ 
  criativo, 
  open, 
  onOpenChange 
}: CriativoDetalhesModalProps) {
  if (!criativo) return null;

  const isVideo = criativo.tipo === "VIDEO" || criativo.tipo === "video";
  const TipoIcon = isVideo ? Video : 
                   criativo.tipo === "IMAGEM" || criativo.tipo === "IMAGE" ? Image : FileText;

  const previewLink = getAdLibraryUrl(criativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TipoIcon className="h-5 w-5" />
            Detalhes do Criativo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview/Mídia */}
          {isVideo && criativo.urlVideo ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <video
                src={criativo.urlVideo}
                poster={criativo.urlMidia || undefined}
                controls
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            </div>
          ) : criativo.urlMidia ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <img 
                src={criativo.urlMidia} 
                alt={criativo.descricao}
                className="object-contain max-h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sem preview disponível</p>
              </div>
            </div>
          )}

          {/* Info básica */}
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Descrição</span>
              <p className="font-medium">{criativo.descricao || "Sem descrição"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Campanha</span>
              <p className="font-medium">{criativo.campanha}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {criativo.fatigado ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Fatigado (CTR em queda)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Saudável
                </Badge>
              )}
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Idade:</span>
              <span className="ml-2 font-medium">{criativo.idade} dias</span>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-muted text-center">
              <div className="text-lg font-bold">
                {criativo.impressoes >= 1000 
                  ? `${(criativo.impressoes / 1000).toFixed(1)}k` 
                  : criativo.impressoes}
              </div>
              <div className="text-xs text-muted-foreground">Impressões</div>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <div className="text-lg font-bold">{criativo.cliques}</div>
              <div className="text-xs text-muted-foreground">Cliques</div>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <div className="text-lg font-bold">{criativo.leads}</div>
              <div className="text-xs text-muted-foreground">Leads</div>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <div className="text-lg font-bold text-primary">
                {criativo.cpl ? formatCurrency(criativo.cpl) : "-"}
              </div>
              <div className="text-xs text-muted-foreground">CPL</div>
            </div>
          </div>

          {/* Métricas secundárias */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <span className="text-sm text-muted-foreground">CTR</span>
              <p className="font-medium">{criativo.ctr.toFixed(2)}%</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Verba Investida</span>
              <p className="font-medium">{formatCurrency(criativo.verba)}</p>
            </div>
            {(criativo.alcance ?? 0) > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Alcance</span>
                <p className="font-medium">{criativo.alcance?.toLocaleString()}</p>
              </div>
            )}
            {(criativo.frequencia ?? 0) > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Frequência</span>
                <p className="font-medium">{criativo.frequencia?.toFixed(2)}x</p>
              </div>
            )}
            {(criativo.cpcMedio ?? 0) > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">CPC Médio</span>
                <p className="font-medium">{formatCurrency(criativo.cpcMedio!)}</p>
              </div>
            )}
            {(criativo.valorConversao ?? 0) > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">ROAS</span>
                <p className="font-medium text-green-600">{(criativo.valorConversao! / criativo.verba).toFixed(2)}x</p>
              </div>
            )}
          </div>

          {/* Botão de ação */}
          {previewLink && (
            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(previewLink, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver na Biblioteca de Anúncios
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
