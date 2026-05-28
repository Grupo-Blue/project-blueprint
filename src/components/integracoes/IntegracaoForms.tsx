import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Database } from "@/integrations/supabase/types";

type Empresa = Database["public"]["Tables"]["empresa"]["Row"];
type State = Record<string, any>;
type SetField = (key: string, value: any) => void;

interface FormProps {
  state: State;
  setField: SetField;
}

interface ChatwootFormProps extends FormProps {
  empresas: Empresa[];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Box({ tone = "blue", title, children }: { tone?: "blue" | "orange" | "green" | "pink"; title: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    orange: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
    green: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    pink: "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800",
  };
  return (
    <Alert className={tones[tone]}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-sm space-y-2">{children}</AlertDescription>
    </Alert>
  );
}

export function MetaAdsForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="Token Permanente Recomendado">
        <p><strong>Use System User Token para evitar expirações.</strong></p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>Meta Business Manager → Configurações → Usuários → Usuários do Sistema</li>
          <li>Adicionar com permissões <code>ads_read</code> e <code>ads_management</code></li>
          <li>Gerar Access Token (não expira) e colar abaixo</li>
        </ol>
      </Box>
      <Field label="Access Token (System User Token) *" hint="System User Token para integração permanente">
        <Input type="password" value={state.metaAccessToken ?? ""} onChange={(e) => setField("metaAccessToken", e.target.value)} placeholder="EAAxxxxxxxxxx" />
      </Field>
      <Field label="Ad Account ID *">
        <Input value={state.metaAdAccountId ?? ""} onChange={(e) => setField("metaAdAccountId", e.target.value)} placeholder="act_123456789" />
      </Field>
      <Field label="Composio Connected Account ID (fallback)" hint="Quando preenchido, a coleta tenta o Composio se a API direta falhar. Requer COMPOSIO_API_KEY no Supabase.">
        <Input value={state.composioConnectedAccountId ?? ""} onChange={(e) => setField("composioConnectedAccountId", e.target.value)} placeholder="ca_xxxxxxxxxxxx (opcional)" />
      </Field>
    </>
  );
}

export function GoogleAdsForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="Conta de Gerente (MCC)">
        <p>Se você acessa contas via Manager Account (MCC), preencha "Login Customer ID" com o ID da conta gerente (sem hífens).</p>
      </Box>
      <Field label="Developer Token *"><Input type="password" value={state.googleDeveloperToken ?? ""} onChange={(e) => setField("googleDeveloperToken", e.target.value)} /></Field>
      <Field label="Client ID *"><Input value={state.googleClientId ?? ""} onChange={(e) => setField("googleClientId", e.target.value)} /></Field>
      <Field label="Client Secret *"><Input type="password" value={state.googleClientSecret ?? ""} onChange={(e) => setField("googleClientSecret", e.target.value)} /></Field>
      <Field label="Refresh Token *"><Input type="password" value={state.googleRefreshToken ?? ""} onChange={(e) => setField("googleRefreshToken", e.target.value)} /></Field>
      <Field label="Customer ID (conta alvo) *"><Input value={state.googleCustomerId ?? ""} onChange={(e) => setField("googleCustomerId", e.target.value)} placeholder="123-456-7890" /></Field>
      <Field label="Login Customer ID (conta gerente - opcional)"><Input value={state.googleLoginCustomerId ?? ""} onChange={(e) => setField("googleLoginCustomerId", e.target.value)} placeholder="ID da conta gerente (MCC)" /></Field>
      <Field label="Composio Connected Account ID (fallback)" hint="Quando preenchido, a coleta tenta o Composio se a API direta falhar.">
        <Input value={state.composioConnectedAccountId ?? ""} onChange={(e) => setField("composioConnectedAccountId", e.target.value)} placeholder="ca_xxxxxxxxxxxx (opcional)" />
      </Field>
    </>
  );
}

export function PipedriveForm({ state, setField }: FormProps) {
  return (
    <>
      <Field label="API Token *"><Input type="password" value={state.pipedriveApiToken ?? ""} onChange={(e) => setField("pipedriveApiToken", e.target.value)} placeholder="Seu token de API do Pipedrive" /></Field>
      <Field label="Company Domain *" hint="De suaempresa.pipedrive.com → use 'suaempresa'"><Input value={state.pipedriveDomain ?? ""} onChange={(e) => setField("pipedriveDomain", e.target.value)} placeholder="suaempresa" /></Field>
      <Field label="Pipeline ID (opcional)" hint="ID da pipeline específica. Se vazio, sincroniza todos os deals."><Input value={state.pipedrivePipelineId ?? ""} onChange={(e) => setField("pipedrivePipelineId", e.target.value)} placeholder="Ex: 123" /></Field>
    </>
  );
}

