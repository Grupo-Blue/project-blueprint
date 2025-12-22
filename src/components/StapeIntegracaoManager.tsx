import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Save, TestTube2, AlertCircle, ExternalLink, Copy, Check, Server } from "lucide-react";

interface StapeConfig {
  meta_pixel_id: string;
  meta_capi_token: string;
  stape_container_url: string;
  ativo: boolean;
}

export function StapeIntegracaoManager() {
  const [config, setConfig] = useState<StapeConfig>({
    meta_pixel_id: "",
    meta_capi_token: "",
    stape_container_url: "",
    ativo: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stape-webhook`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Buscar configuração existente do tipo STAPE (se existir no futuro)
      // Por agora, vamos usar localStorage para armazenar a configuração
      const savedConfig = localStorage.getItem("stape_config");
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error("Erro ao carregar configuração Stape:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.meta_pixel_id || !config.meta_capi_token) {
      toast.error("Preencha o Meta Pixel ID e o CAPI Token");
      return;
    }

    setSaving(true);
    try {
      // Salvar no localStorage (configuração local)
      localStorage.setItem("stape_config", JSON.stringify({ ...config, ativo: true }));
      
      // Nota: Os secrets META_PIXEL_ID e META_CAPI_TOKEN precisam ser configurados
      // diretamente no Supabase Secrets para que as edge functions funcionem
      
      setConfig(prev => ({ ...prev, ativo: true }));
      toast.success("Configuração salva localmente. Lembre-se de configurar os secrets no backend!");
    } catch (error: any) {
      toast.error("Erro ao salvar configuração: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Testar o webhook do Stape
      const { data, error } = await supabase.functions.invoke("stape-webhook", {
        body: {
          event_name: "test_event",
          event_time: Math.floor(Date.now() / 1000),
          test: true,
        },
      });

      if (error) throw error;

      if (data?.success || data?.message?.includes("evento de teste")) {
        toast.success("Webhook do Stape está funcionando!");
      } else {
        toast.warning("Webhook respondeu, mas verifique a configuração");
      }
    } catch (error: any) {
      console.error("Erro ao testar Stape:", error);
      toast.error("Erro ao testar: " + error.message);
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Visão Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Stape.io - Server-Side Tracking
          </CardTitle>
          <CardDescription>
            Configure o tracking server-side para melhorar a qualidade dos dados do Meta CAPI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">Como funciona</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
              <p>O Stape atua como intermediário entre seu site e o Meta, enviando eventos via server-side:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li><strong>GTM Server Container:</strong> Recebe eventos do GTM web</li>
                <li><strong>Stape Webhook:</strong> Recebe dados e envia para o Meta CAPI</li>
                <li><strong>Deduplicação:</strong> Eventos são comparados para evitar duplicatas</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Configuração Meta CAPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meta Conversions API (CAPI)</CardTitle>
          <CardDescription>
            Credenciais para enviar eventos server-side para o Meta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">Onde obter esses valores</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm space-y-2">
              <p><strong>META_PIXEL_ID:</strong></p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Acesse <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="underline">Meta Events Manager</a></li>
                <li>Selecione seu Pixel na lista</li>
                <li>O ID está no topo (ex: 123456789012345)</li>
              </ol>
              <p className="mt-3"><strong>META_CAPI_TOKEN:</strong></p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>No Events Manager, clique no Pixel</li>
                <li>Vá em Configurações → Conversions API</li>
                <li>Clique em "Gerar Token de Acesso"</li>
                <li>Copie o token (começa com EAA...)</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Meta Pixel ID *</Label>
              <Input
                value={config.meta_pixel_id}
                onChange={(e) => setConfig(prev => ({ ...prev, meta_pixel_id: e.target.value }))}
                placeholder="123456789012345"
              />
            </div>
            <div className="space-y-2">
              <Label>Meta CAPI Token *</Label>
              <Input
                type="password"
                value={config.meta_capi_token}
                onChange={(e) => setConfig(prev => ({ ...prev, meta_capi_token: e.target.value }))}
                placeholder="EAAxxxxxxxxxx..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stape Container URL (opcional)</Label>
            <Input
              value={config.stape_container_url}
              onChange={(e) => setConfig(prev => ({ ...prev, stape_container_url: e.target.value }))}
              placeholder="https://gtm.seusite.com.br"
            />
            <p className="text-xs text-muted-foreground">
              URL do seu container GTM server-side no Stape
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook do Stape</CardTitle>
          <CardDescription>
            Configure este webhook no GTM Server Container ou Stape
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook (para receber eventos)</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "webhook")}
              >
                {copied === "webhook" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use esta URL no seu GTM Server Container como destino dos eventos
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuração no GTM Server Container</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>No seu container GTM Server-Side:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Crie uma Tag do tipo "HTTP Request"</li>
                <li>Configure a URL acima como destino</li>
                <li>Método: POST</li>
                <li>Content-Type: application/json</li>
                <li>Corpo: envie os dados do evento em JSON</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              <TestTube2 className="w-4 h-4 mr-2" />
              {testing ? "Testando..." : "Testar Webhook"}
            </Button>
            <Button 
              variant="outline" 
              asChild
            >
              <a href="https://stape.io" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Acessar Stape.io
              </a>
            </Button>
          </div>

          {config.ativo && (
            <Alert className="mt-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 dark:text-green-100">Configuração Ativa</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
                <p><strong>Importante:</strong> Para que o CAPI funcione, você precisa configurar os secrets:</p>
                <ul className="list-disc ml-4 mt-2">
                  <li><code>META_PIXEL_ID</code> = {config.meta_pixel_id || "(não definido)"}</li>
                  <li><code>META_CAPI_TOKEN</code> = (token seguro)</li>
                </ul>
                <p className="mt-2">Esses valores devem ser adicionados como Secrets no backend do projeto.</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instruções de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximos Passos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">1</div>
              <div>
                <p className="font-medium">Configurar Secrets no Backend</p>
                <p className="text-sm text-muted-foreground">
                  Adicione META_PIXEL_ID e META_CAPI_TOKEN como secrets do projeto
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">2</div>
              <div>
                <p className="font-medium">Configurar GTM Server Container</p>
                <p className="text-sm text-muted-foreground">
                  Configure o webhook no seu container Stape/GTM para enviar eventos
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">3</div>
              <div>
                <p className="font-medium">Testar Integração</p>
                <p className="text-sm text-muted-foreground">
                  Use o botão "Testar Webhook" para verificar se está funcionando
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">4</div>
              <div>
                <p className="font-medium">Monitorar no Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  Acompanhe os widgets Stape Health e Server-Side Comparison no Dashboard
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
