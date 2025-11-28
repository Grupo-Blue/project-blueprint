import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, Link as LinkIcon, Users, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CampanhaFluxoDiagramProps {
  campanhaId: string;
  campanhaNome: string;
}

export const CampanhaFluxoDiagram = ({ campanhaId, campanhaNome }: CampanhaFluxoDiagramProps) => {
  const { data: fluxoData, isLoading } = useQuery({
    queryKey: ["campanha-fluxo", campanhaId],
    queryFn: async () => {
      // Buscar criativos da campanha
      const { data: criativos, error: criativosError } = await supabase
        .from("criativo")
        .select("*")
        .eq("id_campanha", campanhaId)
        .eq("ativo", true);

      if (criativosError) throw criativosError;

      // Buscar leads relacionados aos criativos
      const criativoIds = criativos?.map(c => c.id_criativo) || [];
      const { data: leads, error: leadsError } = await supabase
        .from("lead")
        .select("*")
        .in("id_criativo", criativoIds);

      if (leadsError) throw leadsError;

      // Agrupar dados por criativo
      const criativosComLeads = criativos?.map(criativo => {
        const leadsAssociados = leads?.filter(l => l.id_criativo === criativo.id_criativo) || [];
        const vendas = leadsAssociados.filter(l => l.venda_realizada).length;
        const mqls = leadsAssociados.filter(l => l.is_mql).length;

        return {
          ...criativo,
          totalLeads: leadsAssociados.length,
          vendas,
          mqls,
          leadsComUTM: leadsAssociados.filter(l => l.utm_content).length,
          leadsSemUTM: leadsAssociados.filter(l => !l.utm_content).length,
        };
      });

      return { criativos: criativosComLeads };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fluxoData?.criativos || fluxoData.criativos.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum criativo encontrado</h3>
        <p className="text-sm text-muted-foreground">
          Esta campanha ainda não possui criativos ativos ou dados de leads.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-2">{campanhaNome}</h3>
        <p className="text-sm text-muted-foreground">Fluxo de conversão por criativo</p>
      </div>

      <div className="space-y-8">
        {fluxoData.criativos.map((criativo) => (
          <Card key={criativo.id_criativo} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    {criativo.tipo}
                  </CardTitle>
                  {criativo.descricao && (
                    <p className="text-sm text-muted-foreground">{criativo.descricao}</p>
                  )}
                </div>
                <Badge variant={criativo.ativo ? "default" : "secondary"}>
                  {criativo.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Coluna 1: URL e UTM */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <LinkIcon className="h-4 w-4" />
                    <span>URL de Destino</span>
                  </div>
                  
                  {criativo.url_final ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-muted/30 rounded-lg break-all text-xs">
                        {criativo.url_final}
                      </div>
                      
                      {criativo.url_final.includes("utm_") ? (
                        <div className="flex items-center gap-2 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>UTM configurado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <XCircle className="h-3 w-3" />
                          <span>UTM não encontrado</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      URL não capturado
                    </div>
                  )}
                </div>

                {/* Coluna 2: Leads */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4" />
                    <span>Leads Gerados</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{criativo.totalLeads}</div>
                      <div className="text-xs text-muted-foreground">Total de leads</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                        <div className="font-semibold text-green-700 dark:text-green-400">
                          {criativo.leadsComUTM}
                        </div>
                        <div className="text-muted-foreground">Com UTM</div>
                      </div>
                      <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                        <div className="font-semibold text-orange-700 dark:text-orange-400">
                          {criativo.leadsSemUTM}
                        </div>
                        <div className="text-muted-foreground">Sem UTM</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna 3: Conversões */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CheckCircle className="h-4 w-4" />
                    <span>Conversões</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {criativo.mqls}
                      </div>
                      <div className="text-xs text-muted-foreground">MQLs</div>
                    </div>

                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {criativo.vendas}
                      </div>
                      <div className="text-xs text-muted-foreground">Vendas</div>
                    </div>

                    {criativo.totalLeads > 0 && (
                      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                        Taxa de conversão: {((criativo.vendas / criativo.totalLeads) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Linha de fluxo visual */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span>Anúncio</span>
                  </div>
                  <div className="flex-1 h-px bg-border mx-4"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span>Landing Page</span>
                  </div>
                  <div className="flex-1 h-px bg-border mx-4"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Lead</span>
                  </div>
                  <div className="flex-1 h-px bg-border mx-4"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Venda</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
