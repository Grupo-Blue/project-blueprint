import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ValidacaoUTM = () => {
  const navigate = useNavigate();

  const { data: criativos, isLoading } = useQuery({
    queryKey: ["criativos-utm-validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo")
        .select(`
          id_criativo,
          id_criativo_externo,
          descricao,
          tipo,
          ativo,
          campanha:id_campanha (
            nome,
            conta_anuncio:id_conta (
              plataforma,
              empresa:id_empresa (nome)
            )
          ),
          lead:lead!id_criativo (id_lead)
        `)
        .eq("ativo", true);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;

  const criativosSemLeads = criativos?.filter(c => !c.lead || c.lead.length === 0) || [];
  const criativosComLeads = criativos?.filter(c => c.lead && c.lead.length > 0) || [];
  
  const porcentagemComLeads = criativos && criativos.length > 0
    ? (criativosComLeads.length / criativos.length) * 100
    : 0;

  const status = porcentagemComLeads >= 80 ? "success" : porcentagemComLeads >= 50 ? "warning" : "error";

  return (
    <Card className={status === "error" ? "border-destructive" : status === "warning" ? "border-yellow-500" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {status === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {status === "warning" && <AlertCircle className="h-5 w-5 text-yellow-600" />}
              {status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
              Validação de Rastreamento UTM
            </CardTitle>
            <CardDescription>
              Status do rastreamento de criativos para leads
            </CardDescription>
          </div>
          <Badge 
            variant={status === "success" ? "default" : status === "warning" ? "secondary" : "destructive"}
          >
            {porcentagemComLeads.toFixed(0)}% rastreado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Criativos Ativos</p>
            <p className="text-2xl font-bold">{criativos?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Com Leads Vinculados</p>
            <p className="text-2xl font-bold text-green-600">{criativosComLeads.length}</p>
          </div>
        </div>

        {criativosSemLeads.length > 0 && (
          <Alert variant={status === "error" ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {criativosSemLeads.length} criativo{criativosSemLeads.length !== 1 ? 's' : ''} sem leads rastreados
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">
                Possíveis causas:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li>utm_content não configurado nos anúncios</li>
                <li>Campos customizados do Pipedrive não mapeados</li>
                <li>Criativos novos ainda sem conversões</li>
              </ul>
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/guia-utm")}
                >
                  Ver Guia UTM <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/criativos")}
                >
                  Ver Criativos
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {status === "success" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Rastreamento Funcionando!</AlertTitle>
            <AlertDescription>
              A maioria dos criativos está gerando leads rastreados corretamente.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};