export function TokenizaForm({ state, setField }: FormProps) {
  return (
    <>
      <Field label="API Token (x-auth-token) *"><Input type="password" value={state.tokenizaApiToken ?? ""} onChange={(e) => setField("tokenizaApiToken", e.target.value)} placeholder="Seu token de autenticação" /></Field>
      <Field label="Base URL *" hint="URL base da API Tokeniza"><Input value={state.tokenizaBaseUrl ?? "https://api.tokeniza.com.br"} onChange={(e) => setField("tokenizaBaseUrl", e.target.value)} placeholder="https://api.tokeniza.com.br" /></Field>
    </>
  );
}

export function MauticForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="Autenticação Mautic">
        <p>O Mautic enriquece leads com dados comportamentais, score, tags e localização. Auth: Basic (login + senha).</p>
      </Box>
      <Field label="URL Base *" hint="URL base da sua instância Mautic (sem /api)"><Input value={state.mauticUrlBase ?? ""} onChange={(e) => setField("mauticUrlBase", e.target.value)} placeholder="https://seu-mautic.com" /></Field>
      <Field label="Login (Username) *"><Input value={state.mauticLogin ?? ""} onChange={(e) => setField("mauticLogin", e.target.value)} placeholder="seu_usuario" /></Field>
      <Field label="Senha *"><Input type="password" value={state.mauticSenha ?? ""} onChange={(e) => setField("mauticSenha", e.target.value)} placeholder="sua_senha" /></Field>
    </>
  );
}

export function NotionForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="Configuração Notion">
        <ol className="list-decimal ml-4 space-y-1">
          <li>Acesse <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">notion.so/my-integrations</a> e crie uma integração</li>
          <li>Copie o Internal Integration Secret</li>
          <li>Compartilhe o database "Clientes" com a integração</li>
        </ol>
      </Box>
      <Field label="API Token (Integration Secret) *" hint="Internal Integration Secret do Notion"><Input type="password" value={state.notionApiToken ?? ""} onChange={(e) => setField("notionApiToken", e.target.value)} placeholder="secret_xxxxxxxxxxxxx" /></Field>
      <Field label="Database ID *" hint="ID do database de clientes no Notion"><Input value={state.notionDatabaseId ?? "1d52e840ab4f80eeac8ad56aed5b5b6e"} onChange={(e) => setField("notionDatabaseId", e.target.value)} /></Field>
    </>
  );
}

export function MetricoolForm({ state, setField }: FormProps) {
  return (
    <>
      <Box tone="pink" title="Configuração Metricool">
        <p>Métricas de Instagram para campanhas de awareness. Acesse app.metricool.com → Configurações → API.</p>
      </Box>
      <Field label="User Token *"><Input type="password" value={state.metricoolUserToken ?? ""} onChange={(e) => setField("metricoolUserToken", e.target.value)} /></Field>
      <Field label="User ID *"><Input value={state.metricoolUserId ?? ""} onChange={(e) => setField("metricoolUserId", e.target.value)} /></Field>
      <Field label="Blog ID *"><Input value={state.metricoolBlogId ?? ""} onChange={(e) => setField("metricoolBlogId", e.target.value)} placeholder="ID do blog/marca" /></Field>
    </>
  );
}

