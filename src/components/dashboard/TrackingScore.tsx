import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface TrackingScoreProps {
  empresaId?: string;
}

export function TrackingScore({ empresaId }: TrackingScoreProps) {
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ["tracking-score", empresaId],
    queryFn: async () => {
      // Buscar criativos de campanhas ativas
      let query = supabase
        .from("criativo")
        .select(`
          id_criativo,
          id_criativo_externo,
          url_final,
          url_esperada,
          campanha!inner(
            id_campanha,
            ativa,
            url_esperada,
            conta_anuncio!inner(id_empresa)
          )
        `)
        .eq("campanha.ativa", true);

      if (empresaId) {
        query = query.eq("campanha.conta_anuncio.id_empresa", empresaId);
      }

      const { data: criativos, error: criativosError } = await query;
      if (criativosError) throw criativosError;

      // Buscar leads para verificar match
      let leadsQuery = supabase
        .from("lead")
        .select("id_lead, id_criativo, utm_content");

      if (empresaId) {
        leadsQuery = leadsQuery.eq("id_empresa", empresaId);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Calcular métricas
      const totalCriativos = criativos?.length || 0;
      const totalLeads = leads?.length || 0;

      // 1. Criativos com UTM na URL
      const criativosComUtm = criativos?.filter((c: any) => {
        const url = c.url_final || "";
        return url.includes("utm_") || url.includes("UTM_");
      }).length || 0;

      // 2. Leads com match de criativo
      const leadsComMatch = leads?.filter((l: any) => l.id_criativo !== null).length || 0;

      // 3. Criativos com URL capturada
      const criativosComUrl = criativos?.filter((c: any) => 
        c.url_final && c.url_final.trim() !== ""
      ).length || 0;

      // 4. Criativos com URL esperada configurada (própria ou herdada da campanha)
      const criativosComUrlEsperada = criativos?.filter((c: any) => 
        (c.url_esperada && c.url_esperada.trim() !== "") ||
        (c.campanha?.url_esperada && c.campanha.url_esperada.trim() !== "")
      ).length || 0;

      // Calcular percentuais
      const percentUtm = totalCriativos > 0 ? (criativosComUtm / totalCriativos) * 100 : 0;
      const percentMatch = totalLeads > 0 ? (leadsComMatch / totalLeads) * 100 : 0;
      const percentUrl = totalCriativos > 0 ? (criativosComUrl / totalCriativos) * 100 : 0;
      const percentEsperada = totalCriativos > 0 ? (criativosComUrlEsperada / totalCriativos) * 100 : 0;

      // Score ponderado (0-100)
      const score = (
        (percentUtm * 0.25) +
        (percentMatch * 0.25) +
        (percentUrl * 0.25) +
        (percentEsperada * 0.25)
      );

      return {
        score: Math.round(score),
        componentes: [
          {
            nome: "UTM nos criativos",
            valor: criativosComUtm,
            total: totalCriativos,
            percent: percentUtm,
          },
          {
            nome: "Match leads↔criativo",
            valor: leadsComMatch,
            total: totalLeads,
            percent: percentMatch,
          },
          {
            nome: "URL capturada",
            valor: criativosComUrl,
            total: totalCriativos,
            percent: percentUrl,
          },
          {
            nome: "URL esperada configurada",
            valor: criativosComUrlEsperada,
            total: totalCriativos,
            percent: percentEsperada,
          },
        ],
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = scoreData?.score || 0;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 50) return "Moderado";
    if (score >= 25) return "Baixo";
    return "Crítico";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusIcon = (percent: number) => {
    if (percent >= 80) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (percent >= 50) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusLabel = (percent: number) => {
    if (percent >= 80) return "Bom";
    if (percent >= 50) return "Atenção";
    if (percent >= 25) return "Baixo";
    return "Crítico";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🎯 Tracking Score
            </CardTitle>
            <CardDescription>
              Qualidade do rastreamento de campanhas e atribuição de leads
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
              {score}
            </div>
            <Badge variant={score >= 50 ? "default" : "destructive"}>
              {getScoreLabel(score)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Barra de progresso principal */}
        <div className="mb-6">
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${getProgressColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Componentes do score */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Componentes do Score:</h4>
          
          {scoreData?.componentes.map((comp, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(comp.percent)}
                <span className="text-sm">{comp.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {comp.valor}/{comp.total}
                </span>
                <Badge 
                  variant={comp.percent >= 50 ? "secondary" : "destructive"}
                  className="min-w-[60px] justify-center"
                >
                  {comp.percent.toFixed(0)}%
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {getStatusLabel(comp.percent)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Link para validação detalhada */}
        <div className="mt-6 pt-4 border-t">
          <Link 
            to="/campanhas" 
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Ver detalhes de validação UTM
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
