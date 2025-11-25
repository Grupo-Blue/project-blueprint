import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, AlertTriangle, CheckCircle2, Copy, ExternalLink, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const GuiaUTM = () => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">📚 Guia de Configuração de UTMs</h1>
        <p className="text-muted-foreground">
          Aprenda a configurar parâmetros UTM para rastrear criativos e leads
        </p>
      </div>

      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertTitle>Por que usar UTMs?</AlertTitle>
        <AlertDescription>
          UTMs permitem rastrear exatamente de qual anúncio/criativo cada lead veio, possibilitando análise de ROI por criativo.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="pipedrive">Pipedrive</TabsTrigger>
          <TabsTrigger value="validation">Validação</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que são UTM Parameters?</CardTitle>
              <CardDescription>Parâmetros que você adiciona nas URLs para rastrear origem do tráfego</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline">utm_source</Badge>
                  <span className="text-sm">Origem do tráfego (ex: facebook, google)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline">utm_medium</Badge>
                  <span className="text-sm">Meio/tipo de marketing (ex: cpc, email, social)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline">utm_campaign</Badge>
                  <span className="text-sm">Nome da campanha (ex: black_friday_2025)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">utm_content</Badge>
                  <span className="text-sm font-semibold">ID do criativo (OBRIGATÓRIO para rastreamento)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline">utm_term</Badge>
                  <span className="text-sm">Palavras-chave pagas (opcional)</span>
                </div>
              </div>

              <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">CRÍTICO</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  O parâmetro <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">utm_content</code> DEVE conter o ID do criativo.
                  Copie o ID exato da página de Criativos (botão de copiar ao lado do ID).
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold mb-2">Exemplo de URL completa:</p>
                <code className="text-xs break-all">
                  https://seusite.com.br/landing?utm_source=facebook&utm_medium=cpc&utm_campaign=black_friday&utm_content=120212345678901_120212345678902&utm_term=contabilidade
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta Ads */}
        <TabsContent value="meta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração no Meta Ads (Facebook/Instagram)</CardTitle>
              <CardDescription>Passo a passo para adicionar UTMs nos anúncios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Acesse o Gerenciador de Anúncios</p>
                    <p className="text-sm text-muted-foreground">business.facebook.com/adsmanager</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Selecione a campanha e o anúncio</p>
                    <p className="text-sm text-muted-foreground">Navegue até o nível de Anúncio (Ad)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Vá em "Copiar ID do Criativo"</p>
                    <p className="text-sm text-muted-foreground">Na página de Criativos do SGT, copie o ID do criativo</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium">Edite o anúncio e vá até "Parâmetros de URL"</p>
                    <p className="text-sm text-muted-foreground">Seção "Rastreamento" ou "Configurações avançadas"</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">5</div>
                  <div className="space-y-2">
                    <p className="font-medium">Cole os parâmetros UTM</p>
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <code className="text-xs">utm_source=facebook&utm_medium=cpc&utm_campaign=nome_campanha&utm_content=ID_CRIATIVO</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content=ID_CRIATIVO")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Substitua ID_CRIATIVO pelo ID copiado na etapa 3</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Dica: Use variáveis do Meta</AlertTitle>
                <AlertDescription>
                  Você pode usar <code>{'{{campaign.name}}'}</code> para nome da campanha e <code>{'{{adset.name}}'}</code> para conjunto de anúncios.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Ads */}
        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração no Google Ads</CardTitle>
              <CardDescription>Adicione UTMs nos anúncios do Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Acesse o Google Ads</p>
                    <p className="text-sm text-muted-foreground">ads.google.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Vá em "Anúncios e extensões"</p>
                    <p className="text-sm text-muted-foreground">No menu lateral esquerdo</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Copie o ID do criativo</p>
                    <p className="text-sm text-muted-foreground">Na página de Criativos do SGT</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium">Edite o anúncio</p>
                    <p className="text-sm text-muted-foreground">Clique no anúncio para editar</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">5</div>
                  <div className="space-y-2">
                    <p className="font-medium">Adicione parâmetros de rastreamento</p>
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <p className="text-xs text-muted-foreground">Opção 1: URL Final completa</p>
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-xs">https://seusite.com?utm_source=google&utm_medium=cpc&utm_campaign=nome&utm_content=ID_CRIATIVO</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content=ID_CRIATIVO")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Opção 2: Sufixo de URL de rastreamento</p>
                      <div className="flex items-center justify-between">
                        <code className="text-xs">utm_source=google&utm_medium=cpc&utm_campaign={'{{campaignid}}'}&utm_content=ID_CRIATIVO</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content=ID_CRIATIVO")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Dica: Use ValueTrack</AlertTitle>
                <AlertDescription>
                  Google permite variáveis como <code>{'{{campaignid}}'}</code> e <code>{'{{adgroupid}}'}</code>.
                  <Button variant="link" className="h-auto p-0 ml-1" asChild>
                    <a href="https://support.google.com/google-ads/answer/6305348" target="_blank" rel="noopener noreferrer">
                      Ver documentação <ExternalLink className="h-3 w-3 ml-1 inline" />
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipedrive */}
        <TabsContent value="pipedrive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração no Pipedrive</CardTitle>
              <CardDescription>Configure campos customizados para receber UTMs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800 dark:text-red-200">OBRIGATÓRIO</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  Sem estes campos customizados, o sistema NÃO conseguirá rastrear os criativos.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Acesse Configurações do Pipedrive</p>
                    <p className="text-sm text-muted-foreground">Settings → Data fields → Deal fields</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                  <div className="space-y-2">
                    <p className="font-medium">Crie 5 campos customizados do tipo "Text"</p>
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <p className="text-sm"><code className="bg-background px-1 rounded">utm_source</code></p>
                      <p className="text-sm"><code className="bg-background px-1 rounded">utm_medium</code></p>
                      <p className="text-sm"><code className="bg-background px-1 rounded">utm_campaign</code></p>
                      <p className="text-sm font-semibold text-yellow-600"><code className="bg-background px-1 rounded">utm_content</code> (OBRIGATÓRIO)</p>
                      <p className="text-sm"><code className="bg-background px-1 rounded">utm_term</code></p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Configure seu formulário/landing page</p>
                    <p className="text-sm text-muted-foreground">
                      Certifique-se que quando criar um deal, estes campos sejam preenchidos com os valores dos UTMs da URL
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
                  <div className="space-y-2">
                    <p className="font-medium">Atualize o código do webhook</p>
                    <p className="text-sm text-muted-foreground">
                      No arquivo <code className="bg-muted px-1 rounded">pipedrive-webhook/index.ts</code>, mapeie os IDs dos campos:
                    </p>
                    <div className="p-3 bg-muted rounded-lg">
                      <pre className="text-xs overflow-x-auto">
{`const PIPEDRIVE_FIELD_IDS = {
  utm_source: "abc123...",    // Cole o ID do campo
  utm_medium: "def456...",    // Cole o ID do campo
  utm_campaign: "ghi789...",  // Cole o ID do campo
  utm_content: "jkl012...",   // Cole o ID do campo
  utm_term: "mno345...",      // Cole o ID do campo
};`}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Para encontrar o ID: Settings → Data fields → Deal fields → Clique no campo → O ID aparece na URL
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation */}
        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Como Validar se está Funcionando</CardTitle>
              <CardDescription>Checklist de validação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">1. Teste a URL completa</p>
                    <p className="text-sm text-muted-foreground">
                      Cole a URL com UTMs no navegador e verifique se os parâmetros aparecem
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">2. Crie um lead de teste</p>
                    <p className="text-sm text-muted-foreground">
                      Use a URL com UTMs, crie um deal no Pipedrive e verifique se os campos customizados foram preenchidos
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">3. Verifique o SGT</p>
                    <p className="text-sm text-muted-foreground">
                      Vá na aba Leads e veja se o lead aparece vinculado ao criativo correto
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">4. Verifique os logs</p>
                    <p className="text-sm text-muted-foreground">
                      No Lovable Cloud → Edge Functions → pipedrive-webhook → Logs, deve aparecer "UTM Parameters capturados" com valores
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <Code className="h-4 w-4" />
                <AlertTitle>Ferramenta de Teste</AlertTitle>
                <AlertDescription>
                  Use o Google Campaign URL Builder para gerar URLs de teste:
                  <Button variant="link" className="h-auto p-0 ml-1" asChild>
                    <a href="https://ga-dev-tools.google/campaign-url-builder/" target="_blank" rel="noopener noreferrer">
                      Acessar ferramenta <ExternalLink className="h-3 w-3 ml-1 inline" />
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuiaUTM;