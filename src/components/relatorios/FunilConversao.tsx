import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown } from "lucide-react";

interface FunilConversaoProps {
  leads: number;
  mqls: number;
  levantadas: number;
  reunioes: number;
  vendas: number;
}

export function FunilConversao({
  leads,
  mqls,
  levantadas,
  reunioes,
  vendas,
}: FunilConversaoProps) {
  const calcularTaxa = (atual: number, anterior: number): string => {
    if (anterior === 0) return "0%";
    return `${((atual / anterior) * 100).toFixed(1)}%`;
  };

  const etapas = [
    { label: "Leads", valor: leads, cor: "bg-blue-500" },
    { label: "MQLs", valor: mqls, cor: "bg-cyan-500", taxa: calcularTaxa(mqls, leads) },
    { label: "Levantadas", valor: levantadas, cor: "bg-teal-500", taxa: calcularTaxa(levantadas, mqls) },
    { label: "Reuniões", valor: reunioes, cor: "bg-green-500", taxa: calcularTaxa(reunioes, levantadas) },
    { label: "Vendas", valor: vendas, cor: "bg-emerald-600", taxa: calcularTaxa(vendas, reunioes) },
  ];

  const maxValor = Math.max(leads, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {etapas.map((etapa, index) => {
          const larguraPercent = Math.max((etapa.valor / maxValor) * 100, 10);

          return (
            <div key={etapa.label}>
              {index > 0 && (
                <div className="flex items-center justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">
                    {etapa.taxa}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium text-right">
                  {etapa.label}
                </div>
                <div className="flex-1 relative">
                  <div
                    className={`h-8 ${etapa.cor} rounded-md transition-all duration-300 flex items-center justify-end pr-3`}
                    style={{ width: `${larguraPercent}%` }}
                  >
                    <span className="text-white font-bold text-sm">
                      {etapa.valor.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Taxa geral Lead → Venda */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Taxa Lead → Venda</span>
            <span className="font-bold text-lg">
              {calcularTaxa(vendas, leads)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