export function ChatwootForm({ state, setField, empresas }: ChatwootFormProps) {
  const mapping: { id_empresa: string; inboxes: string }[] = state.chatwootEmpresasInboxes ?? [];
  const setMapping = (next: typeof mapping) => setField("chatwootEmpresasInboxes", next);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatblue-webhook`;
  return (
    <>
      <Box tone="green" title="Configuração Chatblue">
        <p>Integração de atendimento WhatsApp via Chatblue. Configure o webhook abaixo no Chatblue.</p>
        <p className="mt-2"><strong>URL do Webhook:</strong></p>
        <code className="block bg-green-100 dark:bg-green-900 p-2 rounded text-xs break-all">{webhookUrl}</code>
        <p className="mt-2"><strong>Eventos:</strong> ticket.created, ticket.updated, message.created</p>
      </Box>
      <Field label="URL da API do Chatblue *" hint="ex: https://chatblue.suaempresa.com/api"><Input value={state.chatwootUrlBase ?? ""} onChange={(e) => setField("chatwootUrlBase", e.target.value)} /></Field>
      <Field label="API Token *" hint="Token para autenticar chamadas à API"><Input type="password" value={state.chatwootApiToken ?? ""} onChange={(e) => setField("chatwootApiToken", e.target.value)} /></Field>
      <Field label="Webhook Secret (opcional)" hint="Se configurado, o Chatblue deve enviar este valor no header X-Webhook-Secret"><Input type="password" value={state.chatwootAccountId ?? ""} onChange={(e) => setField("chatwootAccountId", e.target.value)} /></Field>

      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">Mapeamento Inbox → Empresa</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setMapping([...mapping, { id_empresa: "", inboxes: "" }])}>
            <Plus className="w-4 h-4 mr-1" />Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Quais inboxes/conexões do Chatblue pertencem a cada empresa.</p>
        {mapping.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">Nenhum mapeamento. Clique em "Adicionar".</p>
        ) : (
          <div className="space-y-3">
            {mapping.map((m, i) => (
              <div key={i} className="flex gap-2 items-start p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 space-y-2">
                  <Select value={m.id_empresa} onValueChange={(v) => { const next = [...mapping]; next[i].id_empresa = v; setMapping(next); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>{empresas.map((e) => <SelectItem key={e.id_empresa} value={e.id_empresa}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={m.inboxes} onChange={(e) => { const next = [...mapping]; next[i].inboxes = e.target.value; setMapping(next); }} placeholder="Ex: Blue Suporte, Blue Vendas" />
                  <p className="text-xs text-muted-foreground">Lista de inboxes separados por vírgula</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setMapping(mapping.filter((_, k) => k !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function GA4Form({ state, setField }: FormProps) {
  return (
    <>
      <Box tone="orange" title="Google Analytics 4 (Múltiplas Propriedades)">
        <p>Você pode adicionar várias propriedades GA4 para a mesma empresa. Use nomes descritivos.</p>
        <ol className="list-decimal ml-4 space-y-1 mt-2">
          <li>Google Cloud Console → ative Google Analytics Data API</li>
          <li>Crie OAuth 2.0 Client ID (Web Application)</li>
          <li>OAuth Playground → selecione scope <code>analytics.readonly</code></li>
          <li>Autorize → troque o código por Refresh Token</li>
          <li>Property ID em <strong>Admin → Property Settings</strong></li>
        </ol>
        <p className="mt-2 font-medium">⚠️ Sem o escopo analytics.readonly, a coleta retorna erro de permissão.</p>
      </Box>
      <Field label="Nome da Integração *" hint="Ex: GA4 Site Principal, GA4 Blog"><Input value={state.ga4Nome ?? ""} onChange={(e) => setField("ga4Nome", e.target.value)} /></Field>
      <Field label="Property ID *" hint="Apenas números"><Input value={state.ga4PropertyId ?? ""} onChange={(e) => setField("ga4PropertyId", e.target.value)} placeholder="123456789" /></Field>
      <Field label="Client ID *"><Input value={state.ga4ClientId ?? ""} onChange={(e) => setField("ga4ClientId", e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" /></Field>
      <Field label="Client Secret *"><Input type="password" value={state.ga4ClientSecret ?? ""} onChange={(e) => setField("ga4ClientSecret", e.target.value)} /></Field>
      <Field label="Refresh Token *" hint="OAuth Playground com scope analytics.readonly"><Input type="password" value={state.ga4RefreshToken ?? ""} onChange={(e) => setField("ga4RefreshToken", e.target.value)} /></Field>
      <Field label="Site URL (opcional)" hint="Base do site para construir URLs completas"><Input value={state.ga4SiteUrl ?? ""} onChange={(e) => setField("ga4SiteUrl", e.target.value)} placeholder="https://seusite.com.br" /></Field>
    </>
  );
}

export function GSCForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="Google Search Console via Composio">
        <p>Conecte a propriedade do Search Console no Composio Dashboard e cole o Connected Account ID aqui.</p>
      </Box>
      <Field label="Site URL *" hint="Exatamente como aparece no Search Console."><Input value={state.gscSiteUrl ?? ""} onChange={(e) => setField("gscSiteUrl", e.target.value)} placeholder="https://www.tayara.com.br/" /></Field>
      <Field label="Composio Connected Account ID *"><Input value={state.composioConnectedAccountId ?? ""} onChange={(e) => setField("composioConnectedAccountId", e.target.value)} placeholder="ca_xxxxxxxxxxxx" /></Field>
    </>
  );
}

export function WordpressForm({ state, setField }: FormProps) {
  return (
    <>
      <Box title="WordPress (Blog)">
        <p>Gere uma Application Password em <strong>wp-admin → Usuários → Application Passwords</strong>. O usuário precisa ler posts publicados.</p>
      </Box>
      <Field label="URL Base *" hint="Sem /wp-json no final"><Input value={state.wpUrlBase ?? ""} onChange={(e) => setField("wpUrlBase", e.target.value)} placeholder="https://www.tayara.com.br" /></Field>
      <Field label="Usuário *"><Input value={state.wpUsuario ?? ""} onChange={(e) => setField("wpUsuario", e.target.value)} placeholder="admin" /></Field>
      <Field label="Application Password *"><Input type="password" value={state.wpAppPassword ?? ""} onChange={(e) => setField("wpAppPassword", e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" /></Field>
    </>
  );
}
