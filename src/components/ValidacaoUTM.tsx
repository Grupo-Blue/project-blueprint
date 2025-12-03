import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, XCircle, ExternalLink, RefreshCw, Link2, Unlink, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const ValidacaoUTM = () => {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: criativos, isLoading, refetch } = useQuery({
    queryKey: ["criativos-utm-validation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criativo")
        .select(`
          id_criativo,
          id_criativo_externo,
          id_anuncio_externo,
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

  // Buscar leads com utm_content para estatísticas de match
  const { data: leadsComUtm } = useQuery({
    queryKey: ["leads-utm-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select("id_lead, utm_content, utm_source, utm_medium, utm_campaign, id_criativo")
        .not("utm_content", "is", null);
      
      if (error) throw error;
      return data;
    },
  });

  const handleRecoletarCriativos = async () => {
    setIsRefreshing(true);
    try {
      const { data: integracoes, error } = await supabase
        .from("integracao")
        .select("id_integracao, tipo")
        .eq("ativo", true)
        .in("tipo", ["META_ADS", "GOOGLE_ADS"]);

      if (error) throw error;

      const promises = [];
      
      for (const int of integracoes || []) {
        const functionName = int.tipo === "META_ADS" 
          ? "coletar-criativos-meta" 
          : "coletar-criativos-google";
        
        promises.push(
          supabase.functions.invoke(functionName, {
            body: { integracao_id: int.id_integracao }
          })
        );
      }

      await Promise.all(promises);
      
      toast.success("Criativos recoletados com sucesso!");
      refetch();
    } catch (error) {
      console.error("Erro ao recoletar criativos:", error);
      toast.error("Erro ao recoletar criativos");
    } finally {
      setIsRefreshing(false);
    }
  };

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
      
      return hasUtmContent || (hasUtmSource && hasUtmMedium && hasUtmCampaign);
    } catch {
      return false;
    }
  };

  // Função para extrair UTMs da URL
  const extrairUTMsURL = (url: string | null) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return {
        utm_content: urlObj.searchParams.get('utm_content'),
        utm_source: urlObj.searchParams.get('utm_source'),
        utm_medium: urlObj.searchParams.get('utm_medium'),
        utm_campaign: urlObj.searchParams.get('utm_campaign'),
      };
    } catch {
      return null;
    }
  };

  // Verificar se URL tem placeholders não resolvidos
  const temPlaceholdersNaoResolvidos = (url: string | null) => {
    if (!url) return false;
    return url.includes('{{') || url.includes('%7B%7B');
  };

  // Criativos com URL e UTM configurada
  const criativosComUTMnaURL = criativos?.filter(c => verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos sem URL capturada
  const criativosSemURL = criativos?.filter(c => !c.url_final) || [];
  
  // Criativos com URL mas sem UTM
  const criativosComURLSemUTM = criativos?.filter(c => c.url_final && !verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos com placeholders não resolvidos
  const criativosComPlaceholders = criativos?.filter(c => temPlaceholdersNaoResolvidos(c.url_final)) || [];
  
  // Criativos com pelo menos um lead vinculado
  const criativosComLeads = criativos?.filter(c => c.lead && c.lead.length > 0) || [];
  
  // Criativos sem nenhum lead
  const criativosSemLeads = criativos?.filter(c => !c.lead || c.lead.length === 0) || [];
  
  // Estatísticas de match lead ↔ criativo
  const leadsComMatch = leadsComUtm?.filter(l => l.id_criativo) || [];
  const leadsSemMatch = leadsComUtm?.filter(l => !l.id_criativo) || [];
  
  // UTMs mais comuns nos leads (para diagnóstico)
  const utmContentStats: Record<string, number> = {};
  leadsSemMatch.forEach(l => {
    if (l.utm_content) {
      utmContentStats[l.utm_content] = (utmContentStats[l.utm_content] || 0) + 1;
    }
  });
  const topUtmContentsSemMatch = Object.entries(utmContentStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  const porcentagemComUTMnaURL = criativos && criativos.length > 0
    ? (criativosComUTMnaURL.length / criativos.length) * 100
    : 0;
    
  const porcentagemMatchLeads = leadsComUtm && leadsComUtm.length > 0
    ? (leadsComMatch.length / leadsComUtm.length) * 100
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
          <div className="flex gap-2">
            <Badge 
              variant={status === "success" ? "default" : status === "warning" ? "secondary" : "destructive"}
            >
              {porcentagemComUTMnaURL.toFixed(0)}% com UTM
            </Badge>
            <Badge 
              variant={porcentagemMatchLeads >= 80 ? "default" : porcentagemMatchLeads >= 50 ? "secondary" : "destructive"}
            >
              <Link2 className="h-3 w-3 mr-1" />
              {porcentagemMatchLeads.toFixed(0)}% match
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
            <p className="text-sm text-muted-foreground">Leads c/ Match</p>
            <p className="text-2xl font-bold text-green-600">{leadsComMatch.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Leads s/ Match</p>
            <p className="text-2xl font-bold text-red-600">{leadsSemMatch.length}</p>
          </div>
        </div>

        {/* Alertas e detalhes */}
        <Accordion type="single" collapsible className="w-full">
          {criativosSemURL.length > 0 && (
            <AccordionItem value="sem-url">
              <AccordionTrigger className="text-yellow-600">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {criativosSemURL.length} criativo{criativosSemURL.length !== 1 ? 's' : ''} sem URL capturada
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Podem ser anúncios de engajamento (vídeo, post boost) que não têm link externo, ou a API não retornou a URL.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosSemURL.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                      <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      <code className="text-[10px] text-muted-foreground">Ad: {c.id_anuncio_externo || 'N/A'}</code>
                    </div>
                  ))}
                  {criativosSemURL.length > 10 && (
                    <p className="text-xs text-muted-foreground">... e mais {criativosSemURL.length - 10}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRecoletarCriativos}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Recoletar
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {criativosComURLSemUTM.length > 0 && (
            <AccordionItem value="sem-utm">
              <AccordionTrigger className="text-destructive">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {criativosComURLSemUTM.length} criativo{criativosComURLSemUTM.length !== 1 ? 's' : ''} com URL mas sem UTM
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure os parâmetros UTM diretamente nos anúncios das plataformas (Meta/Google).
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosComURLSemUTM.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                        <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground break-all">{c.url_final}</code>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate("/guia-utm")}>
                    Ver Guia UTM <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {criativosComPlaceholders.length > 0 && (
            <AccordionItem value="placeholders">
              <AccordionTrigger className="text-orange-600">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {criativosComPlaceholders.length} URL{criativosComPlaceholders.length !== 1 ? 's' : ''} com placeholders não resolvidos
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Algumas URLs contêm placeholders dinâmicos do Meta (ex: {"{{campaign.name}}"}) que não foram resolvidos.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosComPlaceholders.slice(0, 5).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs p-2 bg-muted rounded">
                      <code className="text-[10px] text-orange-600 break-all">{c.url_final}</code>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {leadsSemMatch.length > 0 && (
            <AccordionItem value="leads-sem-match">
              <AccordionTrigger className="text-red-600">
                <div className="flex items-center gap-2">
                  <Unlink className="h-4 w-4" />
                  {leadsSemMatch.length} lead{leadsSemMatch.length !== 1 ? 's' : ''} com UTM mas sem match com criativo
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Esses leads têm utm_content preenchido, mas não foi possível encontrar o criativo correspondente no banco.
                  O sistema busca por Ad ID e Creative ID.
                </p>
                {topUtmContentsSemMatch.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-2">UTM Content mais comuns sem match:</p>
                    <div className="space-y-1">
                      {topUtmContentsSemMatch.map(([utmContent, count]) => (
                        <div key={utmContent} className="text-xs flex items-center justify-between p-2 bg-muted rounded">
                          <code className="text-muted-foreground">{utmContent}</code>
                          <Badge variant="secondary">{count} lead{count !== 1 ? 's' : ''}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRecoletarCriativos} disabled={isRefreshing}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Recoletar Criativos
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {status === "success" && porcentagemMatchLeads >= 80 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Rastreamento Funcionando!</AlertTitle>
            <AlertDescription>
              A maioria dos criativos tem UTM configurada e os leads estão sendo vinculados corretamente.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRecoletarCriativos}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Recoletar Criativos
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/guia-utm")}>
            Ver Guia UTM
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
            Ver Campanhas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
