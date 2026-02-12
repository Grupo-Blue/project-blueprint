import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  History, 
  Target, 
  Activity, 
  Wallet,
  AlertTriangle,
  MapPin,
  Tag,
  MessageCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getDiasNoStage, calcularScoreTemperatura, getPrioridade } from "@/lib/lead-scoring";

interface LeadCardMobileProps {
  lead: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  disparoInfo?: { count: number; ultimo: string };
}

// Helper functions duplicated for component isolation
const getCanal = (source: string | null) => {
  if (!source) return { icon: '🔗', label: 'Direto', color: 'text-muted-foreground' };
  const s = source.toLowerCase();
  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) return { icon: '📘', label: 'Facebook', color: 'text-blue-600' };
  if (s.includes('google')) return { icon: '🔍', label: 'Google', color: 'text-red-500' };
  if (s.includes('instagram') || s.includes('ig')) return { icon: '📱', label: 'Instagram', color: 'text-pink-500' };
  if (s.includes('email') || s.includes('mail')) return { icon: '📧', label: 'Email', color: 'text-emerald-600' };
  return { icon: '🔗', label: 'Orgânico', color: 'text-muted-foreground' };
};

// getDiasNoStage, calcularScoreTemperatura e getPrioridade importados de @/lib/lead-scoring

const getStatusPrincipal = (lead: any) => {
  if (lead.venda_realizada) return { label: 'Vendido', color: 'bg-green-600 text-white', icon: '💰' };
  if (lead.reuniao_realizada) return { label: 'Reunião OK', color: 'bg-purple-600 text-white', icon: '✅' };
  if (lead.tem_reuniao) return { label: 'Reunião', color: 'bg-purple-500 text-white', icon: '📅' };
  if (lead.levantou_mao) return { label: 'Engajado', color: 'bg-blue-500 text-white', icon: '🙋' };
  if (lead.is_mql) return { label: 'MQL', color: 'bg-blue-400 text-white', icon: '⭐' };
  return { label: 'Novo', color: 'bg-slate-200 text-slate-700', icon: '🆕' };
};

const getUtmQuality = (lead: any) => {
  const hasSource = !!lead.utm_source;
  const hasMedium = !!lead.utm_medium;
  const hasCampaign = !!lead.utm_campaign;
  const hasContent = !!lead.utm_content;
  const total = [hasSource, hasMedium, hasCampaign, hasContent].filter(Boolean).length;
  if (total === 4) return { status: 'completo', badge: '🟢', label: 'Completo' };
  if (total >= 2) return { status: 'parcial', badge: '🟡', label: 'Parcial' };
  if (total >= 1) return { status: 'minimo', badge: '🟠', label: 'Mínimo' };
  return { status: 'ausente', badge: '🔴', label: 'Ausente' };
};

// Mapeamento empresa -> slug para link Chatblue/WhatsApp
const EMPRESA_SLUG_MAP: Record<string, string> = {
  "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db": "blue-consult",
  "61b5ffeb-fbbc-47c1-8ced-152bb647ed20": "tokeniza",
  "6edd20a7-47ee-4c48-9719-c537a9869c66": "axia",
  "b1ffd679-0dce-4223-b516-dba7cd283bda": "mpuppe",
};

const getWhatsappLink = (lead: any): string => {
  const slug = EMPRESA_SLUG_MAP[lead.id_empresa] || "blue-consult";
  const telefone = (lead.telefone || "").replace(/\D/g, "");
  return `https://chat.grupoblue.com.br/open/${slug}/${telefone}`;
};

