import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { ValidacaoUTM } from "@/components/ValidacaoUTM";
import { CronjobsMonitor } from "@/components/CronjobsMonitor";
import { WebhookDestinosManager } from "@/components/WebhookDestinosManager";
import { SaudeIntegracoes } from "@/components/dashboard/SaudeIntegracoes";
import { ConexoesGrid } from "@/components/integracoes/ConexoesGrid";
import {
  MetaAdsForm, GoogleAdsForm, PipedriveForm, TokenizaForm, MauticForm, NotionForm,
  MetricoolForm, ChatwootForm, GA4Form, GSCForm, WordpressForm,
} from "@/components/integracoes/IntegracaoForms";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Database } from "@/integrations/supabase/types";

type Integracao = Database["public"]["Tables"]["integracao"]["Row"];
type TipoIntegracao = Database["public"]["Enums"]["tipo_integracao"];
type Empresa = Database["public"]["Tables"]["empresa"]["Row"];

const TIPO_LABEL: Record<TipoIntegracao, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  PIPEDRIVE: "Pipedrive",
  TOKENIZA: "Tokeniza",
  MAUTIC: "Mautic",
  NOTION: "Notion",
  METRICOOL: "Metricool",
  CHATWOOT: "Chatblue",
  GA4: "Google Analytics 4",
  GSC: "Google Search Console",
  WORDPRESS: "WordPress (Blog)",
};

const TIPOS_ORDENADOS: TipoIntegracao[] = [
  "META_ADS", "GOOGLE_ADS", "GA4", "GSC", "METRICOOL", "WORDPRESS",
  "MAUTIC", "PIPEDRIVE", "TOKENIZA", "CHATWOOT", "NOTION",
];

