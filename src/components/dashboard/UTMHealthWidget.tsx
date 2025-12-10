import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, Link2, Target, Info, Loader2 } from "lucide-react";

interface UTMHealthWidgetProps {
  empresaId?: string;
}

export const UTMHealthWidget = ({ empresaId }: UTMHealthWidgetProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['utm-health', empresaId],
    queryFn: async () => {
      // Buscar leads com e sem UTMs
      let leadsQuery = supabase
        .from('lead')
        .select('id_lead, utm_source, utm_medium, utm_campaign, utm_content, id_criativo');
      
      if (empresaId) {
        leadsQuery = leadsQuery.eq('id_empresa', empresaId);
      }
      
      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Buscar criativos
      const { data: criativos, error: criativosError } = await supabase
        .from('criativo')
        .select('id_criativo, url_esperada, url_final, ativo')
        .eq('ativo', true);
      
      if (criativosError) throw criativosError;

      // Calcular métricas
      const totalLeads = leads?.length || 0;
      
      // Leads com UTM completo (source + medium + campaign + content)
      const leadsUtmCompleto = leads?.filter(l => 
        l.utm_source && l.utm_medium && l.utm_campaign && l.utm_content
      ).length || 0;
      
      // Leads com pelo menos source
      const leadsComSource = leads?.filter(l => l.utm_source).length || 0;
      
      // Leads vinculados a criativo
      const leadsVinculados = leads?.filter(l => l.id_criativo).length || 0;
      
      // UTM contents únicos sem match
      const utmContentsSemMatch = new Set<string>();
      leads?.forEach(l => {
        if (l.utm_content && !l.id_criativo) {
          // Ignorar placeholders
          if (!l.utm_content.includes('{{')) {
            utmContentsSemMatch.add(l.utm_content);
          }
        }
      });

      // Criativos sem URL capturada
      const criativosSemUrl = criativos?.filter(c => !c.url_final).length || 0;
      const totalCriativos = criativos?.length || 0;

      // Criativos com URL esperada
      const criativosComUrlEsperada = criativos?.filter(c => c.url_esperada).length || 0;

      return {
        totalLeads,
        leadsUtmCompleto,
        leadsComSource,
        leadsVinculados,
        utmContentsSemMatch: Array.from(utmContentsSemMatch).slice(0, 10),
        totalUtmSemMatch: utmContentsSemMatch.size,
        criativosSemUrl,
        totalCriativos,
        criativosComUrlEsperada,
        percentUtmCompleto: totalLeads > 0 ? Math.round((leadsUtmCompleto / totalLeads) * 100) : 0,
        percentVinculados: totalLeads > 0 ? Math.round((leadsVinculados / totalLeads) * 100) : 0,
        percentCriativosComUrl: totalCriativos > 0 ? Math.round(((totalCriativos - criativosSemUrl) / totalCriativos) * 100) : 0
      };
    },
    staleTime: 60000
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Saúde do Rastreamento UTM
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return "text-green-500";
    if (percent >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Saúde do Rastreamento UTM
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Monitora a qualidade do rastreamento de leads: UTMs completos, vinculação a criativos e URLs capturadas.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* UTM Completo */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">UTM Completo</span>
            <span className={getStatusColor(data?.percentUtmCompleto || 0)}>
              {data?.leadsUtmCompleto || 0}/{data?.totalLeads || 0} ({data?.percentUtmCompleto || 0}%)
            </span>
          </div>
          <Progress 
            value={data?.percentUtmCompleto || 0} 
            className="h-2"
          />
        </div>

        {/* Leads Vinculados */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Leads → Criativos</span>
            <span className={getStatusColor(data?.percentVinculados || 0)}>
              {data?.leadsVinculados || 0}/{data?.totalLeads || 0} ({data?.percentVinculados || 0}%)
            </span>
          </div>
          <Progress 
            value={data?.percentVinculados || 0} 
            className="h-2"
          />
        </div>

        {/* Criativos com URL */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Criativos com URL</span>
            <span className={getStatusColor(data?.percentCriativosComUrl || 0)}>
              {(data?.totalCriativos || 0) - (data?.criativosSemUrl || 0)}/{data?.totalCriativos || 0} ({data?.percentCriativosComUrl || 0}%)
            </span>
          </div>
          <Progress 
            value={data?.percentCriativosComUrl || 0} 
            className="h-2"
          />
        </div>

        {/* Alertas */}
        <div className="pt-2 border-t space-y-2">
          {(data?.totalUtmSemMatch || 0) > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-muted-foreground">
                  {data?.totalUtmSemMatch} utm_content sem match com criativo
                </span>
                {data?.utmContentsSemMatch && data.utmContentsSemMatch.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.utmContentsSemMatch.slice(0, 3).map((utm, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] truncate max-w-[120px]">
                        {utm.length > 20 ? utm.substring(0, 20) + '...' : utm}
                      </Badge>
                    ))}
                    {data.utmContentsSemMatch.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{data.utmContentsSemMatch.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(data?.criativosSemUrl || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="text-muted-foreground">
                {data?.criativosSemUrl} criativos sem URL capturada
              </span>
            </div>
          )}

          {(data?.criativosComUrlEsperada || 0) === 0 && (data?.totalCriativos || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-muted-foreground">
                Nenhuma URL esperada configurada
              </span>
            </div>
          )}

          {(data?.percentUtmCompleto || 0) >= 80 && 
           (data?.percentVinculados || 0) >= 50 && 
           (data?.percentCriativosComUrl || 0) >= 80 && (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-green-600">Rastreamento saudável</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
