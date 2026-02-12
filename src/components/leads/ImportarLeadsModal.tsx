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
import { Upload, FileSpreadsheet, Users, CheckCircle2, AlertTriangle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

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

  const importarMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa específica para importar");
      }
      if (rows.length === 0) throw new Error("Nenhum lead para importar");

      // 1. Insert leads
      const leadsToInsert = rows.map(r => ({
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

      // 2. If dispatch, create disparo_whatsapp + links
      if (isDisparo && insertedLeads && insertedLeads.length > 0) {
        const { data: disparo, error: disparoError } = await supabase
          .from("disparo_whatsapp")
          .insert({
            nome: nomeDisparo || `Importação ${new Date().toLocaleDateString("pt-BR")}`,
            id_empresa: empresaSelecionada,
            qtd_leads: insertedLeads.length,
            preset_usado: "importação",
            enviado: true,
            data_envio: dataDisparo.toISOString(),
          })
          .select("id")
          .single();

        if (disparoError) throw disparoError;

        const links = insertedLeads.map(l => ({
          id_disparo: disparo.id,
          id_lead: l.id_lead,
        }));

        const { error: linksError } = await supabase
          .from("disparo_whatsapp_lead")
          .insert(links);

        if (linksError) throw linksError;
      }

      return insertedLeads.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} leads importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["historico-disparos"] });
      queryClient.invalidateQueries({ queryKey: ["disparos-por-lead"] });
      resetState();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao importar leads");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
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
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Pré-visualização ({rows.length} leads)</span>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{limparNome(r.nome) || "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{formatarTelefone(r.telefone) || "—"}</TableCell>
                        <TableCell className="text-sm">{r.email || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                          ... e mais {rows.length - 10} leads
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!empresaSelecionada || empresaSelecionada === "todas" ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Selecione uma empresa específica para importar leads.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            onClick={() => importarMutation.mutate()}
            disabled={rows.length === 0 || !empresaSelecionada || empresaSelecionada === "todas" || importarMutation.isPending}
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
