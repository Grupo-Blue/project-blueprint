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
        default:
          throw new Error('Tipo de integração não suportado');
      }
      
      // Executar todas as funções de coleta sequencialmente
      let hasError = false;
      let errorMessage = '';
      
      for (const functionName of functionNames) {
        // Para Mautic, precisamos de um email de teste
        const body = integracao.tipo === 'MAUTIC' 
          ? { email: 'teste@exemplo.com', id_empresa: (integracao.config_json as any).id_empresa }
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
        customer_id: googleCustomerId
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
        <TabsList>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="pipedrive">Pipedrive</TabsTrigger>
          <TabsTrigger value="tokeniza">Tokeniza</TabsTrigger>
          <TabsTrigger value="mautic">Mautic</TabsTrigger>
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
                            toast.info("Processando enriquecimento em lote...");
                            
                            const { data, error } = await supabase.functions.invoke('enriquecer-leads-lote', {
                              body: { 
                                id_empresa: config.id_empresa
                              }
                            });

                            if (error) throw error;

                            if (data?.success) {
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
      </Tabs>
    </div>
  );
}