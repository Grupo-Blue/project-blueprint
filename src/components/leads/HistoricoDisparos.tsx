import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { History, Download, Eye, Users, CheckCircle2, Clock, CalendarIcon } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function HistoricoDisparos() {
  const { empresaSelecionada } = useEmpresa();
  const queryClient = useQueryClient();
  const [detalheDisparoId, setDetalheDisparoId] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);

  const { data: disparos, isLoading } = useQuery({
    queryKey: ["historico-disparos", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("disparo_whatsapp")
        .select("*")
        .order("created_at", { ascending: false });

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar leads de um disparo específico
  const { data: leadsDoDisparo } = useQuery({
    queryKey: ["leads-disparo", detalheDisparoId],
    queryFn: async () => {
      if (!detalheDisparoId) return [];
      const { data, error } = await supabase
        .from("disparo_whatsapp_lead")
        .select(`
          id_lead,
          lead:id_lead (
            nome_lead, telefone, email, stage_atual, data_criacao,
            empresa:id_empresa (nome)
          )
        `)
        .eq("id_disparo", detalheDisparoId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!detalheDisparoId,
  });

  // Mutation para marcar como enviado
  const marcarEnviado = useMutation({
    mutationFn: async ({ id, data_envio }: { id: string; data_envio: string }) => {
      const { error } = await supabase
        .from("disparo_whatsapp")
        .update({ enviado: true, data_envio })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico-disparos"] });
      queryClient.invalidateQueries({ queryKey: ["disparos-por-lead"] });
      toast.success("Disparo marcado como enviado!");
      setDatePickerOpen(null);
    },
    onError: () => toast.error("Erro ao atualizar disparo"),
  });

  // Mutation para desmarcar
  const desmarcarEnviado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("disparo_whatsapp")
        .update({ enviado: false, data_envio: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico-disparos"] });
      queryClient.invalidateQueries({ queryKey: ["disparos-por-lead"] });
      toast.success("Disparo desmarcado");
    },
    onError: () => toast.error("Erro ao atualizar disparo"),
  });

  const formatarTelefone = (tel: string | null): string => {
    if (!tel) return "";
    let digits = tel.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.substring(1);
    if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
    return digits;
  };

  const reexportar = () => {
    if (!leadsDoDisparo || leadsDoDisparo.length === 0) return;

    const headers = ["Nome", "Telefone", "Email", "Empresa", "Stage Atual", "Data Entrada"];
    const rows = leadsDoDisparo.map((d: any) => {
      const l = d.lead;
      return [
        l?.nome_lead || "",
        formatarTelefone(l?.telefone),
        l?.email || "",
        l?.empresa?.nome || "",
        l?.stage_atual || "",
        l?.data_criacao ? format(parseISO(l.data_criacao), "dd/MM/yyyy") : "",
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const disparo = disparos?.find(d => d.id === detalheDisparoId);
    link.download = `re-export_${disparo?.nome?.replace(/\s+/g, "_") || "disparo"}.csv`;
    link.click();
    toast.success("CSV re-exportado!");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  if (!disparos || disparos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Histórico de Disparos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          Nenhum disparo realizado ainda. Use o botão "Exportar Lista" para criar seu primeiro disparo.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Histórico de Disparos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead>Exportado</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disparos.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {d.preset_usado || "manual"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{d.qtd_leads}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(d.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {d.enviado ? (
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-green-600 text-white text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Enviado
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {d.data_envio && format(parseISO(d.data_envio), "dd/MM/yy")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => desmarcarEnviado.mutate(d.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Popover open={datePickerOpen === d.id} onOpenChange={(open) => setDatePickerOpen(open ? d.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                            <Clock className="h-3 w-3" />
                            Marcar enviado
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-3 border-b">
                            <p className="text-sm font-medium">Quando foi enviado?</p>
                            <p className="text-xs text-muted-foreground">Selecione a data do disparo</p>
                          </div>
                          <Calendar
                            mode="single"
                            selected={undefined}
                            onSelect={(date) => {
                              if (date) {
                                marcarEnviado.mutate({ id: d.id, data_envio: date.toISOString() });
                              }
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                          <div className="p-2 border-t">
                            <Button
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => marcarEnviado.mutate({ id: d.id, data_envio: new Date().toISOString() })}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Enviado hoje
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetalheDisparoId(d.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver leads
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de detalhes do disparo */}
      <Dialog open={!!detalheDisparoId} onOpenChange={() => setDetalheDisparoId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Leads do disparo: {disparos?.find(d => d.id === detalheDisparoId)?.nome}
            </DialogTitle>
            <DialogDescription>
              {leadsDoDisparo?.length || 0} leads vinculados a este disparo
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsDoDisparo?.map((d: any) => (
                <TableRow key={d.id_lead}>
                  <TableCell className="font-medium text-sm">{d.lead?.nome_lead || "—"}</TableCell>
                  <TableCell className="text-sm">{formatarTelefone(d.lead?.telefone) || "—"}</TableCell>
                  <TableCell className="text-sm">{d.lead?.email || "—"}</TableCell>
                  <TableCell className="text-sm">{d.lead?.stage_atual || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-4">
            <Button onClick={reexportar} disabled={!leadsDoDisparo || leadsDoDisparo.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Re-exportar CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