export function LeadCardMobile({ lead, isExpanded, onToggleExpand, disparoInfo }: LeadCardMobileProps) {
  const prioridade = getPrioridade(lead);
  const PrioridadeIcon = prioridade.icon;
  const dias = getDiasNoStage(lead);
  const canal = getCanal(lead.utm_source);
  const statusPrincipal = getStatusPrincipal(lead);
  const isCarrinhoAbandonado = lead.tokeniza_carrinho_abandonado && !lead.tokeniza_investidor;
  const scoreTemp = prioridade.score;
  const utmQuality = getUtmQuality(lead);

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isCarrinhoAbandonado && "border-l-4 border-l-orange-500 bg-orange-50/30"
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{lead.nome_lead || "Sem nome"}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </div>
                {lead.email && <p className="text-xs text-muted-foreground truncate">{lead.email}</p>}
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold shrink-0",
                prioridade.bgColor, prioridade.color
              )}>
                <PrioridadeIcon className="h-3 w-3" />
                {prioridade.label}
                <span className="font-mono text-[10px] opacity-80">{prioridade.score}°</span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div>
                <span className="text-muted-foreground">Canal</span>
                <p className={cn("font-medium", canal.color)}>{canal.icon} {canal.label}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stage</span>
                <p className="font-medium truncate">{lead.stage_atual || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Dias</span>
                <p className={cn(
                  "font-medium",
                  dias > 7 ? "text-red-600" : dias > 3 ? "text-yellow-600" : ""
                )}>
                  {dias > 7 && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                  {dias}d
                </p>
              </div>
            </div>

            {/* Status & Value Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                <Badge className={cn("text-xs h-5", statusPrincipal.color)}>
                  {statusPrincipal.icon} {statusPrincipal.label}
                </Badge>
                {lead.tokeniza_investidor && (
                  <Badge variant="outline" className="text-xs h-5 bg-amber-100 text-amber-700 border-amber-300">💰</Badge>
                )}
                {isCarrinhoAbandonado && (
                  <Badge variant="outline" className="text-xs h-5 bg-orange-100 text-orange-700 border-orange-300">🛒</Badge>
                )}
                {disparoInfo && (
                  <Badge variant="outline" className="text-xs h-5 bg-sky-100 text-sky-700 border-sky-300" title={`Último: ${format(parseISO(disparoInfo.ultimo), "dd/MM/yy")}`}>
                    <MessageCircle className="h-3 w-3 mr-0.5" />
                    {disparoInfo.count}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lead.valor_venda && (
                  <span className="font-semibold text-green-600 text-sm">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lead.valor_venda)}
                  </span>
                )}
                {lead.telefone && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <a href={getWhatsappLink(lead)} target="_blank" rel="noopener noreferrer">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-600">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                  </Button>
                )}
                {lead.url_pipedrive && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t space-y-3">
            {/* Histórico */}
            <div className="space-y-1.5 pt-3">
              <h4 className="font-semibold text-xs flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico
              </h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado:</span>
                  <span>{format(parseISO(lead.data_criacao), "dd/MM/yy")}</span>
                </div>
                {lead.data_mql && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MQL:</span>
                    <span>{format(parseISO(lead.data_mql), "dd/MM/yy")}</span>
                  </div>
                )}
                {lead.data_reuniao && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reunião:</span>
                    <span>{format(parseISO(lead.data_reuniao), "dd/MM/yy")}</span>
                  </div>
                )}
                {lead.data_venda && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venda:</span>
                    <span>{format(parseISO(lead.data_venda), "dd/MM/yy")}</span>
                  </div>
                )}
              </div>
              {/* Timeline de eventos */}
              {lead.lead_evento && lead.lead_evento.length > 0 && (
                <div className="mt-2 border-l-2 border-primary/30 pl-2 space-y-1">
                  {lead.lead_evento.slice(0, 3).map((evento: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <span className="text-muted-foreground">{format(parseISO(evento.data_evento), "dd/MM")}</span>
                      {" → "}<span className="font-medium">{evento.etapa}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tracking UTM */}
            <div className="space-y-1.5">
              <h4 className="font-semibold text-xs flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Tracking
                <span className="text-xs font-normal">{utmQuality.badge} {utmQuality.label}</span>
              </h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {lead.utm_source && (
                  <div className="truncate"><span className="text-muted-foreground">Source:</span> {lead.utm_source}</div>
                )}
                {lead.utm_medium && (
                  <div className="truncate"><span className="text-muted-foreground">Medium:</span> {lead.utm_medium}</div>
                )}
                {lead.utm_campaign && (
                  <div className="col-span-2 truncate"><span className="text-muted-foreground">Campaign:</span> {lead.utm_campaign}</div>
                )}
              </div>
            </div>

            {/* Engajamento Mautic */}
            {(lead.mautic_score || lead.mautic_page_hits) && (
              <div className="space-y-1.5">
                <h4 className="font-semibold text-xs flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Engajamento
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-1.5 text-center">
                    <p className="text-muted-foreground">Score</p>
                    <p className="font-semibold">{lead.mautic_score || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-1.5 text-center">
                    <p className="text-muted-foreground">Visitas</p>
                    <p className="font-semibold">{lead.mautic_page_hits || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-1.5 text-center">
                    <p className="text-muted-foreground">Temp°</p>
                    <p className="font-semibold">{scoreTemp}°</p>
                  </div>
                </div>
                {lead.cidade_mautic && (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {lead.cidade_mautic}{lead.estado_mautic && `, ${lead.estado_mautic}`}
                  </p>
                )}
              </div>
            )}

            {/* Tokeniza */}
            {(lead.tokeniza_investidor || lead.tokeniza_carrinho_abandonado) && (
              <div className="space-y-1.5">
                <h4 className="font-semibold text-xs flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Tokeniza
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {lead.tokeniza_investidor && (
                    <>
                      <div className="bg-amber-50 rounded p-1.5">
                        <p className="text-muted-foreground">Investido</p>
                        <p className="font-semibold text-amber-700">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lead.tokeniza_valor_investido || 0)}
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded p-1.5">
                        <p className="text-muted-foreground">Investimentos</p>
                        <p className="font-semibold text-amber-700">{lead.tokeniza_qtd_investimentos || 0}</p>
                      </div>
                    </>
                  )}
                  {lead.tokeniza_carrinho_abandonado && (
                    <div className="col-span-2 bg-orange-50 rounded p-1.5">
                      <p className="text-muted-foreground">Carrinho Abandonado</p>
                      <p className="font-semibold text-orange-700">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lead.tokeniza_valor_carrinho || 0)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notion Client */}
            {lead.cliente_notion && (
              <div className="space-y-1 bg-emerald-50/50 rounded p-2">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">{lead.cliente_notion.status_cliente}</span>
                </div>
                {lead.cliente_notion.produtos_contratados && (
                  <p className="text-xs text-muted-foreground">
                    Produtos: {Array.isArray(lead.cliente_notion.produtos_contratados) 
                      ? lead.cliente_notion.produtos_contratados.join(", ") 
                      : String(lead.cliente_notion.produtos_contratados)}
                  </p>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
