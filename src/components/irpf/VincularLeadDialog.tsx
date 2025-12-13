import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link, Search, Loader2, Check } from "lucide-react";

interface Props {
  declaracaoId: string;
  empresaSelecionada: string;
  cpfDeclaracao: string;
  nomeContribuinte: string;
  onVinculado: () => void;
}

export function VincularLeadDialog({ 
  declaracaoId, 
  empresaSelecionada, 
  cpfDeclaracao,
  nomeContribuinte,
  onVinculado 
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads-vincular', empresaSelecionada, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('lead')
        .select('id_lead, nome_lead, email, telefone, stage_atual')
        .eq('id_empresa', empresaSelecionada)
        .order('data_criacao', { ascending: false })
        .limit(50);

      if (searchTerm) {
        query = query.or(`nome_lead.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!empresaSelecionada,
  });

  const vincularMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('irpf_declaracao')
        .update({ id_lead: leadId })
        .eq('id', declaracaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead vinculado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['irpf-declaracoes'] });
      setOpen(false);
      onVinculado();
    },
    onError: (error) => {
      toast.error(`Erro ao vincular: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link className="w-4 h-4 mr-1" /> Vincular Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular Lead à Declaração</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {nomeContribuinte} (CPF: {cpfDeclaracao})
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : leads?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead encontrado
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads?.map((lead) => (
                    <TableRow key={lead.id_lead}>
                      <TableCell className="font-medium">{lead.nome_lead || '-'}</TableCell>
                      <TableCell>{lead.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.stage_atual || 'Lead'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => vincularMutation.mutate(lead.id_lead)}
                          disabled={vincularMutation.isPending}
                        >
                          {vincularMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
