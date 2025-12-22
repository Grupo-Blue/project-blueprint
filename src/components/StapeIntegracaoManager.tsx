import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
  id?: string;
  id_empresa: string;
  meta_pixel_id: string;
  meta_capi_token: string;
  stape_container_url: string;
  stape_container_id: string;
  stape_region: "global" | "eu";
  stape_api_key: string;
  ativo: boolean;
}

interface StapeStats {
  total_requests?: number;
  successful_requests?: number;
  failed_requests?: number;
  last_request_at?: string;
}

export function StapeIntegracaoManager() {
  const { empresasPermitidas, empresaSelecionada: empresaContexto } = useEmpresa();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");
  const [config, setConfig] = useState<StapeConfig>({
    id_empresa: "",
    meta_pixel_id: "",
    meta_capi_token: "",
    stape_container_url: "",
    stape_container_id: "",
    stape_region: "global",
    stape_api_key: "",
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

  // Inicializar empresa selecionada
  useEffect(() => {
    if (empresasPermitidas.length > 0 && !empresaSelecionada) {
      const inicial = empresaContexto && empresaContexto !== "todas" 
        ? empresaContexto 
        : empresasPermitidas[0]?.id_empresa;
      if (inicial) setEmpresaSelecionada(inicial);
    }
  }, [empresasPermitidas, empresaContexto, empresaSelecionada]);

  // Carregar config quando empresa muda
  useEffect(() => {
    if (empresaSelecionada) {
      loadConfig();
    }
  }, [empresaSelecionada]);

  const loadConfig = async () => {
    if (!empresaSelecionada) return;
    setLoading(true);
    setApiConnected(null);
    setStapeStats(null);

    try {
      const { data, error } = await supabase
        .from("empresa_stape_config")
        .select("*")
        .eq("id_empresa", empresaSelecionada)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          id_empresa: data.id_empresa,
          meta_pixel_id: data.meta_pixel_id || "",
          meta_capi_token: data.meta_capi_token || "",
          stape_container_url: data.stape_container_url || "",
          stape_container_id: data.stape_container_id || "",
          stape_region: (data.stape_region as "global" | "eu") || "global",
          stape_api_key: data.stape_api_key || "",
          ativo: data.ativo ?? false,
        });

        // Se tem container_id e api_key, tentar buscar estatísticas
        if (data.stape_container_id && data.stape_api_key) {
          fetchStapeStats(data.stape_container_id, data.stape_region || "global", data.stape_api_key);
        }
      } else {
        // Reset para nova empresa
        setConfig({
          id_empresa: empresaSelecionada,
          meta_pixel_id: "",
          meta_capi_token: "",
          stape_container_url: "",
          stape_container_id: "",
          stape_region: "global",
          stape_api_key: "",
          ativo: false,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configuração Stape:", error);
      toast.error("Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  };

  const fetchStapeStats = async (containerId: string, region: string, apiKey: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "statistics",
          container_id: containerId,
          region,
          api_key: apiKey, // Passar a API key específica da empresa
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
    if (!empresaSelecionada) {
      toast.error("Selecione uma empresa");
      return;
    }

    if (!config.meta_pixel_id || !config.meta_capi_token) {
      toast.error("Preencha o Meta Pixel ID e o CAPI Token");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id_empresa: empresaSelecionada,
        meta_pixel_id: config.meta_pixel_id,
        meta_capi_token: config.meta_capi_token,
        stape_container_url: config.stape_container_url || null,
        stape_container_id: config.stape_container_id || null,
        stape_region: config.stape_region,
        stape_api_key: config.stape_api_key || null,
        ativo: true,
      };

      if (config.id) {
        // Update
        const { error } = await supabase
          .from("empresa_stape_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await supabase
          .from("empresa_stape_config")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setConfig(prev => ({ ...prev, id: data.id }));
      }

      setConfig(prev => ({ ...prev, ativo: true }));
      toast.success("Configuração salva com sucesso!");

      // Se tem container_id e api_key, buscar estatísticas
      if (config.stape_container_id && config.stape_api_key) {
        fetchStapeStats(config.stape_container_id, config.stape_region, config.stape_api_key);
      }
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
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

    if (!config.stape_api_key) {
      toast.error("Preencha a API Key do Stape para testar a conexão");
      return;
    }

    setTestingApi(true);
    try {
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "test-connection",
          container_id: config.stape_container_id,
          region: config.stape_region,
          api_key: config.stape_api_key,
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

  if (loading && empresaSelecionada) {
    return <div className="p-4">Carregando...</div>;
  }

  const nomeEmpresa = empresasPermitidas.find(e => e.id_empresa === empresaSelecionada)?.nome;

  return (
    <div className="space-y-6">
      {/* Seletor de Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Stape.io - Server-Side Tracking
          </CardTitle>
          <CardDescription>
            Configure o tracking server-side por empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresasPermitidas.map((emp) => (
                  <SelectItem key={emp.id_empresa} value={emp.id_empresa}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {empresaSelecionada && (
            <div className="flex items-center gap-2">
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
              {config.ativo && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Configuração ativa
                </Badge>
              )}
            </div>
          )}

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

      {empresaSelecionada && (
        <>
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
                  <p><strong>Container ID:</strong> Acesse <a href="https://stape.io/containers" target="_blank" rel="noopener noreferrer" className="underline">Stape Containers</a> → Clique no container → ID na URL</p>
                  <p><strong>API Key:</strong> Acesse <a href="https://stape.io/account/api" target="_blank" rel="noopener noreferrer" className="underline">Stape API Settings</a> → Crie/copie sua API Key</p>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Container ID</Label>
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

              <div className="space-y-2">
                <Label>Stape API Key *</Label>
                <Input
                  type="password"
                  value={config.stape_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, stape_api_key: e.target.value }))}
                  placeholder="sua-api-key-do-stape"
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha em <a href="https://stape.io/account/api" target="_blank" rel="noopener noreferrer" className="underline">stape.io/account/api</a>
                </p>
              </div>

              <Button 
                variant="outline" 
                onClick={handleTestApiConnection} 
                disabled={testingApi || !config.stape_container_id || !config.stape_api_key}
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
                  <p><strong>META_PIXEL_ID:</strong> Events Manager → Selecione seu Pixel → ID no topo</p>
                  <p><strong>META_CAPI_TOKEN:</strong> Pixel → Configurações → Conversions API → "Gerar Token de Acesso"</p>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
