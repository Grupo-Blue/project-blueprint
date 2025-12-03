import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, XCircle, ExternalLink, RefreshCw, Link2, Unlink, Info, FileQuestion, Globe, Video, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

interface Discrepancia {
  criativo: any;
  urlEsperada: string;
  urlReal: string | null;
  problemas: string[];
  utmEsperado: UTMParams;
  utmReal: UTMParams;
}

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
          url_esperada,
          campanha:id_campanha (
            id_campanha,
            nome,
            objetivo,
            ativa,
            url_esperada,
            conta_anuncio:id_conta (
              plataforma,
              empresa:id_empresa (nome)
            )
          ),
          lead:lead!id_criativo (id_lead, utm_content)
        `)
        .eq("ativo", true);
      
      if (error) throw error;
      
      // Filtrar apenas criativos de campanhas ativas
      return data?.filter(c => c.campanha?.ativa === true) || [];
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

  // Função para extrair UTMs de uma URL
  const extrairUTMs = (url: string | null): UTMParams => {
    if (!url) return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null };
    try {
      const urlObj = new URL(url);
      return {
        utm_source: urlObj.searchParams.get('utm_source'),
        utm_medium: urlObj.searchParams.get('utm_medium'),
        utm_campaign: urlObj.searchParams.get('utm_campaign'),
        utm_content: urlObj.searchParams.get('utm_content'),
        utm_term: urlObj.searchParams.get('utm_term'),
      };
    } catch {
      return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null };
    }
  };

  // Função para extrair domínio base de uma URL
  const extrairDominio = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.split('?')[0];
    } catch {
      return null;
    }
  };

  // Função para verificar se a URL tem UTM configurada
  const verificarUTMnaURL = (url: string | null) => {
    if (!url) return false;
    const utms = extrairUTMs(url);
    return utms.utm_content || (utms.utm_source && utms.utm_medium && utms.utm_campaign);
  };

  // Verificar se URL tem placeholders não resolvidos
  const temPlaceholdersNaoResolvidos = (url: string | null) => {
    if (!url) return false;
    return url.includes('{{') || url.includes('%7B%7B');
  };

  // Verificar se URL é de serviço externo (Google Drive, etc)
  const isURLExterna = (url: string | null) => {
    if (!url) return false;
    return url.includes('drive.google.com') || 
           url.includes('docs.google.com') || 
           url.includes('dropbox.com') ||
           url.includes('sharepoint.com');
  };

  // Detectar se é anúncio de engajamento (sem URL esperada)
  const isEngagementAd = (criativo: any) => {
    const objetivo = criativo.campanha?.objetivo;
    const engagementObjectives = [
      'POST_ENGAGEMENT', 'VIDEO_VIEWS', 'BRAND_AWARENESS', 
      'REACH', 'PAGE_LIKES', 'EVENT_RESPONSES'
    ];
    return objetivo && engagementObjectives.includes(objetivo);
  };

  // Comparar URL esperada vs URL real e detectar discrepâncias
  const detectarDiscrepancias = (): Discrepancia[] => {
    if (!criativos) return [];
    
    const discrepancias: Discrepancia[] = [];
    
    for (const criativo of criativos) {
      // URL esperada: primeiro do criativo (override), senão da campanha
      const urlEsperada = criativo.url_esperada || criativo.campanha?.url_esperada;
      
      // Só valida se tem URL esperada configurada
      if (!urlEsperada) continue;
      
      const urlReal = criativo.url_final;
      const utmEsperado = extrairUTMs(urlEsperada);
      const utmReal = extrairUTMs(urlReal);
      const dominioEsperado = extrairDominio(urlEsperada);
      const dominioReal = extrairDominio(urlReal);
      
      const problemas: string[] = [];
      
      // Verificar se tem URL real
      if (!urlReal) {
        problemas.push("URL de destino não capturada da plataforma");
      } else {
        // Verificar domínio/landing page
        if (dominioEsperado && dominioReal && dominioEsperado !== dominioReal) {
          problemas.push(`Landing page diferente: esperado "${dominioEsperado}", recebido "${dominioReal}"`);
        }
        
        // Verificar cada parâmetro UTM
        if (utmEsperado.utm_source && utmEsperado.utm_source !== utmReal.utm_source) {
          problemas.push(`utm_source divergente: esperado "${utmEsperado.utm_source}", recebido "${utmReal.utm_source || 'ausente'}"`);
        }
        if (utmEsperado.utm_medium && utmEsperado.utm_medium !== utmReal.utm_medium) {
          problemas.push(`utm_medium divergente: esperado "${utmEsperado.utm_medium}", recebido "${utmReal.utm_medium || 'ausente'}"`);
        }
        if (utmEsperado.utm_campaign && utmEsperado.utm_campaign !== utmReal.utm_campaign) {
          problemas.push(`utm_campaign divergente: esperado "${utmEsperado.utm_campaign}", recebido "${utmReal.utm_campaign || 'ausente'}"`);
        }
        // utm_content pode usar placeholder dinâmico, então só valida se não tiver placeholder
        if (utmEsperado.utm_content && !utmEsperado.utm_content.includes('{{') && utmEsperado.utm_content !== utmReal.utm_content) {
          problemas.push(`utm_content divergente: esperado "${utmEsperado.utm_content}", recebido "${utmReal.utm_content || 'ausente'}"`);
        }
        
        // Verificar placeholders não resolvidos na URL real
        if (temPlaceholdersNaoResolvidos(urlReal)) {
          problemas.push("URL real contém placeholders não resolvidos (ex: {{ad.id}})");
        }
      }
      
      if (problemas.length > 0) {
        discrepancias.push({
          criativo,
          urlEsperada,
          urlReal,
          problemas,
          utmEsperado,
          utmReal,
        });
      }
    }
    
    return discrepancias;
  };

  // Criativos com URL esperada configurada (campanha ou criativo)
  const criativosComURLEsperada = criativos?.filter(c => c.url_esperada || c.campanha?.url_esperada) || [];
  const criativosSemURLEsperada = criativos?.filter(c => !c.url_esperada && !c.campanha?.url_esperada) || [];

  // Criativos com URL e UTM configurada
  const criativosComUTMnaURL = criativos?.filter(c => verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos sem URL capturada
  const criativosSemURL = criativos?.filter(c => !c.url_final) || [];
  
  // Criativos sem URL que são de engajamento (OK não ter URL)
  const criativosSemURLEngajamento = criativosSemURL.filter(c => isEngagementAd(c));
  
  // Criativos sem URL que deveriam ter (problema real)
  const criativosSemURLProblema = criativosSemURL.filter(c => !isEngagementAd(c));
  
  // Criativos com URL mas sem UTM
  const criativosComURLSemUTM = criativos?.filter(c => c.url_final && !verificarUTMnaURL(c.url_final)) || [];
  
  // Criativos com URL externa (Google Drive, etc)
  const criativosURLExterna = criativos?.filter(c => isURLExterna(c.url_final)) || [];
  
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
  
  // Discrepâncias detectadas
  const discrepancias = detectarDiscrepancias();
  const criativosValidados = criativosComURLEsperada.length - discrepancias.length;
  
  // Calcular percentuais
  const totalCriativos = criativos?.length || 0;
  const criativosComURLValida = totalCriativos - criativosSemURLEngajamento.length;
  
  const porcentagemComUTMnaURL = criativosComURLValida > 0
    ? (criativosComUTMnaURL.length / criativosComURLValida) * 100
    : 0;
    
  const porcentagemMatchLeads = leadsComUtm && leadsComUtm.length > 0
    ? (leadsComMatch.length / leadsComUtm.length) * 100
    : 0;
    
  const porcentagemValidacao = criativosComURLEsperada.length > 0
    ? (criativosValidados / criativosComURLEsperada.length) * 100
    : 100;

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
              Comparação entre URL esperada (cadastro) e URL real (plataformas)
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
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
            {criativosComURLEsperada.length > 0 && (
              <Badge 
                variant={porcentagemValidacao >= 80 ? "default" : porcentagemValidacao >= 50 ? "secondary" : "destructive"}
              >
                <ShieldCheck className="h-3 w-3 mr-1" />
                {porcentagemValidacao.toFixed(0)}% validados
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="text-center p-2 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Criativos</p>
            <p className="text-xl font-bold">{criativos?.length || 0}</p>
          </div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Com UTM</p>
            <p className="text-xl font-bold text-blue-600">{criativosComUTMnaURL.length}</p>
          </div>
          <div className="text-center p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Com URL Esperada</p>
            <p className="text-xl font-bold text-purple-600">{criativosComURLEsperada.length}</p>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Validados ✓</p>
            <p className="text-xl font-bold text-green-600">{criativosValidados}</p>
          </div>
          <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Discrepâncias</p>
            <p className="text-xl font-bold text-red-600">{discrepancias.length}</p>
          </div>
          <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Sem Cadastro</p>
            <p className="text-xl font-bold text-yellow-600">{criativosSemURLEsperada.length}</p>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Leads Match</p>
            <p className="text-xl font-bold text-green-600">{leadsComMatch.length}</p>
          </div>
          <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-xs text-muted-foreground">Sem Match</p>
            <p className="text-xl font-bold text-red-600">{leadsSemMatch.length}</p>
          </div>
        </div>

        {/* Alertas e detalhes */}
        <Accordion type="single" collapsible className="w-full">
          {/* NOVO: Discrepâncias detectadas */}
          {discrepancias.length > 0 && (
            <AccordionItem value="discrepancias">
              <AccordionTrigger className="text-destructive">
                <div className="flex items-center gap-2">
                  <ShieldX className="h-4 w-4" />
                  {discrepancias.length} discrepância{discrepancias.length !== 1 ? 's' : ''} detectada{discrepancias.length !== 1 ? 's' : ''} (URL esperada ≠ real)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  O sistema comparou a URL esperada cadastrada com a URL capturada das plataformas e encontrou divergências:
                </p>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {discrepancias.map((d, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg border border-destructive/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">{d.criativo.tipo}</Badge>
                        <span className="text-sm font-medium truncate flex-1">
                          {d.criativo.descricao || d.criativo.id_criativo_externo}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {d.criativo.campanha?.nome}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Esperada:</span>
                          <code className="block text-[10px] text-green-600 break-all mt-1 p-1 bg-green-50 dark:bg-green-950 rounded">
                            {d.urlEsperada}
                          </code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Real (Meta/Google):</span>
                          <code className="block text-[10px] text-orange-600 break-all mt-1 p-1 bg-orange-50 dark:bg-orange-950 rounded">
                            {d.urlReal || "Não capturada"}
                          </code>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground font-medium">Problemas:</span>
                          <ul className="mt-1 space-y-1">
                            {d.problemas.map((p, i) => (
                              <li key={i} className="flex items-start gap-1 text-destructive">
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate("/campanhas/cadastro")}>
                    Editar URLs Esperadas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/guia-utm")}>
                    Ver Guia UTM
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Criativos sem URL esperada cadastrada */}
          {criativosSemURLEsperada.length > 0 && (
            <AccordionItem value="sem-cadastro">
              <AccordionTrigger className="text-yellow-600">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {criativosSemURLEsperada.length} criativo{criativosSemURLEsperada.length !== 1 ? 's' : ''} sem URL esperada cadastrada
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Cadastre a URL esperada na campanha para validar automaticamente se os UTMs estão configurados corretamente nas plataformas.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosSemURLEsperada.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                      <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.campanha?.nome}</Badge>
                    </div>
                  ))}
                  {criativosSemURLEsperada.length > 10 && (
                    <p className="text-xs text-muted-foreground">... e mais {criativosSemURLEsperada.length - 10}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate("/campanhas/cadastro")}>
                    Cadastrar URL Esperada
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {criativosSemURLProblema.length > 0 && (
            <AccordionItem value="sem-url">
              <AccordionTrigger className="text-yellow-600">
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4" />
                  {criativosSemURLProblema.length} criativo{criativosSemURLProblema.length !== 1 ? 's' : ''} sem URL capturada
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Não foi possível capturar a URL de destino destes criativos nas plataformas.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosSemURLProblema.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                      <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      <code className="text-[10px] text-muted-foreground">Ad: {c.id_anuncio_externo || 'N/A'}</code>
                    </div>
                  ))}
                  {criativosSemURLProblema.length > 10 && (
                    <p className="text-xs text-muted-foreground">... e mais {criativosSemURLProblema.length - 10}</p>
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

          {criativosSemURLEngajamento.length > 0 && (
            <AccordionItem value="engajamento">
              <AccordionTrigger className="text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {criativosSemURLEngajamento.length} criativo{criativosSemURLEngajamento.length !== 1 ? 's' : ''} de engajamento (OK)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Anúncios de engajamento não têm URL de destino externa - isso é esperado.
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {criativosSemURLEngajamento.slice(0, 5).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary" className="text-[10px]">{c.tipo}</Badge>
                      <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      <Badge variant="outline" className="text-[10px]">{c.campanha?.objetivo || 'N/A'}</Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {criativosURLExterna.length > 0 && (
            <AccordionItem value="url-externa">
              <AccordionTrigger className="text-orange-600">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {criativosURLExterna.length} criativo{criativosURLExterna.length !== 1 ? 's' : ''} com URL externa
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Apontam para serviços externos (Google Drive, etc). UTM tracking não funciona.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosURLExterna.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                        <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      </div>
                      <code className="text-[10px] text-orange-600 break-all">{c.url_final}</code>
                    </div>
                  ))}
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
                  Configure os parâmetros UTM diretamente nos anúncios das plataformas.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {criativosComURLSemUTM.slice(0, 10).map((c: any) => (
                    <div key={c.id_criativo} className="text-xs p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                        <span className="truncate flex-1">{c.descricao || c.id_criativo_externo}</span>
                      </div>
                      <code className="text-[10px] text-muted-foreground break-all">{c.url_final?.substring(0, 100)}...</code>
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
                  {criativosComPlaceholders.length} URL{criativosComPlaceholders.length !== 1 ? 's' : ''} com placeholders
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Placeholders não resolvidos podem indicar problema na coleta ou campanha inativa.
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
                  {leadsSemMatch.length} lead{leadsSemMatch.length !== 1 ? 's' : ''} sem match
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Leads com UTM mas sem vínculo com criativo.
                </p>
                {topUtmContentsSemMatch.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-2">UTM Content mais comuns:</p>
                    <div className="space-y-1">
                      {topUtmContentsSemMatch.map(([utmContent, count]) => (
                        <div key={utmContent} className="text-xs flex items-center justify-between p-2 bg-muted rounded">
                          <code className="text-muted-foreground truncate max-w-[200px]">{utmContent}</code>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {status === "success" && porcentagemMatchLeads >= 80 && discrepancias.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Rastreamento Funcionando!</AlertTitle>
            <AlertDescription>
              UTMs configuradas corretamente e leads vinculados aos criativos.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 pt-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRecoletarCriativos}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Recoletar
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/guia-utm")}>
            Guia UTM
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/campanhas/cadastro")}>
            Cadastrar URLs
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
            Campanhas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