export default function Integracoes() {
  const { empresaSelecionada: empresaFiltro } = useEmpresa();

  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  // Form: estado consolidado num único objeto + helper setField
  const [tipoIntegracao, setTipoIntegracao] = useState<TipoIntegracao>("META_ADS");
  const [empresaForm, setEmpresaForm] = useState<string>("");
  const [ativo, setAtivo] = useState(true);
  const [form, setForm] = useState<Record<string, any>>({});
  const setField = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intRes, empRes] = await Promise.all([
        supabase.from("integracao").select("*").order("created_at", { ascending: false }),
        supabase.from("empresa").select("*").order("nome"),
      ]);
      if (intRes.error) throw intRes.error;
      if (empRes.error) throw empRes.error;
      setIntegracoes(intRes.data ?? []);
      setEmpresas(empRes.data ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar integrações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipoIntegracao("META_ADS");
    setEmpresaForm("");
    setAtivo(true);
    setForm({});
    setEditingId(null);
  };

  const handleEdit = (integracao: Integracao) => {
    setEditingId(integracao.id_integracao);
    setTipoIntegracao(integracao.tipo);
    setAtivo(integracao.ativo);
    const config = (integracao.config_json ?? {}) as any;
    const next: Record<string, any> = {};
    const composio = integracao.composio_connected_account_id || "";

    if (integracao.tipo === "META_ADS") {
      next.metaAccessToken = config.access_token || "";
      next.metaAdAccountId = config.ad_account_id || "";
      next.composioConnectedAccountId = composio;
    } else if (integracao.tipo === "GOOGLE_ADS") {
      next.googleDeveloperToken = config.developer_token || "";
      next.googleClientId = config.client_id || "";
      next.googleClientSecret = config.client_secret || "";
      next.googleRefreshToken = config.refresh_token || "";
      next.googleCustomerId = config.customer_id || "";
      next.googleLoginCustomerId = config.login_customer_id || "";
      next.composioConnectedAccountId = composio;
    } else if (integracao.tipo === "PIPEDRIVE") {
      next.pipedriveApiToken = config.api_token || "";
      next.pipedriveDomain = config.domain || "";
      next.pipedrivePipelineId = config.pipeline_id || "";
    } else if (integracao.tipo === "TOKENIZA") {
      next.tokenizaApiToken = config.api_token || "";
      next.tokenizaBaseUrl = config.base_url || "https://api.tokeniza.com.br";
    } else if (integracao.tipo === "MAUTIC") {
      next.mauticUrlBase = config.url_base || "";
      next.mauticLogin = config.login || "";
      next.mauticSenha = config.senha || "";
    } else if (integracao.tipo === "NOTION") {
      next.notionApiToken = config.api_token || "";
      next.notionDatabaseId = config.database_id || "1d52e840ab4f80eeac8ad56aed5b5b6e";
    } else if (integracao.tipo === "METRICOOL") {
      next.metricoolUserToken = config.user_token || "";
      next.metricoolUserId = config.user_id || "";
      next.metricoolBlogId = config.blog_id || "";
    } else if (integracao.tipo === "CHATWOOT") {
      next.chatwootUrlBase = config.api_url || config.url_base || "";
      next.chatwootApiToken = config.api_token || "";
      next.chatwootAccountId = config.webhook_secret || config.account_id || "";
      if (Array.isArray(config.empresas)) {
        const consolidatedMap = new Map<string, string[]>();
        for (const e of config.empresas) {
          const arr = Array.isArray(e.inboxes) ? e.inboxes : [];
          const existing = consolidatedMap.get(e.id_empresa) ?? [];
          consolidatedMap.set(e.id_empresa, [...existing, ...arr]);
        }
        next.chatwootEmpresasInboxes = Array.from(consolidatedMap.entries()).map(([id_empresa, inboxes]) => ({
          id_empresa,
          inboxes: [...new Set(inboxes)].join(", "),
        }));
      } else {
        next.chatwootEmpresasInboxes = [];
      }
    } else if (integracao.tipo === "GA4") {
      next.ga4Nome = config.nome || "";
      next.ga4PropertyId = config.property_id || "";
      next.ga4ClientId = config.client_id || "";
      next.ga4ClientSecret = config.client_secret || "";
      next.ga4RefreshToken = config.refresh_token || "";
      next.ga4SiteUrl = config.site_url || "";
    } else if (integracao.tipo === "GSC") {
      next.gscSiteUrl = config.site_url || "";
      next.composioConnectedAccountId = composio;
    } else if (integracao.tipo === "WORDPRESS") {
      next.wpUrlBase = config.url_base || "";
      next.wpUsuario = config.usuario || "";
      next.wpAppPassword = config.app_password || "";
    }
    setForm(next);
    setEmpresaForm(integracao.id_empresa || "");
    setDialogOpen(true);
  };

  const handleNovo = (tipo?: string) => {
    resetForm();
    if (tipo && (TIPOS_ORDENADOS as string[]).includes(tipo)) setTipoIntegracao(tipo as TipoIntegracao);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta integração?")) return;
    try {
      const { error } = await supabase.from("integracao").delete().eq("id_integracao", id);
      if (error) throw error;
      toast.success("Integração excluída");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  };

  const handleTest = async (integracao: Integracao) => {
    const id = integracao.id_integracao;
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      const { data, error } = await supabase.functions.invoke("validar-integracao", { body: { integracao_id: id } });
      if (error) {
        let msg = "Erro ao validar";
        if (error instanceof FunctionsHttpError) {
          const errData = await error.context.json();
          msg = errData.error || errData.message || msg;
        } else msg = error.message;
        toast.error(msg);
        return;
      }
      const result = data as any;
      if (!result.success) {
        toast.error(result.error || "Falha na validação");
        return;
      }
      toast.success(result.message || "Integração válida");
    } catch (e: any) {
      toast.error("Erro inesperado: " + e.message);
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaForm) {
      toast.error("Selecione uma empresa");
      return;
    }

    const cfg: Record<string, any> = {};
    const setReq = (cond: boolean, msg: string) => {
      if (!cond) { toast.error(msg); throw new Error("validation"); }
    };

    try {
      if (tipoIntegracao === "META_ADS") {
        setReq(!!form.metaAccessToken && !!form.metaAdAccountId, "Preencha todos os campos obrigatórios");
        cfg.access_token = form.metaAccessToken;
        cfg.ad_account_id = form.metaAdAccountId;
      } else if (tipoIntegracao === "GOOGLE_ADS") {
        setReq(!!form.googleDeveloperToken && !!form.googleClientId && !!form.googleClientSecret && !!form.googleRefreshToken && !!form.googleCustomerId, "Preencha todos os campos obrigatórios");
        cfg.developer_token = form.googleDeveloperToken;
        cfg.client_id = form.googleClientId;
        cfg.client_secret = form.googleClientSecret;
        cfg.refresh_token = form.googleRefreshToken;
        cfg.customer_id = form.googleCustomerId;
        cfg.login_customer_id = form.googleLoginCustomerId || null;
      } else if (tipoIntegracao === "PIPEDRIVE") {
        setReq(!!form.pipedriveApiToken && !!form.pipedriveDomain, "Preencha API Token e Domain");
        cfg.api_token = form.pipedriveApiToken;
        cfg.domain = form.pipedriveDomain;
        cfg.pipeline_id = form.pipedrivePipelineId || null;
      } else if (tipoIntegracao === "TOKENIZA") {
        setReq(!!form.tokenizaApiToken && !!form.tokenizaBaseUrl, "Preencha todos os campos");
        cfg.api_token = form.tokenizaApiToken;
        cfg.base_url = form.tokenizaBaseUrl;
      } else if (tipoIntegracao === "MAUTIC") {
        setReq(!!form.mauticUrlBase && !!form.mauticLogin && !!form.mauticSenha, "Preencha URL, login e senha");
        cfg.url_base = form.mauticUrlBase;
        cfg.login = form.mauticLogin;
        cfg.senha = form.mauticSenha;
      } else if (tipoIntegracao === "NOTION") {
        setReq(!!form.notionApiToken && !!form.notionDatabaseId, "Preencha API Token e Database ID");
        cfg.api_token = form.notionApiToken;
        cfg.database_id = form.notionDatabaseId;
      } else if (tipoIntegracao === "METRICOOL") {
        setReq(!!form.metricoolUserToken && !!form.metricoolUserId && !!form.metricoolBlogId, "Preencha todos os campos");
        cfg.user_token = form.metricoolUserToken;
        cfg.user_id = form.metricoolUserId;
        cfg.blog_id = form.metricoolBlogId;
      } else if (tipoIntegracao === "CHATWOOT") {
        setReq(!!form.chatwootUrlBase && !!form.chatwootApiToken, "Preencha URL e API Token");
        const empresasConfig = ((form.chatwootEmpresasInboxes ?? []) as { id_empresa: string; inboxes: string }[])
          .filter((e) => e.id_empresa && e.inboxes.trim())
          .map((e) => ({
            id_empresa: e.id_empresa,
            company_id: form.chatwootAccountId || null,
            inboxes: e.inboxes.split(",").map((s) => s.trim()).filter(Boolean),
          }));
        cfg.api_url = form.chatwootUrlBase;
        cfg.api_token = form.chatwootApiToken;
        cfg.webhook_secret = form.chatwootAccountId || null;
        cfg.empresas = empresasConfig;
      } else if (tipoIntegracao === "GA4") {
        setReq(!!form.ga4Nome && !!form.ga4PropertyId && !!form.ga4ClientId && !!form.ga4ClientSecret && !!form.ga4RefreshToken, "Preencha todos os campos obrigatórios");
        cfg.nome = form.ga4Nome;
        cfg.property_id = form.ga4PropertyId;
        cfg.client_id = form.ga4ClientId;
        cfg.client_secret = form.ga4ClientSecret;
        cfg.refresh_token = form.ga4RefreshToken;
        cfg.site_url = form.ga4SiteUrl || null;
      } else if (tipoIntegracao === "GSC") {
        setReq(!!form.gscSiteUrl && !!form.composioConnectedAccountId, "Preencha site_url e Composio ID");
        cfg.site_url = form.gscSiteUrl;
      } else if (tipoIntegracao === "WORDPRESS") {
        setReq(!!form.wpUrlBase && !!form.wpUsuario && !!form.wpAppPassword, "Preencha URL, usuário e Application Password");
        cfg.url_base = (form.wpUrlBase as string).replace(/\/$/, "");
        cfg.usuario = form.wpUsuario;
        cfg.app_password = form.wpAppPassword;
      }
    } catch {
      return; // validação já notificou
    }

    const composioId = (tipoIntegracao === "META_ADS" || tipoIntegracao === "GOOGLE_ADS" || tipoIntegracao === "GSC")
      ? (form.composioConnectedAccountId || null)
      : null;

    try {
      if (editingId) {
        const { error } = await supabase
          .from("integracao")
          .update({
            tipo: tipoIntegracao,
            config_json: cfg,
            ativo,
            id_empresa: empresaForm,
            composio_connected_account_id: composioId,
          })
          .eq("id_integracao", editingId);
        if (error) throw error;
        toast.success("Integração atualizada");
      } else {
        const { error } = await supabase
          .from("integracao")
          .insert({
            tipo: tipoIntegracao,
            config_json: cfg,
            ativo,
            id_empresa: empresaForm,
            composio_connected_account_id: composioId,
          });
        if (error) throw error;
        toast.success("Integração criada");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    }
  };

  const renderForm = () => {
    switch (tipoIntegracao) {
      case "META_ADS": return <MetaAdsForm state={form} setField={setField} />;
      case "GOOGLE_ADS": return <GoogleAdsForm state={form} setField={setField} />;
      case "PIPEDRIVE": return <PipedriveForm state={form} setField={setField} />;
      case "TOKENIZA": return <TokenizaForm state={form} setField={setField} />;
      case "MAUTIC": return <MauticForm state={form} setField={setField} />;
      case "NOTION": return <NotionForm state={form} setField={setField} />;
      case "METRICOOL": return <MetricoolForm state={form} setField={setField} />;
      case "CHATWOOT": return <ChatwootForm state={form} setField={setField} empresas={empresas} />;
      case "GA4": return <GA4Form state={form} setField={setField} />;
      case "GSC": return <GSCForm state={form} setField={setField} />;
      case "WORDPRESS": return <WordpressForm state={form} setField={setField} />;
      default: return null;
    }
  };

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const arr = empresaFiltro && empresaFiltro !== "todas"
      ? integracoes.filter((i) => i.id_empresa === empresaFiltro)
      : integracoes;
    const total = arr.length;
    const ativasOk = arr.filter((i) => i.ativo && !i.ultimo_erro).length;
    const comErro = arr.filter((i) => i.ativo && i.ultimo_erro).length;
    const desativadas = arr.filter((i) => !i.ativo).length;
    return { total, ativasOk, comErro, desativadas };
  }, [integracoes, empresaFiltro]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} integraç{stats.total === 1 ? "ão" : "ões"} · {stats.ativasOk} OK · {stats.comErro} com erro · {stats.desativadas} desativadas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => handleNovo()}>
              <Plus className="w-4 h-4 mr-2" />Nova Integração
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
                <Select value={empresaForm} onValueChange={setEmpresaForm}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id_empresa} value={emp.id_empresa}>{emp.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Integração</Label>
                <Select value={tipoIntegracao} onValueChange={(v) => { setTipoIntegracao(v as TipoIntegracao); setForm({}); }} disabled={!!editingId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_ORDENADOS.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderForm()}
              <div className="flex items-center space-x-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo" />
                <Label htmlFor="ativo">Integração Ativa</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                <Button type="submit">{editingId ? "Atualizar" : "Criar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <SaudeIntegracoes />

      <Tabs defaultValue="conexoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conexoes">Conexões</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="atividade">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="conexoes">
          <ConexoesGrid
            integracoes={integracoes}
            empresas={empresas}
            empresaFiltro={empresaFiltro}
            testingIds={testingIds}
            onNovo={handleNovo}
            onEditar={handleEdit}
            onExcluir={handleDelete}
            onTestar={handleTest}
          />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <WebhookDestinosManager />
        </TabsContent>

        <TabsContent value="atividade" className="space-y-4">
          <ValidacaoUTM />
          <CronjobsMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
