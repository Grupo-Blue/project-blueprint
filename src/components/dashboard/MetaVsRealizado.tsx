import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MetaVsRealizadoProps {
  tipoNegocio: string;
}

export const MetaVsRealizado = ({ tipoNegocio }: MetaVsRealizadoProps) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { empresaSelecionada } = useEmpresa();

  useEffect(() => {
    fetchData();
  }, [empresaSelecionada, tipoNegocio]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const anoAtual = new Date().getFullYear();

      // Buscar metas do ano
      let queryMetas = supabase
        .from("meta_comercial")
        .select("*")
        .eq("ano", anoAtual)
        .eq("tipo_negocio", tipoNegocio);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        queryMetas = queryMetas.eq("id_empresa", empresaSelecionada);
      }

      const { data: metas } = await queryMetas;

      // Buscar métricas realizadas do ano
      const inicioAno = `${anoAtual}-01-01`;
      const fimAno = `${anoAtual}-12-31`;

      let queryMetricas = supabase
        .from("empresa_metricas_dia")
        .select("data, valor_vendas, vendas")
        .eq("tipo_negocio", tipoNegocio)
        .gte("data", inicioAno)
        .lte("data", fimAno);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        queryMetricas = queryMetricas.eq("id_empresa", empresaSelecionada);
      }

      const { data: metricas } = await queryMetricas;

      // Agregar por mês
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const chartData = meses.map((mes, i) => {
        const mesNum = i + 1;
        const metaMes = (metas || []).filter(m => m.mes === mesNum);
        const metaReceita = metaMes.reduce((s, m) => s + (Number(m.meta_receita) || 0), 0);

        const metricasMes = (metricas || []).filter(m => {
          const d = new Date(m.data);
          return d.getMonth() === i;
        });
        const realizado = metricasMes.reduce((s, m) => s + (Number(m.valor_vendas) || 0), 0);

        return { mes, meta: metaReceita, realizado };
      });

      setData(chartData);
    } catch (err) {
      console.error("Erro ao buscar meta vs realizado:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Meta vs Realizado — Receita</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              />
              <Legend />
              <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[2, 2, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
