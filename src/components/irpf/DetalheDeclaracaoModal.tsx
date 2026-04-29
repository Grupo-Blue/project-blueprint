import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { ComparativoAnual } from "@/components/irpf/ComparativoAnual";

interface IRPFBemDireito {
  id: string;
  numero_bem: number;
  grupo_codigo: string;
  grupo_descricao?: string;
  codigo_descricao?: string;
  discriminacao: string;
  valor_ano_anterior: number;
  valor_ano_atual: number;
  cripto_codigo?: string;
  participacao_cnpj?: string;
  participacao_razao_social?: string;
}

interface IRPFDividaOnus {
  id: string;
  numero_divida?: number;
  codigo: string;
  codigo_descricao?: string;
  discriminacao: string;
  situacao_ano_anterior: number;
  situacao_ano_atual: number;
  credor_nome?: string;
}

interface DeclaracaoMin {
  id: string;
  cpf: string;
  nome_contribuinte: string;
  exercicio: number;
}

interface Props {
  declaracao: DeclaracaoMin | null;
  empresaSelecionada: string;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const getGrupoBadge = (grupoCodigo: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    "01": { cls: "text-blue-600", label: "Imóveis" },
    "02": { cls: "text-gray-600", label: "Veículos" },
    "03": { cls: "text-purple-600", label: "Participações" },
    "04": { cls: "text-green-600", label: "Aplicações" },
    "06": { cls: "text-cyan-600", label: "Depósitos" },
    "07": { cls: "text-indigo-600", label: "Fundos" },
    "08": { cls: "text-orange-600", label: "Criptoativos" },
  };
  const g = map[grupoCodigo];
  return g ? <Badge variant="outline" className={g.cls}>{g.label}</Badge> : <Badge variant="outline">Outros</Badge>;
};

export function DetalheDeclaracaoModal({ declaracao, empresaSelecionada, onOpenChange }: Props) {
  const { data: bens } = useQuery({
    queryKey: ["irpf-bens", declaracao?.id],
    queryFn: async () => {
      if (!declaracao) return [];
      const { data, error } = await supabase
        .from("irpf_bem_direito")
        .select("*")
        .eq("id_declaracao", declaracao.id)
        .order("numero_bem");
      if (error) throw error;
      return data as IRPFBemDireito[];
    },
    enabled: !!declaracao,
  });

  const { data: dividas } = useQuery({
    queryKey: ["irpf-dividas", declaracao?.id],
    queryFn: async () => {
      if (!declaracao) return [];
      const { data, error } = await supabase
        .from("irpf_divida_onus")
        .select("*")
        .eq("id_declaracao", declaracao.id)
        .order("numero_divida");
      if (error) throw error;
      return data as IRPFDividaOnus[];
    },
    enabled: !!declaracao,
  });

  return (
    <Dialog open={!!declaracao} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {declaracao?.nome_contribuinte} — Exercício {declaracao?.exercicio}
          </DialogTitle>
        </DialogHeader>
        {declaracao && (
          <Tabs defaultValue="bens">
            <TabsList>
              <TabsTrigger value="bens">Bens e Direitos</TabsTrigger>
              <TabsTrigger value="dividas">Dívidas e Ônus</TabsTrigger>
              <TabsTrigger value="comparativo">Comparativo Anual</TabsTrigger>
            </TabsList>
            <TabsContent value="bens" className="mt-4">
              {!bens?.length ? (
                <p className="text-muted-foreground text-center py-6">Nenhum bem ou direito declarado</p>
              ) : (
                <div className="space-y-4">
                  {bens.map((bem) => (
                    <Card key={bem.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{bem.numero_bem}</span>
                            {getGrupoBadge(bem.grupo_codigo)}
                            {bem.cripto_codigo && <Badge className="bg-orange-500">{bem.cripto_codigo}</Badge>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Valor Atual</p>
                            <p className="font-bold text-green-600">{formatCurrency(bem.valor_ano_atual)}</p>
                          </div>
                        </div>
                        <p className="text-sm mb-2"><strong>{bem.codigo_descricao || bem.grupo_descricao}</strong></p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{bem.discriminacao}</p>
                        {bem.participacao_razao_social && (
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4" />
                            {bem.participacao_razao_social}
                            <span className="text-muted-foreground">({bem.participacao_cnpj})</span>
                          </div>
                        )}
                        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                          <span>Ano Anterior: {formatCurrency(bem.valor_ano_anterior)}</span>
                          <span>Variação: {formatCurrency(bem.valor_ano_atual - bem.valor_ano_anterior)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="dividas" className="mt-4">
              {!dividas?.length ? (
                <p className="text-muted-foreground text-center py-6">Nenhuma dívida ou ônus declarado</p>
              ) : (
                <div className="space-y-4">
                  {dividas.map((divida) => (
                    <Card key={divida.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{divida.numero_divida}</span>
                            <Badge variant="outline">{divida.codigo_descricao || divida.codigo}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Saldo Atual</p>
                            <p className="font-bold text-red-600">{formatCurrency(divida.situacao_ano_atual)}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{divida.discriminacao}</p>
                        {divida.credor_nome && (
                          <p className="mt-2 text-sm">Credor: <strong>{divida.credor_nome}</strong></p>
                        )}
                        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                          <span>Ano Anterior: {formatCurrency(divida.situacao_ano_anterior)}</span>
                          <span>Variação: {formatCurrency(divida.situacao_ano_atual - divida.situacao_ano_anterior)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="comparativo" className="mt-4">
              <ComparativoAnual cpf={declaracao.cpf} empresaSelecionada={empresaSelecionada} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
