import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Users, Filter, Flame, Zap, Activity, Snowflake, ShoppingCart, UserX, Target, ListFilter } from "lucide-react";
import { calcularScoreTemperatura, getPrioridade } from "@/lib/lead-scoring";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { format, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Preset = "base_completa" | "sem_clientes" | "negociacao_sem_compra" | "ex_clientes" | "quentes" | "mornos" | "frios" | "carrinho_abandonado";

const PRESETS: { value: Preset; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "base_completa", label: "Base completa", icon: <Users className="h-4 w-4" />, description: "Todos os leads da empresa" },
  { value: "sem_clientes", label: "Base sem clientes", icon: <UserX className="h-4 w-4" />, description: "Exclui quem já é cliente" },
  { value: "negociacao_sem_compra", label: "Negociação sem compra", icon: <Target className="h-4 w-4" />, description: "Em negociação mas não comprou" },
  { value: "ex_clientes", label: "Ex-clientes", icon: <UserX className="h-4 w-4" />, description: "Apenas ex-clientes" },
  { value: "quentes", label: "Leads quentes", icon: <Flame className="h-4 w-4 text-red-500" />, description: "Score ≥ 70 (URGENTE ou QUENTE)" },
  { value: "mornos", label: "Leads mornos", icon: <Activity className="h-4 w-4 text-yellow-500" />, description: "Score entre 30 e 69" },
  { value: "frios", label: "Leads frios", icon: <Snowflake className="h-4 w-4 text-blue-400" />, description: "Score < 30" },
  { value: "carrinho_abandonado", label: "Carrinho abandonado", icon: <ShoppingCart className="h-4 w-4 text-orange-500" />, description: "Carrinho abandonado e não investidor" },
];

interface ExportarListaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: any[];
}

