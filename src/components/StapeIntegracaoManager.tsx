import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, TestTube2, AlertCircle, ExternalLink, Copy, Check, Server, Wifi, WifiOff, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StapeConfig {
  meta_pixel_id: string;
  meta_capi_token: string;
  stape_container_url: string;
  stape_container_id: string;
  stape_region: "global" | "eu";
  ativo: boolean;
}

interface StapeStats {
  total_requests?: number;
  successful_requests?: number;
  failed_requests?: number;
  last_request_at?: string;
}

export function StapeIntegracaoManager() {
  const [config, setConfig] = useState<StapeConfig>({
    meta_pixel_id: "",
    meta_capi_token: "",
    stape_container_url: "",
    stape_container_id: "",
    stape_region: "global",
    ativo: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [stapeStats, setStapeStats] = useState<StapeStats | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stape-webhook`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = localStorage.getItem("stape_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig({
          meta_pixel_id: parsed.meta_pixel_id || "",
          meta_capi_token: parsed.meta_capi_token || "",
          stape_container_url: parsed.stape_container_url || "",
          stape_container_id: parsed.stape_container_id || "",
          stape_region: parsed.stape_region || "global",
          ativo: parsed.ativo || false,
        });

        // Se tem container_id configurado, tentar buscar estatísticas
        if (parsed.stape_container_id) {
          fetchStapeStats(parsed.stape_container_id, parsed.stape_region || "global");
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configuração Stape:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStapeStats = async (containerId: string, region: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "statistics",
          container_id: containerId,
          region,
        },
      });

      if (!error && data?.success) {
        setStapeStats(data.data);
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas Stape:", error);
      setApiConnected(false);
    }
  };

  const handleSave = async () => {
    if (!config.meta_pixel_id || !config.meta_capi_token) {
      toast.error("Preencha o Meta Pixel ID e o CAPI Token");
      return;
    }

    setSaving(true);
    try {
      localStorage.setItem("stape_config", JSON.stringify({ ...config, ativo: true }));
      setConfig(prev => ({ ...prev, ativo: true }));
      toast.success("Configuração salva! Lembre-se de configurar os secrets no backend.");

      // Se tem container_id, buscar estatísticas
      if (config.stape_container_id) {
        fetchStapeStats(config.stape_container_id, config.stape_region);
      }
    } catch (error: any) {
      toast.error("Erro ao salvar configuração: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
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
      setTestingWebhook(false);
    }
  };

  const handleTestApiConnection = async () => {
    if (!config.stape_container_id) {
      toast.error("Preencha o Container ID para testar a conexão");
      return;
    }

    setTestingApi(true);
    try {
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "test-connection",
          container_id: config.stape_container_id,
          region: config.stape_region,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setApiConnected(true);
        setStapeStats(data.data);
        toast.success("Conexão com API Stape estabelecida!");
      } else {
        setApiConnected(false);
        toast.error("Falha na conexão: " + (data?.error || "Erro desconhecido"));
      }
    } catch (error: any) {
      console.error("Erro ao testar API Stape:", error);
      setApiConnected(false);
      toast.error("Erro ao testar API: " + error.message);
    } finally {
      setTestingApi(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Stape.io - Server-Side Tracking
              </CardTitle>
              <CardDescription>
                Configure o tracking server-side para melhorar a qualidade dos dados do Meta CAPI
              </CardDescription>
            </div>
            {apiConnected !== null && (
              <Badge variant={apiConnected ? "default" : "secondary"} className="flex items-center gap-1">
                {apiConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    API Conectada
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    API Desconectada
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">Como funciona</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
              <p>O sistema usa <strong>dois modos complementares</strong>:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li><strong>Webhook (tempo real):</strong> Recebe eventos do GTM Server e processa</li>
                <li><strong>API Stape (monitoramento):</strong> Busca estatísticas, logs e analytics</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Estatísticas da API se conectado */}
          {apiConnected && stapeStats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-lg font-bold">{stapeStats.total_requests || 0}</div>
                <div className="text-xs text-muted-foreground">Requests Total</div>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                <Check className="h-4 w-4 mx-auto mb-1 text-green-600" />
                <div className="text-lg font-bold text-green-700 dark:text-green-400">
                  {stapeStats.successful_requests || 0}
                </div>
                <div className="text-xs text-muted-foreground">Sucesso</div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
                <AlertCircle className="h-4 w-4 mx-auto mb-1 text-red-600" />
                <div className="text-lg font-bold text-red-700 dark:text-red-400">
                  {stapeStats.failed_requests || 0}
                </div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração API Stape */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API do Stape (Monitoramento)</CardTitle>
          <CardDescription>
            Configure para acessar estatísticas, logs e analytics do container
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
            <AlertCircle className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-900 dark:text-purple-100">Onde obter esses valores</AlertTitle>
            <AlertDescription className="text-purple-800 dark:text-purple-200 text-sm space-y-2">
              <p><strong>Container ID:</strong></p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Acesse <a href="https://stape.io/containers" target="_blank" rel="noopener noreferrer" className="underline">Stape Containers</a></li>
                <li>Clique no seu container</li>
                <li>O ID está na URL (ex: containers/<strong>abc123</strong>)</li>
              </ol>
              <p className="mt-3"><strong>API Key:</strong> Deve ser configurada como secret STAPE_API_KEY no backend</p>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Container ID *</Label>
              <Input
                value={config.stape_container_id}
                onChange={(e) => setConfig(prev => ({ ...prev, stape_container_id: e.target.value }))}
                placeholder="abc123xyz"
              />
            </div>
            <div className="space-y-2">
              <Label>Região do Container</Label>
              <Select
                value={config.stape_region}
                onValueChange={(value: "global" | "eu") => setConfig(prev => ({ ...prev, stape_region: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (stape.io)</SelectItem>
                  <SelectItem value="eu">Europa (eu.stape.io)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={handleTestApiConnection} 
            disabled={testingApi || !config.stape_container_id}
          >
            <Wifi className="w-4 h-4 mr-2" />
            {testingApi ? "Testando..." : "Testar Conexão API"}
          </Button>
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
          </div>
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
            <Button variant="outline" onClick={handleTestWebhook} disabled={testingWebhook}>
              <TestTube2 className="w-4 h-4 mr-2" />
              {testingWebhook ? "Testando..." : "Testar Webhook"}
            </Button>
            <Button variant="outline" asChild>
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
                <p><strong>Secrets necessários no backend:</strong></p>
                <ul className="list-disc ml-4 mt-2">
                  <li><code>META_PIXEL_ID</code> - ID do Pixel Meta</li>
                  <li><code>META_CAPI_TOKEN</code> - Token de acesso CAPI</li>
                  <li><code>STAPE_API_KEY</code> - Chave da API Stape (para monitoramento)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
