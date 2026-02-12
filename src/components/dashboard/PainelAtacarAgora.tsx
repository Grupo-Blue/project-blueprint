import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PainelAtacarAgora() {
  const { empresaSelecionada } = useEmpresa();

  const { data: leads } = useQuery({
    queryKey: ["atacar-agora", empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada) return [];
      const { data } = await supabase
        .from("lead")
        .select("nome_lead, data_criacao, tempo_primeira_resposta_seg, proprietario_nome, url_pipedrive, stage_atual")
        .eq("id_empresa", empresaSelecionada)
        .in("stage_atual", ["Novo", "Tentando contato", "Em andamento"])
        .or("tempo_primeira_resposta_seg.is.null,tempo_primeira_resposta_seg.gt.900")
        .order("data_criacao", { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
    enabled: !!empresaSelecionada,
  });

  const getSLABadge = (seg: number | null, dataCriacao: string) => {
    if (seg === null) {
      const diffMin = (Date.now() - new Date(dataCriacao).getTime()) / 60000;
      if (diffMin > 60) return <Badge variant="destructive" className="text-xs">Sem resposta</Badge>;
      if (diffMin > 15) return <Badge className="bg-amber-500 text-white text-xs">Atrasado</Badge>;
      return <Badge variant="secondary" className="text-xs">Aguardando</Badge>;
    }
    if (seg > 3600) return <Badge variant="destructive" className="text-xs">{Math.round(seg / 60)}min</Badge>;
    if (seg > 900) return <Badge className="bg-amber-500 text-white text-xs">{Math.round(seg / 60)}min</Badge>;
    return <Badge variant="secondary" className="text-xs">{Math.round(seg / 60)}min</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Atacar Agora
          {leads && leads.length > 0 && (
            <Badge variant="destructive" className="ml-2">{leads.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!leads || leads.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead fora do SLA 🎉</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {leads.map((lead: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{lead.nome_lead || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(lead.data_criacao), { addSuffix: true, locale: ptBR })}
                    {lead.proprietario_nome && ` · ${lead.proprietario_nome}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getSLABadge(lead.tempo_primeira_resposta_seg, lead.data_criacao)}
                  {lead.url_pipedrive && (
                    <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