export function ExportarListaModal({ open, onOpenChange, leads }: ExportarListaModalProps) {
  const { empresaSelecionada } = useEmpresa();
  const [preset, setPreset] = useState<Preset>("base_completa");
  const [nomeDisparo, setNomeDisparo] = useState("");
  const [mesesNegociacao, setMesesNegociacao] = useState(3);
  const [excluirTodosDisparos, setExcluirTodosDisparos] = useState(false);
  const [disparoExcluirId, setDisparoExcluirId] = useState<string>("none");
  const [exigirTelefone, setExigirTelefone] = useState(true);

  // Buscar disparos anteriores para filtro de exclusão
  const { data: disparosAnteriores } = useQuery({
    queryKey: ["disparos-anteriores", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("disparo_whatsapp")
        .select("id, nome, qtd_leads, created_at")
        .order("created_at", { ascending: false });
      
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar IDs de leads que já receberam disparos (para exclusão)
  const { data: leadsComDisparo } = useQuery({
    queryKey: ["leads-com-disparo", excluirTodosDisparos, disparoExcluirId],
    queryFn: async () => {
      if (!excluirTodosDisparos && disparoExcluirId === "none") return new Set<string>();
      
      let query = supabase.from("disparo_whatsapp_lead").select("id_lead");
      
      if (!excluirTodosDisparos && disparoExcluirId !== "none") {
        query = query.eq("id_disparo", disparoExcluirId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return new Set((data || []).map(d => d.id_lead));
    },
    enabled: open && (excluirTodosDisparos || disparoExcluirId !== "none"),
  });

  // Filtrar leads com base no preset
  const leadsFiltrados = useMemo(() => {
    let filtered = leads.filter(l => {
      if (empresaSelecionada && empresaSelecionada !== "todas" && l.id_empresa !== empresaSelecionada) return false;
      return true;
    });

    const stagesNegociacao = ["Negociação", "Aguardando pagamento", "Proposta", "Reunião agendada"];

    switch (preset) {
      case "sem_clientes":
        filtered = filtered.filter(l => l.cliente_notion?.status_cliente !== "Cliente");
        break;
      case "negociacao_sem_compra":
        const dataLimite = subMonths(new Date(), mesesNegociacao);
        filtered = filtered.filter(l => 
          stagesNegociacao.includes(l.stage_atual || "") &&
          !l.venda_realizada &&
          l.data_criacao && parseISO(l.data_criacao) >= dataLimite
        );
        break;
      case "ex_clientes":
        filtered = filtered.filter(l => l.cliente_notion?.status_cliente === "Ex-cliente");
        break;
      case "quentes":
        filtered = filtered.filter(l => {
          const score = calcularScoreTemperatura(l);
          return score >= 70;
        });
        break;
      case "mornos":
        filtered = filtered.filter(l => {
          const score = calcularScoreTemperatura(l);
          return score >= 30 && score < 70;
        });
        break;
      case "frios":
        filtered = filtered.filter(l => calcularScoreTemperatura(l) < 30);
        break;
      case "carrinho_abandonado":
        filtered = filtered.filter(l => l.tokeniza_carrinho_abandonado && !l.tokeniza_investidor);
        break;
    }

    // Excluir leads que já receberam disparos
    if (leadsComDisparo && leadsComDisparo.size > 0) {
      filtered = filtered.filter(l => !leadsComDisparo.has(l.id_lead));
    }

    // Exigir telefone válido
    if (exigirTelefone) {
      filtered = filtered.filter(l => {
        const tel = (l.telefone || "").replace(/\D/g, "");
        return tel.length >= 10;
      });
    }

    return filtered;
  }, [leads, preset, empresaSelecionada, mesesNegociacao, leadsComDisparo, exigirTelefone]);

  const formatarTelefone = (tel: string | null): string => {
    if (!tel) return "";
    let digits = tel.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.substring(1);
    if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
    if (digits.length >= 12 && !digits.startsWith("55")) digits = "55" + digits;
    return digits;
  };

  const getTemperaturaLabel = (lead: any): string => {
    const p = getPrioridade(lead);
    return p.label;
  };

  const handleExportar = async () => {
    if (!nomeDisparo.trim()) {
      toast.error("Dê um nome para o disparo");
      return;
    }

    try {
      // 1. Criar o registro do disparo
      const { data: user } = await supabase.auth.getUser();
      const { data: disparo, error: errDisparo } = await supabase
        .from("disparo_whatsapp")
        .insert({
          id_empresa: empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : leadsFiltrados[0]?.id_empresa,
          nome: nomeDisparo.trim(),
          preset_usado: preset,
          filtros_aplicados: {
            preset,
            excluirTodosDisparos,
            disparoExcluirId,
            exigirTelefone,
            mesesNegociacao: preset === "negociacao_sem_compra" ? mesesNegociacao : null,
          },
          qtd_leads: leadsFiltrados.length,
          created_by: user?.user?.id || null,
        } as any)
        .select("id")
        .single();

      if (errDisparo) throw errDisparo;

      // 2. Vincular leads ao disparo (em lotes de 500)
      const vinculos = leadsFiltrados.map(l => ({
        id_disparo: disparo.id,
        id_lead: l.id_lead,
      }));

      for (let i = 0; i < vinculos.length; i += 500) {
        const batch = vinculos.slice(i, i + 500);
        const { error: errVinculo } = await supabase
          .from("disparo_whatsapp_lead")
          .insert(batch as any);
        if (errVinculo) throw errVinculo;
      }

      // 3. Gerar e baixar CSV
      const headers = ["Nome", "Telefone", "Email", "Empresa", "Temperatura", "Score", "Stage Atual", "Data Entrada"];
      const rows = leadsFiltrados.map(l => [
        l.nome_lead || "",
        formatarTelefone(l.telefone),
        l.email || "",
        l.empresa?.nome || "",
        getTemperaturaLabel(l),
        calcularScoreTemperatura(l).toString(),
        l.stage_atual || "",
        l.data_criacao ? format(parseISO(l.data_criacao), "dd/MM/yyyy") : "",
      ]);

      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(";")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `disparo_${nomeDisparo.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast.success(`Exportados ${leadsFiltrados.length} leads e disparo registrado!`);
      onOpenChange(false);
      setNomeDisparo("");
    } catch (err: any) {
      toast.error("Erro ao exportar: " + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Lista para Disparo WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escolha um preset, aplique filtros de exclusão e exporte o CSV para o Mensageria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Presets */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Preset da lista</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                    preset === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {p.icon}
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Meses para negociação */}
          {preset === "negociacao_sem_compra" && (
            <div>
              <Label>Últimos quantos meses?</Label>
              <Select value={mesesNegociacao.toString()} onValueChange={v => setMesesNegociacao(parseInt(v))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {[1, 2, 3, 6, 12].map(m => (
                    <SelectItem key={m} value={m.toString()}>{m} {m === 1 ? "mês" : "meses"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filtros de exclusão */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filtros de exclusão
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="excluir-todos"
                checked={excluirTodosDisparos}
                onCheckedChange={(v) => {
                  setExcluirTodosDisparos(!!v);
                  if (v) setDisparoExcluirId("none");
                }}
              />
              <Label htmlFor="excluir-todos" className="text-sm cursor-pointer">
                Excluir quem já recebeu qualquer disparo
              </Label>
            </div>

            {!excluirTodosDisparos && (
              <div>
                <Label className="text-sm">Excluir quem recebeu disparo específico</Label>
                <Select value={disparoExcluirId} onValueChange={setDisparoExcluirId}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {disparosAnteriores?.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome} ({d.qtd_leads} leads - {format(parseISO(d.created_at), "dd/MM/yy")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="exigir-tel"
                checked={exigirTelefone}
                onCheckedChange={(v) => setExigirTelefone(!!v)}
              />
              <Label htmlFor="exigir-tel" className="text-sm cursor-pointer">
                Exigir telefone válido (≥ 10 dígitos)
              </Label>
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-accent/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Preview da lista</span>
              <Badge variant="secondary" className="text-lg px-3">
                {leadsFiltrados.length} leads
              </Badge>
            </div>
            {leadsFiltrados.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {leadsFiltrados.slice(0, 8).map(l => (
                  <div key={l.id_lead} className="flex justify-between">
                    <span>{l.nome_lead}</span>
                    <span>{formatarTelefone(l.telefone) || "Sem tel"}</span>
                  </div>
                ))}
                {leadsFiltrados.length > 8 && (
                  <div className="text-center pt-1">... e mais {leadsFiltrados.length - 8} leads</div>
                )}
              </div>
            )}
          </div>

          {/* Nome do disparo */}
          <div>
            <Label htmlFor="nome-disparo">Nome do disparo *</Label>
            <Input
              id="nome-disparo"
              placeholder="Ex: Campanha IRPF 2025 - Ex-clientes"
              value={nomeDisparo}
              onChange={e => setNomeDisparo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleExportar}
            disabled={leadsFiltrados.length === 0 || !nomeDisparo.trim()}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar {leadsFiltrados.length} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
