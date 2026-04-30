import { useMemo, useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, ExternalLink, Save, Search, Power, PowerOff, Users, QrCode } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";

const CANAIS = [
  { value: "meta", label: "Meta (Facebook/Instagram)" },
  { value: "google", label: "Google Ads" },
  { value: "organico", label: "Orgânico" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

const formSchema = z.object({
  nome_interno: z.string().trim().min(2, "Dê um nome interno").max(120),
  url_base: z.string().trim().url("URL inválida (precisa começar com http/https)").max(2048),
  utm_source: z.string().trim().min(1, "Obrigatório").max(80),
  utm_medium: z.string().trim().min(1, "Obrigatório").max(80),
  utm_campaign: z.string().trim().min(1, "Obrigatório").max(120),
  utm_content: z.string().trim().max(120).optional().or(z.literal("")),
  utm_term: z.string().trim().max(120).optional().or(z.literal("")),
  canal: z.string().optional(),
  observacoes: z.string().max(500).optional().or(z.literal("")),
});

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");

function montarUrl(base: string, utm: Record<string, string | undefined>) {
  if (!base) return "";
  let urlObj: URL;
  try {
    urlObj = new URL(base);
  } catch {
    return base;
  }
  Object.entries(utm).forEach(([k, v]) => {
    if (v && v.trim() !== "") urlObj.searchParams.set(k, v.trim());
  });
  return urlObj.toString();
}

export const GeradorUTM = () => {
  const { empresaSelecionada, empresasPermitidas, isAdmin } = useEmpresa();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const empresaInicial =
    empresaSelecionada && empresaSelecionada !== "todas"
      ? empresaSelecionada
      : empresasPermitidas[0]?.id_empresa || "";

  const [form, setForm] = useState({
    id_empresa: empresaInicial,
    nome_interno: "",
    url_base: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    canal: "meta",
    observacoes: "",
    tags: "" as string,
  });
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const empresaIdParaListar =
    empresaSelecionada && empresaSelecionada !== "todas"
      ? empresaSelecionada
      : form.id_empresa;

  const urlPreview = useMemo(
    () =>
      montarUrl(form.url_base, {
        utm_source: form.utm_source,
        utm_medium: form.utm_medium,
        utm_campaign: form.utm_campaign,
        utm_content: form.utm_content || undefined,
        utm_term: form.utm_term || undefined,
      }),
    [form]
  );

  const { data: links, refetch } = useQuery({
    queryKey: ["utm-links-com-contagem", empresaIdParaListar],
    enabled: !!empresaIdParaListar,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("utm_link_com_contagem", {
        _id_empresa: empresaIdParaListar,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const handleAplicarSugestoes = () => {
    setForm((f) => ({
      ...f,
      utm_source: f.utm_source || (f.canal === "google" ? "google" : f.canal === "meta" ? "facebook" : f.canal),
      utm_medium:
        f.utm_medium ||
        (f.canal === "meta" || f.canal === "google" ? "cpc" : f.canal === "email" ? "email" : f.canal === "organico" ? "social" : ""),
      utm_campaign: f.utm_campaign || (f.nome_interno ? slug(f.nome_interno) : ""),
    }));
  };

  const salvar = async () => {
    if (!form.id_empresa) {
      toast.error("Selecione uma empresa.");
      return;
    }
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSalvando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      const tagsArr = form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const { error } = await supabase.from("utm_link").insert({
        id_empresa: form.id_empresa,
        nome_interno: form.nome_interno.trim(),
        url_base: form.url_base.trim(),
        utm_source: form.utm_source.trim(),
        utm_medium: form.utm_medium.trim(),
        utm_campaign: form.utm_campaign.trim(),
        utm_content: form.utm_content.trim() || null,
        utm_term: form.utm_term.trim() || null,
        canal: form.canal || null,
        tags: tagsArr,
        observacoes: form.observacoes.trim() || null,
        created_by: userId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um link salvo com essa mesma combinação de UTMs.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Link UTM salvo!");
      setForm({
        ...form,
        nome_interno: "",
        utm_content: "",
        utm_term: "",
        observacoes: "",
        tags: "",
      });
      queryClient.invalidateQueries({ queryKey: ["utm-links-com-contagem"] });
      refetch();
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (id: string, novoAtivo: boolean) => {
    const { error } = await supabase.from("utm_link").update({ ativo: novoAtivo }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(novoAtivo ? "Link reativado" : "Link arquivado");
    refetch();
  };

  const linksFiltrados = useMemo(() => {
    let arr = links ?? [];
    if (!mostrarInativos) arr = arr.filter((l: any) => l.ativo);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      arr = arr.filter((l: any) =>
        [l.nome_interno, l.utm_campaign, l.utm_content, l.utm_source, l.utm_medium, l.canal]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q))
      );
    }
    return arr;
  }, [links, busca, mostrarInativos]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerar novo link UTM</CardTitle>
          <CardDescription>
            Monte a URL de campanha com UTMs e salve para acompanhar quantos leads cada link trouxe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome interno *</Label>
              <Input
                value={form.nome_interno}
                onChange={(e) => setForm({ ...form, nome_interno: e.target.value })}
                placeholder="Ex.: Lançamento Abril - Banner topo"
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select
                value={form.id_empresa}
                onValueChange={(v) => setForm({ ...form, id_empresa: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresasPermitidas.map((e) => (
                    <SelectItem key={e.id_empresa} value={e.id_empresa}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>URL de destino *</Label>
              <Input
                value={form.url_base}
                onChange={(e) => setForm({ ...form, url_base: e.target.value })}
                placeholder="https://seusite.com.br/landing"
              />
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>utm_source *</Label>
              <Input
                value={form.utm_source}
                onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                placeholder="facebook, google, instagram..."
              />
            </div>
            <div className="space-y-2">
              <Label>utm_medium *</Label>
              <Input
                value={form.utm_medium}
                onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                placeholder="cpc, social, email..."
              />
            </div>
            <div className="space-y-2">
              <Label>utm_campaign *</Label>
              <Input
                value={form.utm_campaign}
                onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                placeholder="lancamento_abril"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>utm_content (opcional)</Label>
              <Input
                value={form.utm_content}
                onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                placeholder="banner_topo, video_30s..."
              />
            </div>
            <div className="space-y-2">
              <Label>utm_term (opcional)</Label>
              <Input
                value={form.utm_term}
                onChange={(e) => setForm({ ...form, utm_term: e.target.value })}
                placeholder="palavra_chave"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="black_friday, novo_produto"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={1}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Detalhes opcionais sobre o link"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAplicarSugestoes}>
              Sugerir UTMs pelo canal
            </Button>
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <div className="text-xs text-muted-foreground">Pré-visualização</div>
              <code className="block break-all text-xs bg-muted p-2 rounded">
                {urlPreview || "https://..."}
              </code>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!urlPreview}
                  onClick={() => handleCopy(urlPreview)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar URL
                </Button>
                <Button size="sm" disabled={salvando} onClick={salvar}>
                  <Save className="h-3 w-3 mr-1" /> Salvar link
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Links salvos</CardTitle>
              <CardDescription>
                Cada link mostra quantos leads chegaram com esses UTMs.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 w-56"
                  placeholder="Buscar nome, campanha, source..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} id="inativos" />
                <Label htmlFor="inativos" className="text-xs">Mostrar arquivados</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!empresaIdParaListar && (
            <p className="text-sm text-muted-foreground">Selecione uma empresa para ver os links.</p>
          )}
          {empresaIdParaListar && linksFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum link salvo ainda.</p>
          )}
          <div className="space-y-3">
            {linksFiltrados.map((l: any) => {
              const url = montarUrl(l.url_base, {
                utm_source: l.utm_source,
                utm_medium: l.utm_medium,
                utm_campaign: l.utm_campaign,
                utm_content: l.utm_content || undefined,
                utm_term: l.utm_term || undefined,
              });
              return (
                <div
                  key={l.id}
                  className={`border rounded-lg p-3 space-y-2 ${l.ativo ? "" : "opacity-60"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{l.nome_interno}</span>
                        {l.canal && <Badge variant="secondary">{l.canal}</Badge>}
                        {!l.ativo && <Badge variant="outline">arquivado</Badge>}
                        {(l.tags ?? []).map((t: string) => (
                          <Badge key={t} variant="outline">{t}</Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 break-all">
                        <code>
                          source={l.utm_source} · medium={l.utm_medium} · campaign={l.utm_campaign}
                          {l.utm_content ? ` · content=${l.utm_content}` : ""}
                          {l.utm_term ? ` · term=${l.utm_term}` : ""}
                        </code>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Criado em {format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        {l.ultimo_lead_em
                          ? ` · último lead ${format(new Date(l.ultimo_lead_em), "dd/MM/yyyy", { locale: ptBR })}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-sm">
                        <Users className="h-3 w-3 mr-1" /> {Number(l.total_leads ?? 0)} leads
                      </Badge>
                    </div>
                  </div>

                  <code className="block break-all text-xs bg-muted p-2 rounded">{url}</code>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCopy(url)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/leads?utm_link_id=${l.id}`)}
                    >
                      <Users className="h-3 w-3 mr-1" /> Ver leads
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAtivo(l.id, !l.ativo)}
                    >
                      {l.ativo ? (
                        <><PowerOff className="h-3 w-3 mr-1" /> Arquivar</>
                      ) : (
                        <><Power className="h-3 w-3 mr-1" /> Reativar</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeradorUTM;
