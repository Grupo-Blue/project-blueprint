import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Server, Activity, Link2, Zap } from "lucide-react";
import { format, subDays, subHours } from "date-fns";

interface StapeHealthWidgetProps {
  empresaId?: string;
}

export function StapeHealthWidget({ empresaId }: StapeHealthWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["stape-health", empresaId],
    queryFn: async () => {
      const agora = new Date();
      const ultimas24h = subHours(agora, 24);
      const ultimos7d = subDays(agora, 7);

      // Eventos últimas 24h
      let eventosQuery24h = supabase
        .from("stape_evento")
        .select("id, event_name", { count: "exact" })
        .gte("event_timestamp", ultimas24h.toISOString());

      if (empresaId) {
        eventosQuery24h = eventosQuery24h.eq("id_empresa", empresaId);
      }

      const { count: eventos24h } = await eventosQuery24h;

      // Eventos últimos 7 dias
      let eventosQuery7d = supabase
        .from("stape_evento")
        .select("id, event_name", { count: "exact" })
        .gte("event_timestamp", ultimos7d.toISOString());

      if (empresaId) {
        eventosQuery7d = eventosQuery7d.eq("id_empresa", empresaId);
      }

      const { count: eventos7d } = await eventosQuery7d;

      // Eventos por tipo (últimos 7 dias)
      let eventosDetalhadosQuery = supabase
        .from("stape_evento")
        .select("event_name")
        .gte("event_timestamp", ultimos7d.toISOString());

      if (empresaId) {
        eventosDetalhadosQuery = eventosDetalhadosQuery.eq("id_empresa", empresaId);
      }

      const { data: eventosDetalhados } = await eventosDetalhadosQuery;

      const eventosPorTipo = (eventosDetalhados || []).reduce((acc, e) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Total de leads
      let leadsQuery = supabase.from("lead").select("id_lead, stape_client_id, stape_fbp, stape_gclid", { count: "exact" });

      if (empresaId) {
        leadsQuery = leadsQuery.eq("id_empresa", empresaId);
      }

      const { data: leads, count: totalLeads } = await leadsQuery;

      // Leads com dados Stape
      const leadsComStape = leads?.filter(l => l.stape_client_id !== null).length || 0;
      const leadsComFbp = leads?.filter(l => l.stape_fbp !== null).length || 0;
      const leadsComGclid = leads?.filter(l => l.stape_gclid !== null).length || 0;

      const percentStape = totalLeads && totalLeads > 0 ? (leadsComStape / totalLeads) * 100 : 0;
      const percentFbp = totalLeads && totalLeads > 0 ? (leadsComFbp / totalLeads) * 100 : 0;
      const percentGclid = totalLeads && totalLeads > 0 ? (leadsComGclid / totalLeads) * 100 : 0;

      // Client IDs únicos nos eventos
      let clientIdsQuery = supabase
        .from("stape_evento")
        .select("client_id")
        .gte("event_timestamp", ultimos7d.toISOString());

      if (empresaId) {
        clientIdsQuery = clientIdsQuery.eq("id_empresa", empresaId);
      }

      const { data: clientIds } = await clientIdsQuery;
      const clientIdsUnicos = [...new Set(clientIds?.map(c => c.client_id) || [])].length;

      // Eventos vinculados a leads
      let eventosVinculadosQuery = supabase
        .from("stape_evento")
        .select("id", { count: "exact" })
        .not("id_lead", "is", null)
        .gte("event_timestamp", ultimos7d.toISOString());

      if (empresaId) {
        eventosVinculadosQuery = eventosVinculadosQuery.eq("id_empresa", empresaId);
      }

      const { count: eventosVinculados } = await eventosVinculadosQuery;

      const taxaMatch = eventos7d && eventos7d > 0 ? ((eventosVinculados || 0) / eventos7d) * 100 : 0;

      return {
        eventos24h: eventos24h || 0,
        eventos7d: eventos7d || 0,
        eventosPorTipo,
        totalLeads: totalLeads || 0,
        leadsComStape,
        leadsComFbp,
        leadsComGclid,
        percentStape,
        percentFbp,
        percentGclid,
        clientIdsUnicos,
        eventosVinculados: eventosVinculados || 0,
        taxaMatch,
      };
    },
    refetchInterval: 60000, // Atualiza a cada minuto
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

  const getStatusColor = (percent: number) => {
    if (percent >= 70) return "text-green-500";
    if (percent >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 70) return "bg-green-500";
    if (percent >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusIcon = (percent: number) => {
    if (percent >= 70) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (percent >= 40) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader className="p-3 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Server className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Stape Server-Side
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Tracking via GTM Server
            </CardDescription>
          </div>
          <Badge variant={data?.eventos24h && data.eventos24h > 0 ? "default" : "secondary"} className="shrink-0">
            {data?.eventos24h || 0} eventos/24h
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0 md:pt-0 space-y-4">
        {/* Eventos recebidos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Últimas 24h</span>
            </div>
            <div className="text-lg md:text-xl font-bold">{data?.eventos24h || 0}</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
            </div>
            <div className="text-lg md:text-xl font-bold">{data?.eventos7d || 0}</div>
          </div>
        </div>

        {/* Leads com dados Stape */}
        <div className="space-y-3">
          <h4 className="text-xs md:text-sm font-medium text-muted-foreground">Cobertura de Leads:</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getStatusIcon(data?.percentStape || 0)}
                <span className="text-xs md:text-sm truncate">Com dados Stape</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {data?.leadsComStape || 0}/{data?.totalLeads || 0}
                </span>
                <Badge variant="secondary" className="min-w-[50px] justify-center text-xs">
                  {(data?.percentStape || 0).toFixed(0)}%
                </Badge>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full transition-all ${getProgressColor(data?.percentStape || 0)}`}
                style={{ width: `${data?.percentStape || 0}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {getStatusIcon(data?.percentFbp || 0)}
              <span className="text-xs md:text-sm truncate">Com Facebook ID (fbp)</span>
            </div>
            <Badge variant="secondary" className="min-w-[50px] justify-center text-xs">
              {(data?.percentFbp || 0).toFixed(0)}%
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {getStatusIcon(data?.percentGclid || 0)}
              <span className="text-xs md:text-sm truncate">Com Google Click ID</span>
            </div>
            <Badge variant="secondary" className="min-w-[50px] justify-center text-xs">
              {(data?.percentGclid || 0).toFixed(0)}%
            </Badge>
          </div>
        </div>

        {/* Match eventos → leads */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs md:text-sm">Match Eventos → Leads</span>
            </div>
            <Badge 
              variant={data?.taxaMatch && data.taxaMatch >= 30 ? "default" : "secondary"}
              className="text-xs"
            >
              {(data?.taxaMatch || 0).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {data?.eventosVinculados || 0} de {data?.eventos7d || 0} eventos vinculados • {data?.clientIdsUnicos || 0} visitantes únicos
          </p>
        </div>

        {/* Eventos por tipo */}
        {data?.eventosPorTipo && Object.keys(data.eventosPorTipo).length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Eventos por tipo (7d):</h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.eventosPorTipo)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([nome, count]) => (
                  <Badge key={nome} variant="outline" className="text-xs">
                    {nome}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
