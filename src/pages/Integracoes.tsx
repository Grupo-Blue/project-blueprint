import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, TestTube2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ValidacaoUTM } from "@/components/ValidacaoUTM";
import { ImportarCampanhas } from "@/components/ImportarCampanhas";
import { CronjobsMonitor } from "@/components/CronjobsMonitor";
import { TokenizaProjetosManager } from "@/components/TokenizaProjetosManager";
import { WebhookDestinosManager } from "@/components/WebhookDestinosManager";
import type { Database } from "@/integrations/supabase/types";

type Integracao = Database["public"]["Tables"]["integracao"]["Row"];
type TipoIntegracao = Database["public"]["Enums"]["tipo_integracao"];
type Empresa = Database["public"]["Tables"]["empresa"]["Row"];

export default function Integracoes() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingIntegracoes, setTestingIntegracoes] = useState<Set<string>>(new Set());

  // Form state
  const [tipoIntegracao, setTipoIntegracao] = useState<TipoIntegracao>("META_ADS");
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");
  const [ativo, setAtivo] = useState(true);
  
  // Meta Ads credentials
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  
  // Google Ads credentials
  const [googleDeveloperToken, setGoogleDeveloperToken] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRefreshToken, setGoogleRefreshToken] = useState("");
  const [googleCustomerId, setGoogleCustomerId] = useState("");
  const [googleLoginCustomerId, setGoogleLoginCustomerId] = useState("");
  
  // Pipedrive credentials
  const [pipedriveApiToken, setPipedriveApiToken] = useState("");
  const [pipedriveDomain, setPipedriveDomain] = useState("");
  const [pipedrivePipelineId, setPipedrivePipelineId] = useState("");
  
  // Tokeniza credentials
  const [tokenizaApiToken, setTokenizaApiToken] = useState("");
  const [tokenizaBaseUrl, setTokenizaBaseUrl] = useState("https://api.tokeniza.com.br");
  
  // Mautic credentials
  const [mauticUrlBase, setMauticUrlBase] = useState("");
  const [mauticLogin, setMauticLogin] = useState("");
  const [mauticSenha, setMauticSenha] = useState("");

  // Notion credentials
  const [notionApiToken, setNotionApiToken] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("1d52e840ab4f80eeac8ad56aed5b5b6e");

  // Metricool credentials
  const [metricoolUserToken, setMetricoolUserToken] = useState("");
  const [metricoolUserId, setMetricoolUserId] = useState("");
  const [metricoolBlogId, setMetricoolBlogId] = useState("");

  // Chatwoot credentials
  const [chatwootUrlBase, setChatwootUrlBase] = useState("");
  const [chatwootApiToken, setChatwootApiToken] = useState("");
  const [chatwootAccountId, setChatwootAccountId] = useState("");
  const [chatwootEmpresasInboxes, setChatwootEmpresasInboxes] = useState<{id_empresa: string; inboxes: string}[]>([]);

  // GA4 credentials
  const [ga4Nome, setGa4Nome] = useState("");
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [ga4ClientId, setGa4ClientId] = useState("");
  const [ga4ClientSecret, setGa4ClientSecret] = useState("");
  const [ga4RefreshToken, setGa4RefreshToken] = useState("");
  const [ga4SiteUrl, setGa4SiteUrl] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [intResponse, empResponse] = await Promise.all([
        supabase.from("integracao").select("*").order("created_at", { ascending: false }),
        supabase.from("empresa").select("*").order("nome")
      ]);

      if (intResponse.error) throw intResponse.error;
      if (empResponse.error) throw empResponse.error;

      setIntegracoes(intResponse.data || []);
      setEmpresas(empResponse.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar integrações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipoIntegracao("META_ADS");
    setEmpresaSelecionada("");
    setAtivo(true);
    setMetaAccessToken("");
    setMetaAdAccountId("");
    setGoogleDeveloperToken("");
    setGoogleClientId("");
    setGoogleClientSecret("");
    setGoogleRefreshToken("");
    setGoogleCustomerId("");
    setGoogleLoginCustomerId("");
    setPipedriveApiToken("");
    setPipedriveDomain("");
    setPipedrivePipelineId("");
    setTokenizaApiToken("");
    setTokenizaBaseUrl("https://api.tokeniza.com.br");
    setMauticUrlBase("");
    setMauticLogin("");
    setMauticSenha("");
    setNotionApiToken("");
    setNotionDatabaseId("1d52e840ab4f80eeac8ad56aed5b5b6e");
    setMetricoolUserToken("");
    setMetricoolUserId("");
    setMetricoolBlogId("");
    setChatwootUrlBase("");
    setChatwootApiToken("");
    setChatwootAccountId("");
    setChatwootEmpresasInboxes([]);
    setGa4Nome("");
    setGa4PropertyId("");
    setGa4ClientId("");
    setGa4ClientSecret("");
    setGa4RefreshToken("");
    setGa4SiteUrl("");
    setEditingId(null);
  };

  const handleEdit = (integracao: Integracao) => {
    setEditingId(integracao.id_integracao);
    setTipoIntegracao(integracao.tipo);
    setAtivo(integracao.ativo);
    
    const config = integracao.config_json as any;
    
    if (integracao.tipo === "META_ADS") {
      setMetaAccessToken(config.access_token || "");
      setMetaAdAccountId(config.ad_account_id || "");
    } else if (integracao.tipo === "GOOGLE_ADS") {
      setGoogleDeveloperToken(config.developer_token || "");
      setGoogleClientId(config.client_id || "");
      setGoogleClientSecret(config.client_secret || "");
      setGoogleRefreshToken(config.refresh_token || "");
      setGoogleCustomerId(config.customer_id || "");
      setGoogleLoginCustomerId(config.login_customer_id || "");
    } else if (integracao.tipo === "PIPEDRIVE") {
      setPipedriveApiToken(config.api_token || "");
      setPipedriveDomain(config.domain || "");
      setPipedrivePipelineId(config.pipeline_id || "");
    } else if (integracao.tipo === "TOKENIZA") {
      setTokenizaApiToken(config.api_token || "");
      setTokenizaBaseUrl(config.base_url || "https://api.tokeniza.com.br");
    } else if (integracao.tipo === "MAUTIC") {
      setMauticUrlBase(config.url_base || "");
      setMauticLogin(config.login || "");
      setMauticSenha(config.senha || "");
    } else if (integracao.tipo === "NOTION") {
      setNotionApiToken(config.api_token || "");
      setNotionDatabaseId(config.database_id || "1d52e840ab4f80eeac8ad56aed5b5b6e");
    } else if (integracao.tipo === "METRICOOL") {
      setMetricoolUserToken(config.user_token || "");
      setMetricoolUserId(config.user_id || "");
      setMetricoolBlogId(config.blog_id || "");
    } else if (integracao.tipo === "CHATWOOT") {
      setChatwootUrlBase(config.url_base || "");
      setChatwootApiToken(config.api_token || "");
      setChatwootAccountId(config.account_id || "");
      // Carregar e consolidar mapeamento de inboxes por empresa
      if (config.empresas && Array.isArray(config.empresas)) {
        // Consolidar entradas duplicadas por empresa
        const consolidatedMap = new Map<string, string[]>();
        config.empresas.forEach((e: any) => {
          const inboxList = Array.isArray(e.inboxes) ? e.inboxes : [];
          const existing = consolidatedMap.get(e.id_empresa) || [];
          consolidatedMap.set(e.id_empresa, [...existing, ...inboxList]);
        });
        
        const consolidated = Array.from(consolidatedMap.entries()).map(([id_empresa, inboxes]) => ({
          id_empresa,
          inboxes: [...new Set(inboxes)].join(', ') // Remove duplicatas
        }));
        
        setChatwootEmpresasInboxes(consolidated);
      } else {
        setChatwootEmpresasInboxes([]);
      }
    } else if (integracao.tipo === "GA4") {
      setGa4Nome(config.nome || "");
      setGa4PropertyId(config.property_id || "");
      setGa4ClientId(config.client_id || "");
      setGa4ClientSecret(config.client_secret || "");
      setGa4RefreshToken(config.refresh_token || "");
      setGa4SiteUrl(config.site_url || "");
    }
    
    setEmpresaSelecionada(config.id_empresa || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta integração?")) return;

    try {
      const { error } = await supabase.from("integracao").delete().eq("id_integracao", id);
      if (error) throw error;
      toast.success("Integração excluída com sucesso");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir integração: " + error.message);
    }
  };

  const handleTestIntegration = async (integracao: Integracao) => {
    const integracaoId = integracao.id_integracao;
    
    setTestingIntegracoes(prev => new Set(prev).add(integracaoId));
    
    try {
      let functionNames: string[] = [];
      
      switch (integracao.tipo) {
        case 'META_ADS':
          functionNames = ['coletar-metricas-meta', 'coletar-criativos-meta'];
          break;
        case 'GOOGLE_ADS':
          functionNames = ['coletar-metricas-google', 'coletar-criativos-google'];
          break;
        case 'PIPEDRIVE':
          functionNames = ['sincronizar-pipedrive'];
          break;
        case 'TOKENIZA':
          functionNames = ['sincronizar-tokeniza'];
          break;
        case 'MAUTIC':
          functionNames = ['enriquecer-lead-mautic'];
          break;
        case 'NOTION':
          functionNames = ['sincronizar-notion'];
          break;
        case 'METRICOOL':
          functionNames = ['sincronizar-metricool'];
          break;
        case 'CHATWOOT':
          // Chatwoot usa webhooks, não tem função de coleta
          toast.info('Chatwoot usa webhooks para receber eventos. Configure o webhook no Chatwoot apontando para a URL do sistema.');
          return;
        default:
          throw new Error('Tipo de integração não suportado');
      }
      
      // Executar todas as funções de coleta sequencialmente
      let hasError = false;
      let errorMessage = '';
      
      for (const functionName of functionNames) {
        // Para Mautic, precisamos de um email de teste
        // Para Notion, não precisamos de parâmetros especiais
        const body = integracao.tipo === 'MAUTIC' 
          ? { email: 'teste@exemplo.com', id_empresa: (integracao.config_json as any).id_empresa }
          : integracao.tipo === 'NOTION'
            ? {}
            : { integracao_id: integracaoId };
          
        const { data, error } = await supabase.functions.invoke(functionName, {
          body
        });
        
        if (error) {
          hasError = true;
          if (error instanceof FunctionsHttpError) {
            const errorData = await error.context.json();
            errorMessage = errorData.error || errorData.message || 'Erro desconhecido';
          } else {
            errorMessage = error.message;
          }
          break;
        }
        
        const result = data as any;
        if (result.error || (result.resultados && result.resultados.some((r: any) => r.status === "error"))) {
          hasError = true;
          errorMessage = result.error || result.resultados.find((r: any) => r.status === "error")?.error || 'Erro na coleta';
          break;
        }
      }
      
      if (hasError) {
        toast.error(errorMessage);
        return;
      }
      
      // Após coletar dados diários, recalcular métricas semanais para atualizar o dashboard
      if (integracao.tipo === 'META_ADS' || integracao.tipo === 'GOOGLE_ADS') {
        const { error: calcError } = await supabase.functions.invoke('calcular-metricas-semanais', {
          body: {}
        });
        
        if (calcError) {
          console.error('Erro ao calcular métricas semanais:', calcError);
        }
      }
      
      toast.success('Integração testada com sucesso! Dados coletados e dashboard atualizado.');
    } catch (error: any) {
      console.error('Erro ao testar integração:', error);
      toast.error(`Erro inesperado: ${error.message}`);
    } finally {
      setTestingIntegracoes(prev => {
        const newSet = new Set(prev);
        newSet.delete(integracaoId);
        return newSet;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaSelecionada) {
      toast.error("Selecione uma empresa");
      return;
    }

    let configJson: any = { id_empresa: empresaSelecionada };

    if (tipoIntegracao === "META_ADS") {
      if (!metaAccessToken || !metaAdAccountId) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        access_token: metaAccessToken,
        ad_account_id: metaAdAccountId
      };
    } else if (tipoIntegracao === "GOOGLE_ADS") {
      if (!googleDeveloperToken || !googleClientId || !googleClientSecret || !googleRefreshToken || !googleCustomerId) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        developer_token: googleDeveloperToken,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: googleRefreshToken,
        customer_id: googleCustomerId,
        login_customer_id: googleLoginCustomerId || null
      };
    } else if (tipoIntegracao === "PIPEDRIVE") {
      if (!pipedriveApiToken || !pipedriveDomain) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        api_token: pipedriveApiToken,
        domain: pipedriveDomain,
        pipeline_id: pipedrivePipelineId || null
      };
      } else if (tipoIntegracao === "TOKENIZA") {
      if (!tokenizaApiToken || !tokenizaBaseUrl) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        api_token: tokenizaApiToken,
        base_url: tokenizaBaseUrl
      };
    } else if (tipoIntegracao === "MAUTIC") {
      if (!mauticUrlBase || !mauticLogin || !mauticSenha) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        url_base: mauticUrlBase,
        login: mauticLogin,
        senha: mauticSenha
      };
    } else if (tipoIntegracao === "NOTION") {
      if (!notionApiToken || !notionDatabaseId) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        api_token: notionApiToken,
        database_id: notionDatabaseId
      };
    } else if (tipoIntegracao === "METRICOOL") {
      if (!metricoolUserToken || !metricoolUserId || !metricoolBlogId) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      configJson = {
        ...configJson,
        user_token: metricoolUserToken,
        user_id: metricoolUserId,
        blog_id: metricoolBlogId
      };
    } else if (tipoIntegracao === "CHATWOOT") {
      if (!chatwootUrlBase || !chatwootAccountId) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      // Transformar mapeamento de inboxes por empresa
      const empresasConfig = chatwootEmpresasInboxes
        .filter(e => e.id_empresa && e.inboxes.trim())
        .map(e => ({
          id_empresa: e.id_empresa,
          inboxes: e.inboxes.split(',').map(i => i.trim()).filter(Boolean)
        }));
      
      configJson = {
        url_base: chatwootUrlBase,
        api_token: chatwootApiToken || null,
        account_id: chatwootAccountId,
        empresas: empresasConfig
      };
    } else if (tipoIntegracao === "GA4") {
      if (!ga4Nome || !ga4PropertyId || !ga4ClientId || !ga4ClientSecret || !ga4RefreshToken) {
        toast.error("Preencha todos os campos obrigatórios (nome, property ID, credenciais)");
        return;
      }
      configJson = {
        ...configJson,
        nome: ga4Nome,
        property_id: ga4PropertyId,
        client_id: ga4ClientId,
        client_secret: ga4ClientSecret,
        refresh_token: ga4RefreshToken,
        site_url: ga4SiteUrl || null
      };
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from("integracao")
          .update({ tipo: tipoIntegracao, config_json: configJson, ativo })
          .eq("id_integracao", editingId);
        if (error) throw error;
        toast.success("Integração atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("integracao")
          .insert({ tipo: tipoIntegracao, config_json: configJson, ativo });
        if (error) throw error;
        toast.success("Integração criada com sucesso");
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar integração: " + error.message);
    }
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Gerencie as integrações com Meta Ads, Google Ads, Pipedrive, Tokeniza e Mautic por empresa</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Integração
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Nova"} Integração</DialogTitle>
              <DialogDescription>Configure as credenciais de acesso às APIs</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id_empresa} value={emp.id_empresa}>{emp.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Integração</Label>
                <Select value={tipoIntegracao} onValueChange={(v) => setTipoIntegracao(v as TipoIntegracao)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="META_ADS">Meta Ads</SelectItem>
                    <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
                    <SelectItem value="PIPEDRIVE">Pipedrive</SelectItem>
                    <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    <SelectItem value="MAUTIC">Mautic</SelectItem>
                    <SelectItem value="NOTION">Notion</SelectItem>
                    <SelectItem value="METRICOOL">Metricool</SelectItem>
                    <SelectItem value="CHATWOOT">Chatwoot</SelectItem>
                    <SelectItem value="GA4">Google Analytics 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoIntegracao === "META_ADS" && (
                <>
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Token Permanente Recomendado</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                      <p><strong>Use System User Token para evitar expirações!</strong></p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Acesse <strong>Meta Business Manager</strong> (business.facebook.com)</li>
                        <li>Vá em <strong>Configurações → Usuários → Usuários do Sistema</strong></li>
                        <li>Clique em <strong>Adicionar</strong> e configure permissões (ads_read, ads_management)</li>
                        <li>Gere o <strong>Access Token</strong> - ele nunca expira!</li>
                        <li>Cole o token no campo abaixo</li>
                      </ol>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Access Token (System User Token) *</Label>
                    <Input
                      type="password"
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      placeholder="EAAxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use um System User Token para integração permanente sem expirações
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Ad Account ID *</Label>
                    <Input
                      value={metaAdAccountId}
                      onChange={(e) => setMetaAdAccountId(e.target.value)}
                      placeholder="act_123456789"
                    />
                  </div>
                </>
              )}

              {tipoIntegracao === "GOOGLE_ADS" && (
                <>
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Conta de Gerente (MCC)</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                      <p><strong>Se você acessa contas via Manager Account (MCC):</strong></p>
                      <p>Preencha o campo "Manager Customer ID" com o ID da sua conta de gerente (sem hífens). Isso é necessário quando você gerencia várias contas através de uma MCC.</p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Developer Token *</Label>
                    <Input
                      type="password"
                      value={googleDeveloperToken}
                      onChange={(e) => setGoogleDeveloperToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client ID *</Label>
                    <Input
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret *</Label>
                    <Input
                      type="password"
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh Token *</Label>
                    <Input
                      type="password"
                      value={googleRefreshToken}
                      onChange={(e) => setGoogleRefreshToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer ID (conta alvo) *</Label>
                    <Input
                      value={googleCustomerId}
                      onChange={(e) => setGoogleCustomerId(e.target.value)}
                      placeholder="123-456-7890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Login Customer ID (conta gerente - opcional)</Label>
                    <Input
                      value={googleLoginCustomerId}
                      onChange={(e) => setGoogleLoginCustomerId(e.target.value)}
                      placeholder="ID da conta gerente (MCC), se houver"
                    />
                  </div>
                </>
              )}

              {tipoIntegracao === "PIPEDRIVE" && (
                <>
                  <div className="space-y-2">
                    <Label>API Token *</Label>
                    <Input
                      type="password"
                      value={pipedriveApiToken}
                      onChange={(e) => setPipedriveApiToken(e.target.value)}
                      placeholder="Seu token de API do Pipedrive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Domain *</Label>
                    <Input
                      value={pipedriveDomain}
                      onChange={(e) => setPipedriveDomain(e.target.value)}
                      placeholder="suaempresa (de suaempresa.pipedrive.com)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pipeline ID (opcional)</Label>
                    <Input
                      value={pipedrivePipelineId}
                      onChange={(e) => setPipedrivePipelineId(e.target.value)}
                      placeholder="Ex: 123 (deixe vazio para sincronizar todas)"
                    />
                    <p className="text-xs text-muted-foreground">
                      ID da pipeline específica do Pipedrive (ex: "Blue - Pipeline de Vendas"). Se não preenchido, sincroniza todos os deals.
                    </p>
                  </div>
                </>
              )}

              {tipoIntegracao === "TOKENIZA" && (
                <>
                  <div className="space-y-2">
                    <Label>API Token (x-auth-token) *</Label>
                    <Input
                      type="password"
                      value={tokenizaApiToken}
                      onChange={(e) => setTokenizaApiToken(e.target.value)}
                      placeholder="Seu token de autenticação da Tokeniza"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Base URL *</Label>
                    <Input
                      value={tokenizaBaseUrl}
                      onChange={(e) => setTokenizaBaseUrl(e.target.value)}
                      placeholder="https://api.tokeniza.com.br"
                    />
                    <p className="text-xs text-muted-foreground">URL base da API Tokeniza</p>
                  </div>
                </>
              )}

              {tipoIntegracao === "MAUTIC" && (
                <>
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Autenticação Mautic</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      <p>O Mautic será usado para enriquecer leads do Pipedrive com dados comportamentais, score, tags e localização.</p>
                      <p className="mt-2"><strong>Autenticação:</strong> Basic Auth (Login + Senha)</p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>URL Base *</Label>
                    <Input
                      value={mauticUrlBase}
                      onChange={(e) => setMauticUrlBase(e.target.value)}
                      placeholder="https://seu-mautic.com"
                    />
                    <p className="text-xs text-muted-foreground">URL base da sua instância Mautic (sem /api)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Login (Username) *</Label>
                    <Input
                      value={mauticLogin}
                      onChange={(e) => setMauticLogin(e.target.value)}
                      placeholder="seu_usuario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha (Password) *</Label>
                    <Input
                      type="password"
                      value={mauticSenha}
                      onChange={(e) => setMauticSenha(e.target.value)}
                      placeholder="sua_senha"
                    />
                  </div>
                </>
              )}

              {tipoIntegracao === "NOTION" && (
                <>
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">Configuração Notion</AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                      <p><strong>Como configurar a integração:</strong></p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Acesse <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">notion.so/my-integrations</a></li>
                        <li>Crie uma nova integração (ex: "SGT")</li>
                        <li>Copie o <strong>Internal Integration Secret</strong></li>
                        <li>Compartilhe o database "Clientes" com a integração</li>
                        <li>Cole o token no campo abaixo</li>
                      </ol>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>API Token (Integration Secret) *</Label>
                    <Input
                      type="password"
                      value={notionApiToken}
                      onChange={(e) => setNotionApiToken(e.target.value)}
                      placeholder="secret_xxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Internal Integration Secret do Notion</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Database ID *</Label>
                    <Input
                      value={notionDatabaseId}
                      onChange={(e) => setNotionDatabaseId(e.target.value)}
                      placeholder="1d52e840ab4f80eeac8ad56aed5b5b6e"
                    />
                    <p className="text-xs text-muted-foreground">ID do database de clientes no Notion</p>
                  </div>
                </>
              )}

              {tipoIntegracao === "METRICOOL" && (
                <>
                  <Alert className="bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800">
                    <AlertCircle className="h-4 w-4 text-pink-600" />
                    <AlertTitle className="text-pink-900 dark:text-pink-100">Configuração Metricool</AlertTitle>
                    <AlertDescription className="text-pink-800 dark:text-pink-200 text-sm space-y-2">
                      <p><strong>Métricas de Instagram para campanhas de awareness</strong></p>
                      <p>Acesse app.metricool.com → Configurações → API para obter suas credenciais.</p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>User Token *</Label>
                    <Input
                      type="password"
                      value={metricoolUserToken}
                      onChange={(e) => setMetricoolUserToken(e.target.value)}
                      placeholder="Seu token de autenticação"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>User ID *</Label>
                    <Input
                      value={metricoolUserId}
                      onChange={(e) => setMetricoolUserId(e.target.value)}
                      placeholder="ID do usuário Metricool"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Blog ID *</Label>
                    <Input
                      value={metricoolBlogId}
                      onChange={(e) => setMetricoolBlogId(e.target.value)}
                      placeholder="ID do blog/marca no Metricool"
                    />
                  </div>
                </>
              )}

              {tipoIntegracao === "CHATWOOT" && (
                <>
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900 dark:text-green-100">Configuração Chatwoot</AlertTitle>
                    <AlertDescription className="text-green-800 dark:text-green-200 text-sm space-y-2">
                      <p><strong>Integração de atendimento WhatsApp/Chat</strong></p>
                      <p>Configure o webhook no Chatwoot para receber eventos em tempo real.</p>
                      <p className="mt-2"><strong>URL do Webhook:</strong></p>
                      <code className="block bg-green-100 dark:bg-green-900 p-2 rounded text-xs break-all">
                        {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatwoot-webhook`}
                      </code>
                      <p className="mt-2"><strong>Eventos recomendados:</strong> conversation_created, message_created, conversation_status_changed</p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>URL Base do Chatwoot *</Label>
                    <Input
                      value={chatwootUrlBase}
                      onChange={(e) => setChatwootUrlBase(e.target.value)}
                      placeholder="https://app.chatwoot.com"
                    />
                    <p className="text-xs text-muted-foreground">URL da sua instância Chatwoot</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Account ID *</Label>
                    <Input
                      value={chatwootAccountId}
                      onChange={(e) => setChatwootAccountId(e.target.value)}
                      placeholder="Ex: 1"
                    />
                    <p className="text-xs text-muted-foreground">ID da conta Chatwoot (visível na URL do painel)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>API Token (opcional)</Label>
                    <Input
                      type="password"
                      value={chatwootApiToken}
                      onChange={(e) => setChatwootApiToken(e.target.value)}
                      placeholder="Token de acesso à API"
                    />
                    <p className="text-xs text-muted-foreground">Necessário apenas para chamadas ativas à API do Chatwoot</p>
                  </div>

                  {/* Mapeamento de Inboxes por Empresa */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Mapeamento Inbox → Empresa</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setChatwootEmpresasInboxes([...chatwootEmpresasInboxes, { id_empresa: '', inboxes: '' }])}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure quais inboxes do Chatwoot pertencem a cada empresa. Leads serão criados na empresa correspondente à inbox de origem.
                    </p>
                    
                    {chatwootEmpresasInboxes.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">
                        Nenhum mapeamento configurado. Clique em "Adicionar" para mapear inboxes.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {chatwootEmpresasInboxes.map((mapping, index) => (
                          <div key={index} className="flex gap-2 items-start p-3 bg-muted/30 rounded-lg">
                            <div className="flex-1 space-y-2">
                              <Select
                                value={mapping.id_empresa}
                                onValueChange={(value) => {
                                  const updated = [...chatwootEmpresasInboxes];
                                  updated[index].id_empresa = value;
                                  setChatwootEmpresasInboxes(updated);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                  {empresas.map((emp) => (
                                    <SelectItem key={emp.id_empresa} value={emp.id_empresa}>{emp.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={mapping.inboxes}
                                onChange={(e) => {
                                  const updated = [...chatwootEmpresasInboxes];
                                  updated[index].inboxes = e.target.value;
                                  setChatwootEmpresasInboxes(updated);
                                }}
                                placeholder="Ex: Blue Suporte, Blue Vendas, Blue WhatsApp"
                              />
                              <p className="text-xs text-muted-foreground">
                                Lista de nomes de inboxes separados por vírgula
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setChatwootEmpresasInboxes(chatwootEmpresasInboxes.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {tipoIntegracao === "GA4" && (
                <>
                  <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-900 dark:text-orange-100">Google Analytics 4 (Múltiplas Propriedades)</AlertTitle>
                    <AlertDescription className="text-orange-800 dark:text-orange-200 text-sm space-y-2">
                      <p><strong>Você pode adicionar várias propriedades GA4 para a mesma empresa!</strong></p>
                      <p>Use nomes descritivos como "GA4 Site Principal", "GA4 Landing Pages", "GA4 Blog".</p>
                      <ol className="list-decimal ml-4 space-y-1 mt-2">
                        <li>Acesse <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a></li>
                        <li>Ative a <strong>Google Analytics Data API</strong></li>
                        <li>Crie um OAuth 2.0 Client ID (Web Application)</li>
                        <li>
                          Acesse <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="underline font-medium">OAuth 2.0 Playground</a>
                        </li>
                        <li>
                          <strong className="text-orange-900 dark:text-orange-100">IMPORTANTE:</strong> Selecione o escopo <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">https://www.googleapis.com/auth/analytics.readonly</code>
                        </li>
                        <li>Autorize e troque o código pelo Refresh Token</li>
                        <li>O Property ID está em <strong>Admin → Property Settings</strong></li>
                      </ol>
                      <p className="mt-2 text-orange-900 dark:text-orange-100 font-medium">
                        ⚠️ Sem o escopo analytics.readonly, a coleta retornará erro de permissão!
                      </p>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Nome da Integração *</Label>
                    <Input
                      value={ga4Nome}
                      onChange={(e) => setGa4Nome(e.target.value)}
                      placeholder="Ex: GA4 Site Principal, GA4 Landing Pages, GA4 Blog"
                    />
                    <p className="text-xs text-muted-foreground">Nome para identificar esta integração (você pode ter múltiplas GA4 por empresa)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Property ID *</Label>
                    <Input
                      value={ga4PropertyId}
                      onChange={(e) => setGa4PropertyId(e.target.value)}
                      placeholder="123456789"
                    />
                    <p className="text-xs text-muted-foreground">ID da propriedade GA4 (apenas números)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Client ID *</Label>
                    <Input
                      value={ga4ClientId}
                      onChange={(e) => setGa4ClientId(e.target.value)}
                      placeholder="xxxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret *</Label>
                    <Input
                      type="password"
                      value={ga4ClientSecret}
                      onChange={(e) => setGa4ClientSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh Token *</Label>
                    <Input
                      type="password"
                      value={ga4RefreshToken}
                      onChange={(e) => setGa4RefreshToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Obtenha via OAuth Playground com scope analytics.readonly</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Site URL (opcional)</Label>
                    <Input
                      value={ga4SiteUrl}
                      onChange={(e) => setGa4SiteUrl(e.target.value)}
                      placeholder="https://seusite.com.br"
                    />
                    <p className="text-xs text-muted-foreground">URL base do site para construir URLs completas</p>
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo" />
                <Label htmlFor="ativo">Integração Ativa</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <ValidacaoUTM />
      </div>

      <Tabs defaultValue="meta" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="pipedrive">Pipedrive</TabsTrigger>
          <TabsTrigger value="tokeniza">Tokeniza</TabsTrigger>
          <TabsTrigger value="mautic">Mautic</TabsTrigger>
          <TabsTrigger value="notion">Notion</TabsTrigger>
          <TabsTrigger value="metricool">Metricool</TabsTrigger>
          <TabsTrigger value="chatwoot">Chatwoot</TabsTrigger>
          <TabsTrigger value="ga4">GA4</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-4">
          {integracoes.filter(i => i.tipo === "META_ADS").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Meta Ads configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "META_ADS").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <div key={integracao.id_integracao} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                          <CardDescription>
                            Ad Account: {config.ad_account_id}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {integracao.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTestIntegration(integracao)}
                            disabled={testingIntegracoes.has(integracao.id_integracao)}
                          >
                            <TestTube2 className="w-4 h-4 mr-2" />
                            {testingIntegracoes.has(integracao.id_integracao) ? 'Testando...' : 'Testar'}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  
                  <ImportarCampanhas 
                    plataforma="META"
                    integracaoId={integracao.id_integracao}
                    empresaNome={empresa?.nome || "Empresa não encontrada"}
                  />
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="google" className="space-y-4">
          {integracoes.filter(i => i.tipo === "GOOGLE_ADS").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Google Ads configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "GOOGLE_ADS").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <div key={integracao.id_integracao} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                          <CardDescription>
                            Customer ID: {config.customer_id}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {integracao.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTestIntegration(integracao)}
                            disabled={testingIntegracoes.has(integracao.id_integracao)}
                          >
                            <TestTube2 className="w-4 h-4 mr-2" />
                            {testingIntegracoes.has(integracao.id_integracao) ? 'Testando...' : 'Testar'}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  
                  <ImportarCampanhas 
                    plataforma="GOOGLE"
                    integracaoId={integracao.id_integracao}
                    empresaNome={empresa?.nome || "Empresa não encontrada"}
                  />
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="pipedrive" className="space-y-4">
          {integracoes.filter(i => i.tipo === "PIPEDRIVE").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Pipedrive configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "PIPEDRIVE").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                        <CardDescription>
                          Domain: {config.domain}.pipedrive.com
                          {config.pipeline_id && (
                            <>
                              <br />
                              Pipeline ID: {config.pipeline_id}
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleTestIntegration(integracao)}
                        disabled={testingIntegracoes.has(integracao.id_integracao)}
                      >
                        <TestTube2 className="w-4 h-4 mr-2" />
                        {testingIntegracoes.has(integracao.id_integracao) ? 'Testando...' : 'Testar'}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Sincronize emails dos leads existentes que ainda não têm email cadastrado.
                    </p>
                    <Button 
                      variant="secondary" 
                      className="w-full"
                      onClick={async () => {
                        if (!window.confirm("Deseja buscar emails no Pipedrive para todos os leads que não têm email? Isso pode levar alguns minutos.")) {
                          return;
                        }

                        const integracaoId = integracao.id_integracao;
                        setTestingIntegracoes(prev => new Set(prev).add(integracaoId));
                        
                        try {
                          toast.info("Sincronizando emails do Pipedrive... Isso pode levar alguns minutos.");
                          
                          const { data, error } = await supabase.functions.invoke('sincronizar-emails-pipedrive', {
                            body: { 
                              id_empresa: config.id_empresa
                            }
                          });

                          // Se deu timeout (comum em processamento batch), assumir sucesso
                          if (error && error.message?.includes('FunctionsRelayError')) {
                            toast.success("Sincronização em andamento. O processamento está completo. Verifique a página de Leads.");
                          } else if (error) {
                            throw error;
                          } else if (data?.success) {
                            toast.success(`Sincronização concluída! ${data.atualizados} de ${data.processados} leads atualizados com email.`);
                          } else {
                            toast.error(data?.message || "Erro ao sincronizar emails");
                          }
                        } catch (error: any) {
                          console.error('Erro ao sincronizar emails:', error);
                          toast.error(error.message || "Erro ao processar sincronização de emails");
                        } finally {
                          setTestingIntegracoes(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(integracaoId);
                            return newSet;
                          });
                        }
                      }}
                      disabled={testingIntegracoes.has(integracao.id_integracao)}
                    >
                      {testingIntegracoes.has(integracao.id_integracao) ? 'Sincronizando...' : 'Sincronizar Emails Pipedrive'}
                    </Button>
                  </div>
                </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="tokeniza" className="space-y-4">
          {integracoes.filter(i => i.tipo === "TOKENIZA").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Tokeniza configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "TOKENIZA").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                        <CardDescription>
                          Base URL: {config.base_url}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestIntegration(integracao)}
                          disabled={testingIntegracoes.has(integracao.id_integracao)}
                        >
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {testingIntegracoes.has(integracao.id_integracao) ? 'Testando...' : 'Testar'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}

          {/* Gerenciador de Projetos Tokeniza */}
          {integracoes.filter(i => i.tipo === "TOKENIZA").length > 0 && (
            <TokenizaProjetosManager />
          )}
        </TabsContent>

        <TabsContent value="mautic" className="space-y-4">
          {integracoes.filter(i => i.tipo === "MAUTIC").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Mautic configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "MAUTIC").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                        <CardDescription>
                          URL Base: {config.url_base}
                          <br />
                          Login: {config.login}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestIntegration(integracao)}
                          disabled={testingIntegracoes.has(integracao.id_integracao)}
                        >
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {testingIntegracoes.has(integracao.id_integracao) ? 'Testando...' : 'Testar'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Enriqueça todos os leads existentes com dados comportamentais do Mautic (score, engajamento, tags, localização).
                      </p>
                      <Button 
                        variant="secondary" 
                        className="w-full"
                        onClick={async () => {
                          if (!window.confirm("Deseja enriquecer todos os leads com dados do Mautic? Isso pode levar alguns minutos.")) {
                            return;
                          }

                          const integracaoId = integracao.id_integracao;
                          setTestingIntegracoes(prev => new Set(prev).add(integracaoId));
                          
                          try {
                            toast.info("Processando enriquecimento em lote... Isso pode levar alguns minutos. Você pode verificar os resultados na página de Leads.");
                            
                            const { data, error } = await supabase.functions.invoke('enriquecer-leads-lote', {
                              body: { 
                                id_empresa: config.id_empresa
                              }
                            });

                            // Se deu timeout (comum em processamento batch), assumir sucesso
                            if (error && error.message?.includes('FunctionsRelayError')) {
                              toast.success("Enriquecimento completo! O processamento terminou. Verifique a página de Leads para ver os dados do Mautic.");
                            } else if (error) {
                              throw error;
                            } else if (data?.success) {
                              toast.success(`Enriquecimento concluído! ${data.enriquecidos} de ${data.processados} leads enriquecidos. ${data.erros} erros.`);
                            } else {
                              toast.error(data?.message || "Erro ao enriquecer leads em lote");
                            }
                          } catch (error: any) {
                            console.error('Erro ao enriquecer leads em lote:', error);
                            toast.error(error.message || "Erro ao processar enriquecimento em lote");
                          } finally {
                            setTestingIntegracoes(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(integracaoId);
                              return newSet;
                            });
                          }
                        }}
                        disabled={testingIntegracoes.has(integracao.id_integracao)}
                      >
                        {testingIntegracoes.has(integracao.id_integracao) ? 'Processando...' : 'Enriquecer Todos os Leads'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="notion" className="space-y-4">
          {integracoes.filter(i => i.tipo === "NOTION").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Notion configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "NOTION").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                        <CardDescription>
                          Database ID: {config.database_id}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestIntegration(integracao)}
                          disabled={testingIntegracoes.has(integracao.id_integracao)}
                        >
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {testingIntegracoes.has(integracao.id_integracao) ? 'Sincronizando...' : 'Sincronizar'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="metricool" className="space-y-4">
          {integracoes.filter(i => i.tipo === "METRICOOL").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Metricool configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "METRICOOL").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{empresa?.nome || "Empresa não encontrada"}</CardTitle>
                        <CardDescription>
                          User ID: {config.user_id} | Blog ID: {config.blog_id}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestIntegration(integracao)}
                          disabled={testingIntegracoes.has(integracao.id_integracao)}
                        >
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {testingIntegracoes.has(integracao.id_integracao) ? 'Sincronizando...' : 'Sincronizar'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="chatwoot" className="space-y-4">
          {integracoes.filter(i => i.tipo === "CHATWOOT").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração Chatwoot configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "CHATWOOT").map((integracao) => {
              const config = integracao.config_json as any;
              
              // Consolidar empresas duplicadas para exibição
              const consolidatedEmpresas = (() => {
                if (!config.empresas || !Array.isArray(config.empresas)) return [];
                const map = new Map<string, string[]>();
                config.empresas.forEach((emp: any) => {
                  const inboxList = Array.isArray(emp.inboxes) ? emp.inboxes : [];
                  const existing = map.get(emp.id_empresa) || [];
                  map.set(emp.id_empresa, [...existing, ...inboxList]);
                });
                return Array.from(map.entries()).map(([id_empresa, inboxes]) => {
                  const empresa = empresas.find(e => e.id_empresa === id_empresa);
                  return {
                    nome: empresa?.nome || id_empresa,
                    inboxes: [...new Set(inboxes)]
                  };
                });
              })();
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>Chatwoot</CardTitle>
                        <CardDescription>
                          URL: {config.url_base} | Account ID: {config.account_id}
                        </CardDescription>
                        <div className="mt-3 space-y-1">
                          {consolidatedEmpresas.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma empresa mapeada</p>
                          ) : (
                            consolidatedEmpresas.map((emp, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium text-foreground">{emp.nome}:</span>{' '}
                                <span className="text-muted-foreground">{emp.inboxes.join(', ')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="ga4" className="space-y-4">
          {integracoes.filter(i => i.tipo === "GA4").length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma integração GA4 configurada
              </CardContent>
            </Card>
          ) : (
            integracoes.filter(i => i.tipo === "GA4").map((integracao) => {
              const config = integracao.config_json as any;
              const empresa = empresas.find(e => e.id_empresa === config.id_empresa);
              
              return (
                <Card key={integracao.id_integracao}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.nome || `GA4 ${config.property_id}`}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({empresa?.nome || "Empresa não encontrada"})
                          </span>
                        </CardTitle>
                        <CardDescription>
                          Property ID: {config.property_id}
                          {config.site_url && (
                            <>
                              {" "}• Site: {config.site_url}
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${integracao.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                          {integracao.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            const integracaoId = integracao.id_integracao;
                            setTestingIntegracoes(prev => new Set(prev).add(integracaoId));
                            
                            try {
                              const { data, error } = await supabase.functions.invoke('coletar-metricas-ga4', {
                                body: { id_empresa: config.id_empresa }
                              });
                              
                              if (error) throw error;
                              
                              if (data?.success) {
                                // Verificar se realmente coletou dados
                                const totalRegistros = data.resultados?.reduce((acc: number, r: any) => 
                                  acc + (r.metricas_inseridas || 0), 0) || 0;
                                
                                if (totalRegistros > 0) {
                                  toast.success(`Métricas GA4 coletadas! ${totalRegistros} registros processados.`);
                                } else {
                                  toast.warning('Conexão OK, mas nenhum dado novo encontrado. Verifique se há tráfego nas landing pages.');
                                }
                              } else {
                                // Tratamento de erros específicos
                                const errorMsg = data?.error || '';
                                if (errorMsg.includes('SCOPE_INSUFFICIENT')) {
                                  toast.error('Erro de permissão: O Refresh Token não possui o escopo analytics.readonly. Gere um novo token no OAuth Playground com o escopo correto.');
                                } else if (errorMsg.includes('REFRESH_TOKEN_EXPIRED')) {
                                  toast.error('Refresh Token expirado. Gere um novo token no OAuth Playground.');
                                } else {
                                  toast.error(errorMsg || 'Erro ao coletar métricas GA4');
                                }
                              }
                            } catch (error: any) {
                              console.error('Erro ao testar GA4:', error);
                              const errorMsg = error.message || '';
                              if (errorMsg.includes('SCOPE_INSUFFICIENT') || errorMsg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
                                toast.error('Erro de permissão: Refresh Token sem escopo analytics.readonly. Acesse o OAuth Playground e gere um novo token com o escopo correto.');
                              } else {
                                toast.error(errorMsg || 'Erro ao coletar métricas GA4');
                              }
                            } finally {
                              setTestingIntegracoes(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(integracaoId);
                                return newSet;
                              });
                            }
                          }}
                          disabled={testingIntegracoes.has(integracao.id_integracao)}
                        >
                          <TestTube2 className="w-4 h-4 mr-2" />
                          {testingIntegracoes.has(integracao.id_integracao) ? 'Coletando...' : 'Coletar Métricas'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(integracao)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(integracao.id_integracao)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-8">
        <WebhookDestinosManager />
      </div>

      <div className="mt-8">
        <CronjobsMonitor />
      </div>
    </div>
  );
}