import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, Loader2, CheckCircle2, XCircle, Calendar, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";

interface Acao {
  id: string;
  client_key: string;
  tipo: string;
  fila: string | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  observacao: string | null;
  valor_estimado: number | null;
  data_acao: string;
  created_at: string;
}

const TIPO_META: Record<string, { label: string; icon: any; color: string }> = {
  abordagem: { label: "Abordagem", icon: MessageCircle, color: "bg-blue-600" },
  follow_up: { label: "Follow-up", icon: Calendar, color: "bg-amber-600" },
  ganho: { label: "Ganho", icon: CheckCircle2, color: "bg-emerald-600" },
  perdido: { label: "Perdido", icon: XCircle, color: "bg-rose-600" },
  observacao: { label: "Observação", icon: MessageSquarePlus, color: "bg-zinc-600" },
};

interface Props {
  clientKey: string;
  filasCliente: string[];
}

export function ClienteAcoesPanel({ clientKey, filasCliente }: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("abordagem");
  const [fila, setFila] = useState<string>(filasCliente[0] || "renovacao");
  const [observacao, setObservacao] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: acoes, isLoading, refetch } = useQuery({
    queryKey: ["blue-acao-list", clientKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("blue_cliente_acao_listar", { _client_key: clientKey });
      if (error) throw error;
      return (data || []) as Acao[];
    },
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: prof } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();

      const { error } = await supabase.from("blue_cliente_acao").insert({
        client_key: clientKey,
        tipo,
        fila: fila === "_none" ? null : fila,
        vendedor_id: user.id,
        vendedor_nome: prof?.nome || user.email,
        observacao: observacao || null,
        valor_estimado: valor ? Number(valor) : null,
      });
      if (error) throw error;
      toast.success("Ação registrada");
      setObservacao(""); setValor("");
      refetch();
      qc.invalidateQueries({ queryKey: ["blue-gestao-kpis"] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("blue_cliente_acao").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ação removida");
    refetch();
    qc.invalidateQueries({ queryKey: ["blue-gestao-kpis"] });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-xs uppercase text-muted-foreground tracking-wider">Registrar ação</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Fila</Label>
            <Select value={fila} onValueChange={setFila}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="renovacao">Renovação</SelectItem>
                <SelectItem value="upsell">Upsell</SelectItem>
                <SelectItem value="resgate">Resgate</SelectItem>
                <SelectItem value="winback">Win-back</SelectItem>
                <SelectItem value="_none">Sem fila</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(tipo === "ganho" || tipo === "perdido") && (
          <Input
            type="number"
            placeholder="Valor estimado (R$)"
            value={valor}
            onChange={e => setValor(e.target.value)}
            className="h-8 text-xs"
          />
        )}
        <Textarea
          placeholder="Observação…"
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          className="min-h-[60px] text-xs"
        />
        <Button size="sm" className="w-full" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <MessageSquarePlus className="h-3 w-3 mr-2" />}
          Registrar
        </Button>
      </div>

      <div>
        <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Histórico</p>
        {isLoading ? (
          <div className="h-12 bg-muted rounded animate-pulse" />
        ) : !acoes || acoes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma ação registrada para este cliente.</p>
        ) : (
          <div className="space-y-2">
            {acoes.map(a => {
              const meta = TIPO_META[a.tipo] || TIPO_META.observacao;
              const Icon = meta.icon;
              return (
                <div key={a.id} className="rounded-lg border border-border p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn("text-[10px]", meta.color)}>
                      <Icon className="h-3 w-3 mr-1" /> {meta.label}
                    </Badge>
                    {a.fila && <Badge variant="outline" className="text-[10px] capitalize">{a.fila}</Badge>}
                    {a.valor_estimado != null && <span className="text-emerald-700 font-bold">{formatCurrency(a.valor_estimado)}</span>}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(a.data_acao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <button onClick={() => excluir(a.id)} className="text-muted-foreground hover:text-rose-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {a.observacao && <p className="text-muted-foreground">{a.observacao}</p>}
                  {a.vendedor_nome && <p className="text-[10px] text-muted-foreground mt-1">por {a.vendedor_nome}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
