import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";

interface Props {
  cpf: string;
  empresaSelecionada: string;
}

interface Declaracao {
  id: string;
  exercicio: number;
  ano_calendario: number;
}

interface Evolucao {
  id_declaracao: string;
  bens_ano_atual: number | null;
  dividas_ano_atual: number | null;
  patrimonio_liquido_atual: number | null;
}

export function ComparativoAnual({ cpf, empresaSelecionada }: Props) {
  const { data: declaracoes } = useQuery({
    queryKey: ['irpf-declaracoes-cpf', cpf, empresaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irpf_declaracao')
        .select('id, exercicio, ano_calendario')
        .eq('cpf', cpf)
        .eq('id_empresa', empresaSelecionada)
        .eq('status_processamento', 'concluido')
        .order('exercicio', { ascending: true });

      if (error) throw error;
      return data as Declaracao[];
    },
    enabled: !!cpf && !!empresaSelecionada,
  });

  const { data: evolucoes } = useQuery({
    queryKey: ['irpf-evolucoes-cpf', declaracoes?.map(d => d.id)],
    queryFn: async () => {
      if (!declaracoes?.length) return [];

      const ids = declaracoes.map(d => d.id);
      const { data, error } = await supabase
        .from('irpf_evolucao_patrimonial')
        .select('id_declaracao, bens_ano_atual, dividas_ano_atual, patrimonio_liquido_atual')
        .in('id_declaracao', ids);

      if (error) throw error;
      return data as Evolucao[];
    },
    enabled: !!declaracoes?.length,
  });

  if (!declaracoes || declaracoes.length < 2) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          É necessário ter pelo menos 2 declarações para comparar evolução
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getVariacaoIcon = (atual: number, anterior: number) => {
    const variacao = atual - anterior;
    if (variacao > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (variacao < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getVariacaoPercentual = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? '+100%' : '0%';
    const percentual = ((atual - anterior) / Math.abs(anterior)) * 100;
    return `${percentual >= 0 ? '+' : ''}${percentual.toFixed(1)}%`;
  };

  // Mapear evolução por declaração
  const evolucaoMap = new Map<string, Evolucao>();
  evolucoes?.forEach(e => evolucaoMap.set(e.id_declaracao, e));

  // Preparar dados para tabela
  const dadosComparativos = declaracoes.map((dec, index) => {
    const evolucao = evolucaoMap.get(dec.id);
    const anterior = index > 0 ? evolucaoMap.get(declaracoes[index - 1].id) : null;

    return {
      exercicio: dec.exercicio,
      bens: evolucao?.bens_ano_atual || 0,
      dividas: evolucao?.dividas_ano_atual || 0,
      patrimonio: evolucao?.patrimonio_liquido_atual || 0,
      bensAnterior: anterior?.bens_ano_atual || 0,
      dividasAnterior: anterior?.dividas_ano_atual || 0,
      patrimonioAnterior: anterior?.patrimonio_liquido_atual || 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Comparativo Ano a Ano
          <Badge variant="outline">{declaracoes.length} declarações</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exercício</TableHead>
              <TableHead className="text-right">Bens e Direitos</TableHead>
              <TableHead className="text-right">Dívidas</TableHead>
              <TableHead className="text-right">Patrimônio Líquido</TableHead>
              <TableHead className="text-center">Variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dadosComparativos.map((dado, index) => (
              <TableRow key={dado.exercicio}>
                <TableCell>
                  <Badge variant="outline">{dado.exercicio}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {formatCurrency(dado.bens)}
                    {index > 0 && getVariacaoIcon(dado.bens, dado.bensAnterior)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {formatCurrency(dado.dividas)}
                    {index > 0 && getVariacaoIcon(dado.dividas, dado.dividasAnterior)}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {formatCurrency(dado.patrimonio)}
                    {index > 0 && getVariacaoIcon(dado.patrimonio, dado.patrimonioAnterior)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {index > 0 ? (
                    <Badge 
                      variant={dado.patrimonio >= dado.patrimonioAnterior ? "default" : "destructive"}
                      className={dado.patrimonio >= dado.patrimonioAnterior ? "bg-green-500" : ""}
                    >
                      {getVariacaoPercentual(dado.patrimonio, dado.patrimonioAnterior)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Base</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Resumo de evolução */}
        {dadosComparativos.length >= 2 && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Primeiro exercício</p>
                <p className="font-medium">{formatCurrency(dadosComparativos[0].patrimonio)}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Último exercício</p>
                <p className="font-medium">
                  {formatCurrency(dadosComparativos[dadosComparativos.length - 1].patrimonio)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Evolução total</p>
              <Badge 
                variant="outline"
                className={
                  dadosComparativos[dadosComparativos.length - 1].patrimonio >= dadosComparativos[0].patrimonio
                    ? "text-green-600 border-green-600"
                    : "text-red-600 border-red-600"
                }
              >
                {getVariacaoPercentual(
                  dadosComparativos[dadosComparativos.length - 1].patrimonio,
                  dadosComparativos[0].patrimonio
                )}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
