import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserX, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";

export function LeadsOrfaos() {
  const { empresaSelecionada } = useEmpresa();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-orfaos", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("lead")
        .select("id_lead, nome_lead, data_criacao, stage_atual, url_pipedrive, proprietario_nome")
        .is("proprietario_nome", null)
        .or("merged.is.null,merged.eq.false")
        .not("nome_lead", "like", "%(cópia)%")
        .not("stage_atual", "eq", "Perdido")
        .order("data_criacao", { ascending: false })
        .limit(20);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  if (isLoading) {
    return <Card><CardContent className="pt-6"><div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserX className="h-4 w-4" />
          Leads sem Proprietário
          {leads && leads.length > 0 && (
            <Badge variant="destructive" className="text-[10px] ml-1">{leads.length}</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">Leads ativos sem dono atribuído no CRM</CardDescription>
      </CardHeader>
      <CardContent>
        {leads && leads.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {leads.map((lead: any) => (
              <div key={lead.id_lead} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{lead.nome_lead}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {lead.stage_atual && <Badge variant="outline" className="text-[9px] mr-1 px-1">{lead.stage_atual}</Badge>}
                    {formatDistanceToNow(new Date(lead.data_criacao), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
                {lead.url_pipedrive && (
                  <a href={lead.url_pipedrive} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Todos os leads ativos possuem um proprietário atribuído ✅
          </div>
        )}
      </CardContent>
    </Card>
  );
}
