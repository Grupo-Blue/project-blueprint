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
import { Save, TestTube2, AlertCircle, ExternalLink, Copy, Check, Server, Wifi, WifiOff, BarChart3, Key, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StapeConfig {
  id?: string;
  id_empresa: string;
  meta_pixel_id: string;
  meta_capi_token: string;
  stape_container_url: string;
  stape_container_id: string;
  stape_region: "global" | "eu";
  stape_account_api_key: string;
  stape_container_api_key: string;
  ativo: boolean;
}

interface StapeStats {
  total_requests?: number;
  successful_requests?: number;
  failed_requests?: number;
  last_request_at?: string;
}

interface ApiTestResult {
  success: boolean;
  apiKeyValid: boolean;
  containerFound: boolean;
  containers?: Array<{ identifier: string; name?: string }>;
  error?: string;
  hint?: string;
  detail?: string;
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
    stape_account_api_key: "",
    stape_container_api_key: "",
    ativo: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [testingMetaCapi, setTestingMetaCapi] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [stapeStats, setStapeStats] = useState<StapeStats | null>(null);
  const [apiTestResult, setApiTestResult] = useState<ApiTestResult | null>(null);
  const [metaCapiResult, setMetaCapiResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

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
          stape_account_api_key: data.stape_account_api_key || "",
          stape_container_api_key: data.stape_container_api_key || "",
          ativo: data.ativo ?? false,
        });

        // Se tem container_id e account_api_key, tentar buscar estatísticas
        if (data.stape_container_id && data.stape_account_api_key) {
          fetchStapeStats(data.stape_container_id, data.stape_region || "global", data.stape_account_api_key);
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
          stape_account_api_key: "",
          stape_container_api_key: "",
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
          api_key: apiKey,
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
        stape_account_api_key: config.stape_account_api_key || null,
        stape_container_api_key: config.stape_container_api_key || null,
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

      // Se tem container_id e account_api_key, buscar estatísticas
      if (config.stape_container_id && config.stape_account_api_key) {
        fetchStapeStats(config.stape_container_id, config.stape_region, config.stape_account_api_key);
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

  // Teste Meta CAPI
  const handleTestMetaCapi = async () => {
    if (!config.meta_pixel_id || !config.meta_capi_token) {
      toast.error("Preencha o Pixel ID e o Token da Meta CAPI");
      return;
    }

    setTestingMetaCapi(true);
    setMetaCapiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stape-meta-capi", {
        body: {
          event_name: "PageView",
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: window.location.href,
          action_source: "website",
          id_empresa: empresaSelecionada,
          // Dados de teste
          email: "test@lovable.dev",
          client_user_agent: navigator.userAgent,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setMetaCapiResult({
          success: true,
          message: `Evento enviado com sucesso! events_received: ${data.events_received}`,
          details: data,
        });
        toast.success("Meta CAPI funcionando! Evento de teste enviado.");
      } else {
        setMetaCapiResult({
          success: false,
          message: data?.error || "Erro desconhecido",
          details: data?.details,
        });
        toast.error("Erro ao enviar para Meta: " + (data?.error || "Verifique as credenciais"));
      }
    } catch (error: any) {
      console.error("Erro ao testar Meta CAPI:", error);
      setMetaCapiResult({
        success: false,
        message: error.message,
      });
      toast.error("Erro ao testar: " + error.message);
    } finally {
      setTestingMetaCapi(false);
    }
  };

  // Teste 1: Testar apenas a API Key (listar containers)
  const handleTestApiKey = async () => {
    if (!config.stape_account_api_key) {
      toast.error("Preencha a Account API Key do Stape");
      return;
    }

    setTestingApiKey(true);
    setApiTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "list-containers",
          region: config.stape_region,
          api_key: config.stape_account_api_key,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const containers = data.data?.containers || [];
        const containerIds = data.data?.container_ids || [];
        
        setApiTestResult({
          success: true,
          apiKeyValid: true,
          containerFound: config.stape_container_id ? containerIds.includes(config.stape_container_id) : false,
          containers: containers.map((c: any) => ({ identifier: c.identifier, name: c.name })),
        });
        
        toast.success(`API Key válida! ${containers.length} container(s) encontrado(s).`);
        
        // Verificar se o container configurado está na lista
        if (config.stape_container_id && !containerIds.includes(config.stape_container_id)) {
          toast.warning(`Container "${config.stape_container_id}" não encontrado. Containers disponíveis: ${containerIds.join(", ")}`);
        }
      } else {
        setApiTestResult({
          success: false,
          apiKeyValid: false,
          containerFound: false,
          error: data?.error,
          hint: data?.hint,
          detail: data?.detail,
        });
        toast.error(data?.hint || "API Key inválida");
      }
    } catch (error: any) {
      console.error("Erro ao testar API Key:", error);
      setApiTestResult({
        success: false,
        apiKeyValid: false,
        containerFound: false,
        error: error.message,
      });
      toast.error("Erro ao testar: " + error.message);
    } finally {
      setTestingApiKey(false);
    }
  };

  // Teste 2: Testar conexão completa (API Key + Container)
  const handleTestApiConnection = async () => {
    if (!config.stape_container_id) {
      toast.error("Preencha o Container ID para testar a conexão");
      return;
    }

    if (!config.stape_account_api_key) {
      toast.error("Preencha a Account API Key do Stape para testar a conexão");
      return;
    }

    setTestingApi(true);
    try {
      // Primeiro testar se a API Key é válida
      const { data: listData } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "list-containers",
          region: config.stape_region,
          api_key: config.stape_account_api_key,
        },
      });

      if (!listData?.success) {
        setApiConnected(false);
        setApiTestResult({
          success: false,
          apiKeyValid: false,
          containerFound: false,
          error: listData?.error,
          hint: listData?.hint,
          detail: listData?.detail,
        });
        toast.error(listData?.hint || "API Key inválida");
        return;
      }

      // API Key válida, verificar se container existe
      const containerIds = listData.data?.container_ids || [];
      const containerFound = containerIds.includes(config.stape_container_id);

      if (!containerFound) {
        setApiConnected(false);
        setApiTestResult({
          success: false,
          apiKeyValid: true,
          containerFound: false,
          containers: listData.data?.containers || [],
          error: `Container "${config.stape_container_id}" não encontrado`,
          hint: `Containers disponíveis: ${containerIds.join(", ")}`,
        });
        toast.error(`Container "${config.stape_container_id}" não encontrado na sua conta Stape`);
        return;
      }

      // Agora testar estatísticas do container
      const { data, error } = await supabase.functions.invoke("stape-api", {
        body: {
          action: "statistics",
          container_id: config.stape_container_id,
          region: config.stape_region,
          api_key: config.stape_account_api_key,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setApiConnected(true);
        setStapeStats(data.data);
        setApiTestResult({
          success: true,
          apiKeyValid: true,
          containerFound: true,
        });
        toast.success("Conexão com API Stape estabelecida!");
      } else {
        setApiConnected(false);
        setApiTestResult({
          success: false,
          apiKeyValid: true,
          containerFound: true,
          error: data?.error,
          hint: data?.hint,
        });
        toast.error("Falha ao obter estatísticas: " + (data?.hint || data?.error));
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-5 h-5" />
                API do Stape (Monitoramento)
              </CardTitle>
              <CardDescription>
                Configure para acessar estatísticas, logs e analytics do container
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">⚠️ Importante: Dois tipos de API Key</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm space-y-2">
                  <p>O Stape usa <strong>dois tipos diferentes</strong> de API Key:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><strong>Account API Key:</strong> Para monitoramento e estatísticas (formato: hash simples)</li>
                    <li><strong>Container API Key:</strong> Para enviar eventos (formato: <code>sar:container_id:hash</code>)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Container ID (Identifier)</Label>
                  <Input
                    value={config.stape_container_id}
                    onChange={(e) => setConfig(prev => ({ ...prev, stape_container_id: e.target.value }))}
                    placeholder="uizvxhep"
                  />
                  <p className="text-xs text-muted-foreground">
                    Em <a href="https://stape.io/containers" target="_blank" rel="noopener noreferrer" className="underline">Stape Containers</a> → "Container identifier"
                  </p>
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
                      <SelectItem value="global">Global (US, SA East/Brazil, etc.)</SelectItem>
                      <SelectItem value="eu">Europa (EU)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    SA East (Brazil), US, Asia = Global | Europa = EU
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Account API Key (para monitoramento)
                </Label>
                <Input
                  type="password"
                  value={config.stape_account_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, stape_account_api_key: e.target.value }))}
                  placeholder="5f7ba5b1ae2ddd6a621aaba5370279d02beb60ae"
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha em <a href="https://stape.io/account/api" target="_blank" rel="noopener noreferrer" className="underline">stape.io/account/api</a> → "Account API Key"
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestApiKey} 
                  disabled={testingApiKey || !config.stape_account_api_key}
                >
                  <Key className="w-4 h-4 mr-2" />
                  {testingApiKey ? "Testando..." : "1. Testar API Key"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestApiConnection} 
                  disabled={testingApi || !config.stape_container_id || !config.stape_account_api_key}
                >
                  <Wifi className="w-4 h-4 mr-2" />
                  {testingApi ? "Testando..." : "2. Testar Conexão Completa"}
                </Button>
              </div>

              {/* Resultado do teste */}
              {apiTestResult && (
                <Alert className={apiTestResult.success ? "bg-green-50 dark:bg-green-950 border-green-200" : "bg-red-50 dark:bg-red-950 border-red-200"}>
                  <AlertCircle className={`h-4 w-4 ${apiTestResult.success ? "text-green-600" : "text-red-600"}`} />
                  <AlertTitle className={apiTestResult.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}>
                    {apiTestResult.success ? "Conexão OK" : "Falha na conexão"}
                  </AlertTitle>
                  <AlertDescription className={`text-sm space-y-1 ${apiTestResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                    <p>• API Key: {apiTestResult.apiKeyValid ? "✅ Válida" : "❌ Inválida"}</p>
                    {config.stape_container_id && (
                      <p>• Container: {apiTestResult.containerFound ? "✅ Encontrado" : "❌ Não encontrado"}</p>
                    )}
                    {apiTestResult.error && <p>• Erro: {apiTestResult.error}</p>}
                    {apiTestResult.hint && <p>• Dica: {apiTestResult.hint}</p>}
                    {apiTestResult.detail && <p>• Detalhe: {apiTestResult.detail}</p>}
                    {apiTestResult.containers && apiTestResult.containers.length > 0 && (
                      <p>• Containers disponíveis: {apiTestResult.containers.map(c => c.identifier).join(", ")}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Configuração Container API Key */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Container API Key (para eventos)
              </CardTitle>
              <CardDescription>
                Usada para enviar eventos server-side via webhook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Container API Key
                </Label>
                <Input
                  type="password"
                  value={config.stape_container_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, stape_container_api_key: e.target.value }))}
                  placeholder="sar:uizvxhep:fc3820b201c3eb42c8361b085799847783e1c389uizvxhep"
                />
                <p className="text-xs text-muted-foreground">
                  Em <a href="https://stape.io/containers" target="_blank" rel="noopener noreferrer" className="underline">Stape Containers</a> → Selecione o container → "Container API Key" (formato: <code>sar:xxx:xxx</code>)
                </p>
              </div>
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
              <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-purple-900 dark:text-purple-100">Onde obter esses valores</AlertTitle>
                <AlertDescription className="text-purple-800 dark:text-purple-200 text-sm space-y-2">
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

              <Button 
                variant="outline" 
                onClick={handleTestMetaCapi} 
                disabled={testingMetaCapi || !config.meta_pixel_id || !config.meta_capi_token}
              >
                <TestTube2 className="w-4 h-4 mr-2" />
                {testingMetaCapi ? "Testando..." : "Testar Meta CAPI"}
              </Button>

              {/* Resultado do teste Meta CAPI */}
              {metaCapiResult && (
                <Alert className={metaCapiResult.success ? "bg-green-50 dark:bg-green-950 border-green-200" : "bg-red-50 dark:bg-red-950 border-red-200"}>
                  <AlertCircle className={`h-4 w-4 ${metaCapiResult.success ? "text-green-600" : "text-red-600"}`} />
                  <AlertTitle className={metaCapiResult.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}>
                    {metaCapiResult.success ? "Meta CAPI OK" : "Falha na Meta CAPI"}
                  </AlertTitle>
                  <AlertDescription className={`text-sm ${metaCapiResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                    <p>{metaCapiResult.message}</p>
                    {metaCapiResult.details?.fbtrace_id && (
                      <p className="text-xs mt-1">fbtrace_id: {metaCapiResult.details.fbtrace_id}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
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
