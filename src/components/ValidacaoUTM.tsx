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
          url_final,
          campanha:id_campanha (
            nome,
            conta_anuncio:id_conta (
              plataforma,
              empresa:id_empresa (nome)
            )
          ),
          lead:lead!id_criativo (id_lead, utm_content)
        `)
        .eq("ativo", true);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;

  // Função para verificar se a URL tem UTM configurada
  const verificarUTMnaURL = (url: string | null) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const hasUtmContent = urlObj.searchParams.has('utm_content');
      const hasUtmSource = urlObj.searchParams.has('utm_source');
      const hasUtmMedium = urlObj.searchParams.has('utm_medium');
      const hasUtmCampaign = urlObj.searchParams.has('utm_campaign');
      
      // Consideramos configurado se tiver pelo menos utm_content
      return hasUtmContent || (hasUtmSource && hasUtmMedium && hasUtmCampaign);
    } catch {
      return false;
    }
  };

  // Criativos com URL e UTM configurada
  const criativosComUTMnaURL = criativos?.filter(c => verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos sem URL capturada
  const criativosSemURL = criativos?.filter(c => !c.url_final) || [];
  
  // Criativos com URL mas sem UTM
  const criativosComURLSemUTM = criativos?.filter(c => c.url_final && !verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos com pelo menos um lead que tem UTM configurada
  const criativosComUTMnosLeads = criativos?.filter(c => 
    c.lead && c.lead.length > 0 && c.lead.some((l: any) => l.utm_content)
  ) || [];
  
  // Criativos com pelo menos um lead vinculado (independente de ter UTM)
  const criativosComLeads = criativos?.filter(c => c.lead && c.lead.length > 0) || [];
  
  // Criativos sem nenhum lead
  const criativosSemLeads = criativos?.filter(c => !c.lead || c.lead.length === 0) || [];
  
  const porcentagemComUTMnaURL = criativos && criativos.length > 0
    ? (criativosComUTMnaURL.length / criativos.length) * 100
    : 0;
    
  const porcentagemComLeads = criativos && criativos.length > 0
    ? (criativosComLeads.length / criativos.length) * 100
    : 0;

  const status = porcentagemComUTMnaURL >= 80 ? "success" : porcentagemComUTMnaURL >= 50 ? "warning" : "error";

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
            {porcentagemComUTMnaURL.toFixed(0)}% com UTM
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Criativos Ativos</p>
            <p className="text-2xl font-bold">{criativos?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Com UTM na URL</p>
            <p className="text-2xl font-bold text-blue-600">{criativosComUTMnaURL.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sem URL/UTM</p>
            <p className="text-2xl font-bold text-yellow-600">{criativosSemURL.length + criativosComURLSemUTM.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Com Leads</p>
            <p className="text-2xl font-bold text-green-600">{criativosComLeads.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sem Leads</p>
            <p className="text-2xl font-bold text-muted-foreground">{criativosSemLeads.length}</p>
          </div>
        </div>

        {criativosSemURL.length > 0 && (
          <Alert variant="default" className="border-yellow-500">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>
              {criativosSemURL.length} criativo{criativosSemURL.length !== 1 ? 's' : ''} sem URL capturada
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">
                A integração ainda não capturou a URL final desses anúncios. Execute a coleta de criativos novamente.
              </p>
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/integracoes")}
                >
                  Ir para Integrações
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {criativosComURLSemUTM.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {criativosComURLSemUTM.length} criativo{criativosComURLSemUTM.length !== 1 ? 's' : ''} com URL mas sem UTM
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">
                Esses anúncios têm URL configurada mas não possuem parâmetros UTM (utm_content, utm_source, utm_medium, utm_campaign).
              </p>
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

        {criativosSemLeads.length > 0 && criativosComUTMnaURL.length > 0 && (
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