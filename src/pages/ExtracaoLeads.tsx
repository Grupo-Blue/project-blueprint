import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Import, Loader2, Play, RefreshCw, Search, Users } from "lucide-react";

const TIPOS_EXTRACAO = [
  { value: "INSTAGRAM_FOLLOWERS", label: "Seguidores Instagram", campos: ["username", "limit"] },
  { value: "LINKEDIN_SEARCH", label: "Busca LinkedIn por Cargo", campos: ["cargo", "localizacao", "setor", "limit"] },
  { value: "LINKEDIN_COMPANY", label: "Funcionários LinkedIn Company", campos: ["company_url", "limit"] },
  { value: "FACEBOOK_PAGE", label: "Seguidores Facebook Page", campos: ["page_url", "limit"] },
];

const CAMPO_LABELS: Record<string, string> = {
  username: "Username Instagram (sem @)",
  cargo: "Cargo / Título",
  localizacao: "Localização",
  setor: "Setor / Indústria",
  company_url: "URL da Company Page",
  page_url: "URL da Facebook Page",
  limit: "Limite de resultados",
};

export default function ExtracaoLeads() {
  const { empresaSelecionada } = useEmpresa();
  const [tipo, setTipo] = useState("");
  const [parametros, setParametros] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [resultados, setResultados] = useState<any[] | null>(null);
  const [extracaoAtiva, setExtracaoAtiva] = useState<string | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);

  const tipoConfig = TIPOS_EXTRACAO.find((t) => t.value === tipo);

  useEffect(() => {
    if (empresaSelecionada) fetchHistorico();
  }, [empresaSelecionada]);

  async function fetchHistorico() {
    const { data } = await supabase
      .from("extracao_lead_frio")
      .select("*")
      .eq("id_empresa", empresaSelecionada)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistorico(data);
  }

  async function iniciarExtracao() {
    if (!tipo || !empresaSelecionada) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extrair-leads-apify", {
        body: { tipo_extracao: tipo, parametros, id_empresa: empresaSelecionada },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      toast.success("Extração iniciada! Aguardando resultados...");
      setExtracaoAtiva(data.id);
      setParametros({});
      fetchHistorico();
      startPolling(data.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar extração");
    } finally {
      setLoading(false);
    }
  }

  function startPolling(id: string) {
    setPollingIds((prev) => new Set(prev).add(id));
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verificar-extracao-leads", {
          body: { id },
        });
        if (error) throw error;

        if (data?.status === "CONCLUIDO") {
          clearInterval(interval);
          setPollingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
          setResultados(data.resultados || []);
          setExtracaoAtiva(id);
          toast.success(`Extração concluída: ${data.total} resultados`);
          fetchHistorico();
        } else if (data?.status === "ERRO") {
          clearInterval(interval);
          setPollingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
          toast.error("Extração falhou: " + (data.error || "erro no Apify"));
          fetchHistorico();
        }
      } catch {
        clearInterval(interval);
        setPollingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    }, 15000);
  }

  async function verResultados(extracao: any) {
    if (extracao.status === "CONCLUIDO" && extracao.resultados) {
      setResultados(extracao.resultados);
      setExtracaoAtiva(extracao.id);
    } else if (extracao.status === "EXECUTANDO") {
      setExtracaoAtiva(extracao.id);
      startPolling(extracao.id);
    }
  }

  function exportarCSV() {
    if (!resultados?.length) return;
    const headers = Object.keys(resultados[0]);
    const csv = [
      headers.join(","),
      ...resultados.map((r) => headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracao-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  }

  async function importarParaSGT() {
    if (!resultados?.length || !empresaSelecionada) return;
    setImportando(true);
    const empresaNome = "BLUE"; // TODO: resolve from context
    let ok = 0;
    let erros = 0;

    for (const r of resultados) {
      if (!r.email && !r.nome) continue;
      try {
        const { data } = await supabase.functions.invoke("criar-lead-api", {
          body: {
            empresa: empresaNome,
            lead: {
              nome_lead: r.nome || r.username || "",
              email: r.email || null,
              telefone: null,
              origem_canal: "SCRAPING",
              utm_source: r.plataforma?.toLowerCase() || "scraping",
              utm_medium: "cold_list",
            },
          },
        });
        if (data?.success) ok++;
        else erros++;
      } catch {
        erros++;
      }
    }

    setImportando(false);
    toast.success(`Importados: ${ok} leads. ${erros > 0 ? `Erros: ${erros}` : ""}`);
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDENTE: "secondary",
      EXECUTANDO: "default",
      CONCLUIDO: "default",
      ERRO: "destructive",
    };
    return <Badge variant={map[status] as any || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Extração de Leads</h1>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova Extração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tipo de Extração</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v); setParametros({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_EXTRACAO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoConfig?.campos.map((campo) => (
            <div key={campo}>
              <Label>{CAMPO_LABELS[campo] || campo}</Label>
              <Input
                value={parametros[campo] || ""}
                onChange={(e) => setParametros((p) => ({ ...p, [campo]: e.target.value }))}
                placeholder={campo === "limit" ? "200" : ""}
                type={campo === "limit" ? "number" : "text"}
              />
            </div>
          ))}

          <Button onClick={iniciarExtracao} disabled={loading || !tipo || polling}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Iniciar Extração
          </Button>

          {polling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando resultados do Apify... (verificação a cada 15s)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultados && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Resultados ({resultados.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarCSV}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button size="sm" onClick={importarParaSGT} disabled={importando}>
                {importando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Import className="h-4 w-4 mr-1" />}
                Importar p/ SGT
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {resultados.length > 0 && Object.keys(resultados[0]).map((key) => (
                      <TableHead key={key} className="capitalize">{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      {Object.values(r).map((val, j) => (
                        <TableCell key={j} className="max-w-[200px] truncate">{String(val || "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {resultados.length > 100 && (
                <p className="text-sm text-muted-foreground mt-2">Mostrando 100 de {resultados.length} resultados</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Histórico de Extrações
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchHistorico}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma extração realizada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parâmetros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultados</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((ext) => (
                  <TableRow key={ext.id}>
                    <TableCell className="font-medium">
                      {TIPOS_EXTRACAO.find((t) => t.value === ext.tipo_extracao)?.label || ext.tipo_extracao}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {JSON.stringify(ext.parametros)}
                    </TableCell>
                    <TableCell>{statusBadge(ext.status)}</TableCell>
                    <TableCell>{ext.total_resultados || 0}</TableCell>
                    <TableCell className="text-xs">{new Date(ext.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {(ext.status === "CONCLUIDO" || ext.status === "EXECUTANDO") && (
                        <Button variant="ghost" size="sm" onClick={() => verResultados(ext)}>
                          Ver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
