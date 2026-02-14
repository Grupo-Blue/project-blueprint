import { useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Users, CheckCircle2, AlertTriangle, CalendarIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { dispararWebhooksCRMLote } from "@/lib/webhookService";


interface LeadRow {
  nome: string;
  telefone: string;
  email: string;
}

interface ImportarLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCSV(text: string): LeadRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headerRaw = lines[0].split(sep).map(h => h.replace(/"/g, "").trim().toLowerCase());

  // Map columns flexibly
  const nomeIdx = headerRaw.findIndex(h => h.includes("nome"));
  const telIdx = headerRaw.findIndex(h => h.includes("telefone") || h.includes("tel") || h.includes("celular") || h.includes("whatsapp") || h.includes("phone"));
  const emailIdx = headerRaw.findIndex(h => h.includes("email") || h.includes("e-mail"));

  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(c => c.replace(/"/g, "").trim());
    return {
      nome: nomeIdx >= 0 ? cols[nomeIdx] || "" : "",
      telefone: telIdx >= 0 ? cols[telIdx] || "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
    };
  }).filter(r => r.nome || r.telefone || r.email);
}

function limparNome(nome: string): string {
  return nome
    .replace(/\[.*?\]/g, "")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatarTelefone(tel: string): string {
  let digits = tel.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

export function ImportarLeadsModal({ open, onOpenChange }: ImportarLeadsModalProps) {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [nomeDisparo, setNomeDisparo] = useState("");
  const [isDisparo, setIsDisparo] = useState(false);
  const [dataDisparo, setDataDisparo] = useState<Date>(new Date());

  const resetState = () => {
    setRows([]);
    setFileName("");
    setNomeDisparo("");
    setIsDisparo(false);
    setDataDisparo(new Date());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      if (!nomeDisparo) {
        setNomeDisparo(file.name.replace(/\.\w+$/, ""));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const [duplicadosInfo, setDuplicadosInfo] = useState<{ id_lead: string; telefone: string | null; email: string | null }[]>([]);
  const [verificado, setVerificado] = useState(false);

  const resetAll = () => {
    resetState();
    setDuplicadosInfo([]);
    setVerificado(false);
  };

  const verificarDuplicados = async () => {
    if (!empresaSelecionada || empresaSelecionada === "todas") return;

    const telefones = rows.map(r => formatarTelefone(r.telefone)).filter(Boolean);
    const emails = rows.map(r => r.email?.trim().toLowerCase()).filter(Boolean) as string[];

    const existentes: { id_lead: string; telefone: string | null; email: string | null }[] = [];

    for (let i = 0; i < telefones.length; i += 100) {
      const batch = telefones.slice(i, i + 100);
      const { data } = await supabase
        .from("lead")
        .select("id_lead, telefone, email")
        .eq("id_empresa", empresaSelecionada)
        .in("telefone", batch);
      if (data) existentes.push(...data);
    }

    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100);
      const { data } = await supabase
        .from("lead")
        .select("id_lead, telefone, email")
        .eq("id_empresa", empresaSelecionada)
        .in("email", batch);
      if (data) {
        for (const d of data) {
          if (!existentes.find(e => e.id_lead === d.id_lead)) {
            existentes.push(d);
          }
        }
      }
    }

    setDuplicadosInfo(existentes);
    setVerificado(true);
  };

  const categorizarLeads = () => {
    const novos: LeadRow[] = [];
    const paraAtualizar: { row: LeadRow; id_lead: string }[] = [];

    for (const r of rows) {
      const tel = formatarTelefone(r.telefone);
      const email = r.email?.trim().toLowerCase();

      const match = duplicadosInfo.find(d =>
        (tel && d.telefone === tel) || (email && d.email === email)
      );

      if (match) {
        paraAtualizar.push({ row: r, id_lead: match.id_lead });
      } else {
        novos.push(r);
      }
    }
    return { novos, paraAtualizar };
  };

  const { novos: leadsNovos, paraAtualizar: leadsMerge } = verificado
    ? categorizarLeads()
    : { novos: rows, paraAtualizar: [] };

  const importarMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa específica para importar");
      }
      if (rows.length === 0) throw new Error("Nenhum lead para importar");

      const allLeadIds: string[] = [];

      // 1. Update existing leads (merge)
      for (const { row, id_lead } of leadsMerge) {
        const updates: Record<string, string | null> = {};
        const nome = limparNome(row.nome);
        const tel = formatarTelefone(row.telefone);
        const email = row.email?.trim();
        if (nome) updates.nome_lead = nome;
        if (tel) updates.telefone = tel;
        if (email) updates.email = email;

        if (Object.keys(updates).length > 0) {
          await supabase.from("lead").update(updates).eq("id_lead", id_lead);
        }
        allLeadIds.push(id_lead);
      }

      // 2. Insert new leads
      if (leadsNovos.length > 0) {
        const leadsToInsert = leadsNovos.map(r => ({
          id_empresa: empresaSelecionada,
          nome_lead: limparNome(r.nome) || null,
          telefone: formatarTelefone(r.telefone) || null,
          email: r.email || null,
          origem_tipo: "MANUAL" as const,
        }));

        const { data: insertedLeads, error: leadsError } = await supabase
          .from("lead")
          .insert(leadsToInsert)
          .select("id_lead");

        if (leadsError) throw leadsError;
        if (insertedLeads) allLeadIds.push(...insertedLeads.map(l => l.id_lead));
      }

      // 3. If dispatch, create disparo_whatsapp + links for ALL leads
      if (isDisparo && allLeadIds.length > 0) {
        const { data: disparo, error: disparoError } = await supabase
          .from("disparo_whatsapp")
          .insert({
            nome: nomeDisparo || `Importação ${new Date().toLocaleDateString("pt-BR")}`,
            id_empresa: empresaSelecionada,
            qtd_leads: allLeadIds.length,
            preset_usado: "importação",
            enviado: true,
            data_envio: dataDisparo.toISOString(),
          })
          .select("id")
          .single();

        if (disparoError) throw disparoError;

        const links = allLeadIds.map(id => ({
          id_disparo: disparo.id,
          id_lead: id,
        }));

        const { error: linksError } = await supabase
          .from("disparo_whatsapp_lead")
          .insert(links);

        if (linksError) throw linksError;
      }

      return { total: allLeadIds.length, novos: leadsNovos.length, atualizados: leadsMerge.length };
    },
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.novos > 0) parts.push(`${result.novos} novos`);
      if (result.atualizados > 0) parts.push(`${result.atualizados} atualizados`);
      toast.success(`${result.total} leads processados (${parts.join(", ")})!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["historico-disparos"] });
      queryClient.invalidateQueries({ queryKey: ["disparos-por-lead"] });
      resetAll();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao importar leads");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Lista de Leads
          </DialogTitle>
          <DialogDescription>
            Envie um CSV com colunas Nome, Telefone e/ou Email para importar leads.
          </DialogDescription>
        </DialogHeader>

        {/* Upload area */}
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rows.length} leads</Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar um arquivo CSV
                </p>
                <p className="text-xs text-muted-foreground">
                  Colunas aceitas: Nome, Telefone, Email (separador ; ou ,)
                </p>
              </div>
            )}
          </div>

          {/* Dispatch option */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="is-disparo"
              checked={isDisparo}
              onCheckedChange={(v) => setIsDisparo(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="is-disparo" className="font-medium cursor-pointer">
                Esta lista é um disparo de WhatsApp
              </Label>
              <p className="text-xs text-muted-foreground">
                Se marcado, será registrado no histórico de disparos e contará no indicador de cada lead
              </p>
            </div>
          </div>

          {/* Dispatch name */}
          {isDisparo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nome-disparo">Nome do disparo</Label>
                <Input
                  id="nome-disparo"
                  value={nomeDisparo}
                  onChange={(e) => setNomeDisparo(e.target.value)}
                  placeholder="Ex: Campanha Janeiro 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data do disparo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataDisparo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dataDisparo, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataDisparo}
                      onSelect={(d) => d && setDataDisparo(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Preview table */}
          {/* Duplicate check results */}
          {rows.length > 0 && !verificado && (
            <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="text-sm flex-1">Verifique duplicados antes de importar.</span>
              <Button size="sm" variant="outline" onClick={verificarDuplicados}>
                Verificar duplicados
              </Button>
            </div>
          )}

          {verificado && leadsMerge.length > 0 && (
            <div className="flex items-center gap-2 text-sm p-3 rounded-md border bg-muted/30">
              <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <strong>{leadsMerge.length}</strong> lead(s) já existe(m) e serão <strong>atualizados</strong> (merge).
                {leadsNovos.length > 0 && <> + <strong>{leadsNovos.length}</strong> novos serão inseridos.</>}
              </span>
            </div>
          )}

          {verificado && leadsMerge.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-md">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Nenhum duplicado encontrado. Todos os {rows.length} leads são novos.
            </div>
          )}

          {!empresaSelecionada || empresaSelecionada === "todas" ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Selecione uma empresa específica para importar leads.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetAll(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            onClick={() => importarMutation.mutate()}
            disabled={rows.length === 0 || !verificado || !empresaSelecionada || empresaSelecionada === "todas" || importarMutation.isPending}
          >
            {importarMutation.isPending ? (
              "Importando..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Importar {rows.length} leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}