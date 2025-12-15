import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  Image, 
  Video, 
  Grid3x3, 
  FileQuestion,
  Pencil,
  Link2,
  Link2Off,
  ExternalLink
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Criativo {
  id_criativo: string;
  id_criativo_externo: string;
  tipo: string;
  descricao: string | null;
  ativo: boolean;
  url_midia: string | null;
  url_final: string | null;
  url_esperada: string | null;
  url_preview: string | null;
  leads?: number;
  cliques?: number;
  impressoes?: number;
  verba_investida?: number;
  cpl?: number | null;
  ctr?: number | null;
}

interface CriativoItemMobileProps {
  criativo: Criativo;
  urlEsperadaCampanha?: string | null;
  onCopyId: (id: string) => void;
  onEditUrl: (criativo: Criativo) => void;
}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case "VIDEO":
      return <Video className="h-4 w-4" />;
    case "IMAGEM":
      return <Image className="h-4 w-4" />;
    case "CARROSSEL":
      return <Grid3x3 className="h-4 w-4" />;
    default:
      return <FileQuestion className="h-4 w-4" />;
  }
};

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    VIDEO: "Vídeo",
    IMAGEM: "Imagem",
    CARROSSEL: "Carrossel",
    OUTRO: "Outro",
  };
  return labels[tipo] || tipo;
};

export function CriativoItemMobile({ 
  criativo, 
  urlEsperadaCampanha, 
  onCopyId, 
  onEditUrl 
}: CriativoItemMobileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "rounded-lg border bg-card overflow-hidden",
        !criativo.ativo && "opacity-70"
      )}>
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer">
            {/* Header com tipo, status e CPL */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getTipoIcon(criativo.tipo)}
                <span className="text-sm font-medium">{getTipoLabel(criativo.tipo)}</span>
                <Badge variant={criativo.ativo ? "secondary" : "outline"} className="text-xs shrink-0">
                  {criativo.ativo ? "Ativo" : "Inativo"}
                </Badge>
                {isExpanded ? <ChevronDown className="h-4 w-4 ml-auto shrink-0" /> : <ChevronRight className="h-4 w-4 ml-auto shrink-0" />}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">
                  {criativo.cpl ? `R$ ${criativo.cpl.toFixed(2)}` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">CPL</p>
              </div>
            </div>

            {/* Métricas em grid 2x2 */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Leads</p>
                <p className="font-semibold">{criativo.leads || 0}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Cliques</p>
                <p className="font-semibold">{criativo.cliques || 0}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">Verba</p>
                <p className="font-semibold">R$ {(criativo.verba_investida || 0).toFixed(0)}</p>
              </div>
              <div className="text-center bg-muted/50 rounded p-1.5">
                <p className="text-muted-foreground">CTR</p>
                <p className="font-semibold">{criativo.ctr ? `${criativo.ctr.toFixed(1)}%` : "N/A"}</p>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t space-y-3">
            {/* ID e ações */}
            <div className="pt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[180px]">
                  {criativo.id_criativo_externo}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyId(criativo.id_criativo_externo);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Descrição */}
            {criativo.descricao && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {criativo.descricao}
              </p>
            )}

            {/* URL Status e ações */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {criativo.url_esperada ? (
                  <>
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    <span>URL própria</span>
                  </>
                ) : urlEsperadaCampanha ? (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Herdando da campanha</span>
                  </>
                ) : (
                  <>
                    <Link2Off className="h-3.5 w-3.5 text-amber-600" />
                    <span>Sem URL</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditUrl(criativo);
                  }}
                  className="h-7 text-xs"
                >
                  Editar URL
                </Button>
                {criativo.url_preview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(criativo.url_preview!, '_blank');
                    }}
                    className="h-7 w-7 p-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Preview da mídia */}
            {criativo.url_midia && (
              <div className="bg-muted rounded-lg overflow-hidden">
                <img 
                  src={criativo.url_midia} 
                  alt="Prévia"
                  className="w-full max-h-[150px] object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
