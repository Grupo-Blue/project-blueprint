import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Star, AlertTriangle, TrendingUp, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KeywordData {
  id: string;
  keyword: string;
  match_type: string | null;
  impressions: number;
  clicks: number;
  spent: number;
  conversions: number;
  cpc: number;
  ctr: number;
  quality_score: number | null;
}

interface KeywordRankingTableProps {
  id_campanha: string;
  id_empresa: string;
}

const MatchTypeBadge = ({ type }: { type: string | null }) => {
  if (!type) return null;
  const labels: Record<string, { label: string; className: string }> = {
    BROAD: { label: "Broad", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
    PHRASE: { label: "Phrase", className: "bg-purple-500/10 text-purple-700 border-purple-200" },
    EXACT: { label: "Exact", className: "bg-green-500/10 text-green-700 border-green-200" },
  };
  const config = labels[type.toUpperCase()] || { label: type, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className}`}>{config.label}</Badge>;
};

const QualityScoreIndicator = ({ score }: { score: number | null }) => {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 7 ? "text-green-600 bg-green-500/10" : score >= 4 ? "text-yellow-600 bg-yellow-500/10" : "text-red-600 bg-red-500/10";
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${color}`}>
      {score}
    </span>
  );
};

export function KeywordRankingTable({ id_campanha, id_empresa }: KeywordRankingTableProps) {
  const { data: keywords, isLoading } = useQuery({
    queryKey: ["keywords-campanha", id_campanha, id_empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_keyword")
        .select("*")
        .eq("id_campanha", id_campanha)
        .eq("id_empresa", id_empresa);

      if (error) throw error;
      return (data || []).map(k => ({
        id: k.id,
        keyword: k.keyword,
        match_type: k.match_type,
        impressions: k.impressions || 0,
        clicks: k.clicks || 0,
        spent: k.spent || 0,
        conversions: k.conversions || 0,
        cpc: k.cpc || 0,
        ctr: k.ctr || 0,
        quality_score: k.quality_score,
      })) as KeywordData[];
    },
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma keyword encontrada para esta campanha</p>
      </div>
    );
  }

  // Sort by spent descending
  const sorted = [...keywords].sort((a, b) => b.spent - a.spent);
  const totalSpent = sorted.reduce((s, k) => s + k.spent, 0);
  const totalClicks = sorted.reduce((s, k) => s + k.clicks, 0);
  const totalImpressions = sorted.reduce((s, k) => s + k.impressions, 0);
  const totalConversions = sorted.reduce((s, k) => s + k.conversions, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpent / totalClicks : 0;

  // Thresholds for badges
  const meanCTR = avgCTR;
  const meanCPC = avgCPC;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Search className="h-4 w-4" />
          Palavras-chave
        </h3>
        <Badge variant="outline" className="text-xs">{sorted.length} keywords</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Keywords</p>
          <p className="text-sm font-bold">{sorted.length}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">CPC Médio</p>
          <p className="text-sm font-bold">{formatCurrency(avgCPC)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">CTR Médio</p>
          <p className="text-sm font-bold">{avgCTR.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Conversões</p>
          <p className="text-sm font-bold">{totalConversions}</p>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Keyword</TableHead>
            <TableHead className="text-xs text-right">Impr.</TableHead>
            <TableHead className="text-xs text-right">Cliques</TableHead>
            <TableHead className="text-xs text-right">CTR</TableHead>
            <TableHead className="text-xs text-right">Gasto</TableHead>
            <TableHead className="text-xs text-right">CPC</TableHead>
            <TableHead className="text-xs text-right">Conv.</TableHead>
            <TableHead className="text-xs text-center">QS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(k => {
            const spendPct = totalSpent > 0 ? (k.spent / totalSpent) * 100 : 0;
            const isEstrela = k.ctr > meanCTR && k.cpc > 0 && k.cpc < meanCPC;
            const isDrenar = k.spent > 0 && k.conversions === 0 && spendPct > 15;
            const isOportunidade = k.conversions > 0 && k.quality_score != null && k.quality_score < 5;
            const costPerConv = k.conversions > 0 ? k.spent / k.conversions : null;

            return (
              <TableRow key={k.id} className="text-xs">
                <TableCell className="py-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{k.keyword}</span>
                      <MatchTypeBadge type={k.match_type} />
                    </div>
                    {/* Spend proportion bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 rounded-full bg-muted flex-1 max-w-[80px]">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${Math.min(spendPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{spendPct.toFixed(0)}%</span>
                    </div>
                    {/* Decision badges */}
                    <div className="flex gap-1 flex-wrap">
                      <TooltipProvider>
                        {isEstrela && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="text-[9px] px-1 py-0 bg-yellow-500/10 text-yellow-700 border-yellow-300 gap-0.5" variant="outline">
                                <Star className="h-2.5 w-2.5" /> Estrela
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">CTR acima da média e CPC abaixo da média</p></TooltipContent>
                          </Tooltip>
                        )}
                        {isDrenar && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="text-[9px] px-1 py-0 bg-red-500/10 text-red-700 border-red-300 gap-0.5" variant="outline">
                                <AlertTriangle className="h-2.5 w-2.5" /> Drenar
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Alto gasto sem conversões — considere pausar</p></TooltipContent>
                          </Tooltip>
                        )}
                        {isOportunidade && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-700 border-blue-300 gap-0.5" variant="outline">
                                <TrendingUp className="h-2.5 w-2.5" /> Oportunidade
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Converte mas Quality Score baixo — otimize a relevância</p></TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right py-2">{k.impressions.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right py-2">{k.clicks.toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-right py-2">{k.ctr.toFixed(2)}%</TableCell>
                <TableCell className="text-right py-2">{formatCurrency(k.spent)}</TableCell>
                <TableCell className="text-right py-2">{formatCurrency(k.cpc)}</TableCell>
                <TableCell className="text-right py-2">
                  <div>
                    <span>{k.conversions}</span>
                    {costPerConv != null && (
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(costPerConv)}/conv</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <QualityScoreIndicator score={k.quality_score} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
