import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ReceitaAcumuladaProps {
  tipoNegocio: string;
}

export const ReceitaAcumulada = ({ tipoNegocio }: ReceitaAcumuladaProps) => {
  const [data, setData] = useState<any[]>([]);
  const [metaMensal, setMetaMensal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim } = usePeriodo();

  const { inicio, fim } = getInicioFim();
  const dataInicio = inicio.toISOString().split("T")[0];
  const dataFim = fim.toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, [empresaSelecionada, dataInicio, dataFim, tipoNegocio]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("empresa_metricas_dia")
        .select("data, valor_vendas")
        .eq("tipo_negocio", tipoNegocio)
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data: metricas } = await query;

      // Agregar por dia e acumular
      const porDia: Record<string, number> = {};
      (metricas || []).forEach(m => {
        const dia = m.data;
        porDia[dia] = (porDia[dia] || 0) + (Number(m.valor_vendas) || 0);
      });

      let acumulado = 0;
      const chartData = Object.keys(porDia).sort().map(dia => {
        acumulado += porDia[dia];
        return { dia: new Date(dia).getDate().toString(), receita: acumulado };
      });

      setData(chartData);

      // Buscar meta do mês
      const mesAtual = new Date(dataInicio).getMonth() + 1;
      const anoAtual = new Date(dataInicio).getFullYear();

      let queryMeta = supabase
        .from("meta_comercial")
        .select("meta_receita")
        .eq("ano", anoAtual)
        .eq("mes", mesAtual)
        .eq("tipo_negocio", tipoNegocio);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        queryMeta = queryMeta.eq("id_empresa", empresaSelecionada);
      }

      const { data: metaData } = await queryMeta;
      const meta = (metaData || []).reduce((s, m) => s + (Number(m.meta_receita) || 0), 0);
      setMetaMensal(meta);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Receita Acumulada no Período</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
              <Line type="monotone" dataKey="receita" name="Receita Acumulada" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              {metaMensal > 0 && (
                <ReferenceLine y={metaMensal} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: "Meta", position: "right", fontSize: 11 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
