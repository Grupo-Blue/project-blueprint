import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, Eye, MousePointerClick, Users } from "lucide-react";

interface ServerSideComparisonProps {
  empresaId?: string;
}

export function ServerSideComparison({ empresaId }: ServerSideComparisonProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["server-side-comparison", empresaId],
    queryFn: async () => {
      // Buscar leads
      let leadsQuery = supabase
        .from("lead")
        .select(`
          id_lead,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          stape_client_id,
          stape_fbp,
          stape_fbc,
          stape_gclid,
          stape_tempo_total_segundos,
          stape_paginas_visitadas,
          ga4_tempo_site_segundos,
          ga4_sessoes
        `);

      if (empresaId) {
        leadsQuery = leadsQuery.eq("id_empresa", empresaId);
      }

      const { data: leads } = await leadsQuery;

      if (!leads || leads.length === 0) {
        return null;
      }

      // Calcular métricas client-side vs server-side
      const totalLeads = leads.length;

      // UTMs client-side (vem do formulário/landing page)
      const leadsComUtmClientSide = leads.filter(l => 
        l.utm_source || l.utm_medium || l.utm_campaign || l.utm_content
      ).length;

      // Dados server-side (Stape)
      const leadsComDadosServerSide = leads.filter(l => l.stape_client_id).length;

      // Facebook IDs
      const leadsComFbpClientSide = 0; // Normalmente não coletamos client-side
      const leadsComFbpServerSide = leads.filter(l => l.stape_fbp).length;

      // Facebook Click ID
      const leadsComFbcClientSide = leads.filter(l => 
        l.utm_source?.toLowerCase().includes('facebook') || 
        l.utm_source?.toLowerCase().includes('fb') ||
        l.utm_source?.toLowerCase().includes('instagram') ||
        l.utm_source?.toLowerCase().includes('ig')
      ).length;
      const leadsComFbcServerSide = leads.filter(l => l.stape_fbc).length;

      // Google Click ID
      const leadsComGclidClientSide = leads.filter(l => 
        l.utm_source?.toLowerCase().includes('google') ||
        l.utm_source?.toLowerCase() === 'cpc'
      ).length;
      const leadsComGclidServerSide = leads.filter(l => l.stape_gclid).length;

      // Tempo no site
      const leadsComTempoGA4 = leads.filter(l => l.ga4_tempo_site_segundos && l.ga4_tempo_site_segundos > 0).length;
      const leadsComTempoStape = leads.filter(l => l.stape_tempo_total_segundos && l.stape_tempo_total_segundos > 0).length;

      // Calcular tempo médio
      const tempoMedioGA4 = leads
        .filter(l => l.ga4_tempo_site_segundos && l.ga4_tempo_site_segundos > 0)
        .reduce((acc, l) => acc + (l.ga4_tempo_site_segundos || 0), 0) / (leadsComTempoGA4 || 1);

      const tempoMedioStape = leads
        .filter(l => l.stape_tempo_total_segundos && l.stape_tempo_total_segundos > 0)
        .reduce((acc, l) => acc + (l.stape_tempo_total_segundos || 0), 0) / (leadsComTempoStape || 1);

      // Páginas visitadas
      const leadsComPaginasStape = leads.filter(l => 
        l.stape_paginas_visitadas && 
        Array.isArray(l.stape_paginas_visitadas) && 
        (l.stape_paginas_visitadas as unknown[]).length > 0
      ).length;

      const mediaPaginasStape = leads
        .filter(l => l.stape_paginas_visitadas && Array.isArray(l.stape_paginas_visitadas))
        .reduce((acc, l) => acc + ((l.stape_paginas_visitadas as unknown[])?.length || 0), 0) / (leadsComPaginasStape || 1);

      return {
        totalLeads,
        comparacoes: [
          {
            metrica: "Atribuição de origem",
            icone: "users",
            clientSide: { valor: leadsComUtmClientSide, percent: (leadsComUtmClientSide / totalLeads) * 100 },
            serverSide: { valor: leadsComDadosServerSide, percent: (leadsComDadosServerSide / totalLeads) * 100 },
            descricao: "Leads com dados de origem identificados",
          },
          {
            metrica: "Facebook Browser ID",
            icone: "eye",
            clientSide: { valor: leadsComFbpClientSide, percent: 0 },
            serverSide: { valor: leadsComFbpServerSide, percent: (leadsComFbpServerSide / totalLeads) * 100 },
            descricao: "Identificador único para remarketing Meta",
          },
          {
            metrica: "Facebook Click ID",
            icone: "click",
            clientSide: { valor: leadsComFbcClientSide, percent: (leadsComFbcClientSide / totalLeads) * 100 },
            serverSide: { valor: leadsComFbcServerSide, percent: (leadsComFbcServerSide / totalLeads) * 100 },
            descricao: "Atribuição de cliques em anúncios Meta",
          },
          {
            metrica: "Google Click ID",
            icone: "click",
            clientSide: { valor: leadsComGclidClientSide, percent: (leadsComGclidClientSide / totalLeads) * 100 },
            serverSide: { valor: leadsComGclidServerSide, percent: (leadsComGclidServerSide / totalLeads) * 100 },
            descricao: "Atribuição de cliques em anúncios Google",
          },
        ],
        tempoMedioGA4,
        tempoMedioStape,
        leadsComTempoGA4,
        leadsComTempoStape,
        leadsComPaginasStape,
        mediaPaginasStape,
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

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground text-sm">
            Sem dados suficientes para comparação
          </p>
        </CardContent>
      </Card>
    );
  }

  const getDiffIcon = (clientPercent: number, serverPercent: number) => {
    const diff = serverPercent - clientPercent;
    if (diff > 5) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (diff < -5) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getMetricaIcon = (tipo: string) => {
    switch (tipo) {
      case "users": return <Users className="h-4 w-4" />;
      case "eye": return <Eye className="h-4 w-4" />;
      case "click": return <MousePointerClick className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const formatTempo = (segundos: number) => {
    if (segundos < 60) return `${Math.round(segundos)}s`;
    return `${Math.round(segundos / 60)}min`;
  };

  return (
    <Card>
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Client vs Server-Side
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Comparação de qualidade de dados ({data.totalLeads} leads)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
        {/* Tabela de comparação */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Métrica</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Client</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Server</th>
                <th className="text-center py-2 font-medium text-muted-foreground">Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.comparacoes.map((comp, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {getMetricaIcon(comp.icone)}
                      <span className="truncate max-w-[120px] md:max-w-none">{comp.metrica}</span>
                    </div>
                  </td>
                  <td className="text-center py-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {comp.clientSide.percent.toFixed(0)}%
                    </Badge>
                  </td>
                  <td className="text-center py-2">
                    <Badge 
                      variant={comp.serverSide.percent > comp.clientSide.percent ? "default" : "outline"}
                      className="font-mono text-xs"
                    >
                      {comp.serverSide.percent.toFixed(0)}%
                    </Badge>
                  </td>
                  <td className="text-center py-2">
                    {getDiffIcon(comp.clientSide.percent, comp.serverSide.percent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Métricas de comportamento */}
        <div className="mt-4 pt-4 border-t space-y-3">
          <h4 className="text-xs md:text-sm font-medium text-muted-foreground">Dados Comportamentais (Server-Side):</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Tempo médio no site</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{formatTempo(data.tempoMedioStape || 0)}</span>
                {data.tempoMedioGA4 > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (GA4: {formatTempo(data.tempoMedioGA4)})
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.leadsComTempoStape} leads com dados
              </p>
            </div>
            
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Páginas por sessão</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{data.mediaPaginasStape.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.leadsComPaginasStape} leads rastreados
              </p>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Client-Side:</strong> Dados coletados pelo navegador (podem ser bloqueados).
            <br />
            <strong>Server-Side:</strong> Dados coletados pelo Stape (mais confiáveis, 1st-party).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
