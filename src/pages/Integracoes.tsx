import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, TestTube2 } from "lucide-react";
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
  
  // Pipedrive credentials
  const [pipedriveApiToken, setPipedriveApiToken] = useState("");
  const [pipedriveDomain, setPipedriveDomain] = useState("");
  const [pipedrivePipelineId, setPipedrivePipelineId] = useState("");
  
  // Tokeniza credentials
  const [tokenizaApiToken, setTokenizaApiToken] = useState("");
  const [tokenizaBaseUrl, setTokenizaBaseUrl] = useState("https://api.tokeniza.com.br");

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
    setPipedriveApiToken("");
    setPipedriveDomain("");
    setPipedrivePipelineId("");
    setTokenizaApiToken("");
    setTokenizaBaseUrl("https://api.tokeniza.com.br");
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
      let functionName = '';
      
      switch (integracao.tipo) {
        case 'META_ADS':
          functionName = 'coletar-metricas-meta';
          break;
        case 'GOOGLE_ADS':
          functionName = 'coletar-metricas-google';
          break;
        case 'PIPEDRIVE':
          functionName = 'sincronizar-pipedrive';
          break;
        case 'TOKENIZA':
          functionName = 'sincronizar-tokeniza';
          break;
        default:
          throw new Error('Tipo de integração não suportado');
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {}
      });
      
      // Verificar se a resposta contém erro
      const result = data as any;
      
      if (error) {
        // Erro de invocação da função
        toast.error(`Falha ao conectar: ${error.message}`);
        return;
      }
      
      if (result.error) {
        // Erro retornado pela API
        toast.error(result.error);
      } else if (result.resultados) {
        // Verificar se há erros nos resultados
        const erros = result.resultados.filter((r: any) => r.status === "error");
        if (erros.length > 0) {
          toast.error(erros[0].error || 'Erro ao testar integração');
        } else {
          toast.success(result.message || 'Integração testada com sucesso!');
        }
      } else {
        toast.success(result.message || 'Integração testada com sucesso!');
      }
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
          <p className="text-muted-foreground">Gerencie as integrações com Meta Ads, Google Ads, Pipedrive e Tokeniza por empresa</p>
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
                  </SelectContent>
                </Select>
              </div>

              {tipoIntegracao === "META_ADS" && (
                <>
                  <div className="space-y-2">
                    <Label>Access Token *</Label>
                    <Input
                      type="password"
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      placeholder="EAAxxxxxxxxxx"
                    />
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
                    <Label>Customer ID *</Label>
                    <Input
                      value={googleCustomerId}
                      onChange={(e) => setGoogleCustomerId(e.target.value)}
                      placeholder="123-456-7890"
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

      <Tabs defaultValue="meta" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="pipedrive">Pipedrive</TabsTrigger>
          <TabsTrigger value="tokeniza">Tokeniza</TabsTrigger>
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
                <Card key={integracao.id_integracao}>
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
                <Card key={integracao.id_integracao}>
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
      </Tabs>
    </div>
  );
}