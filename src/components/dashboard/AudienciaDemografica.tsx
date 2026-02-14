import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
];

export function AudienciaDemografica() {
  const { empresaSelecionada } = useEmpresa();

  const { data: demographics, isLoading } = useQuery({
    queryKey: ["social-demographics", empresaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_audiencia_demografica")
        .select("*")
        .eq("id_empresa", empresaSelecionada!)
        .order("data_coleta", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  if (!empresaSelecionada) return null;

  // Agrupar por tipo (pegar os mais recentes de cada)
  const latestByType: Record<string, any[]> = {};
  for (const item of (demographics || [])) {
    const key = `${item.tipo}_${item.rede_social}`;
    if (!latestByType[key]) latestByType[key] = [];
    latestByType[key].push(item);
  }

  // Extrair dados por tipo
  const genderData = (demographics || [])
    .filter(d => d.tipo === 'GENDER')
    .reduce((acc, d) => {
      const existing = acc.find((a: any) => a.name === d.label);
      if (existing) {
        existing.value += Number(d.valor || 0);
      } else {
        acc.push({ name: d.label, value: Number(d.valor || 0), percentual: Number(d.percentual || 0) });
      }
      return acc;
    }, [] as any[]);

  const ageData = (demographics || [])
    .filter(d => d.tipo === 'AGE')
    .reduce((acc, d) => {
      const existing = acc.find((a: any) => a.name === d.label);
      if (existing) {
        existing.value += Number(d.valor || 0);
      } else {
        acc.push({ name: d.label, value: Number(d.valor || 0) });
      }
      return acc;
    }, [] as any[])
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  const countryData = (demographics || [])
    .filter(d => d.tipo === 'COUNTRY')
    .reduce((acc, d) => {
      const existing = acc.find((a: any) => a.name === d.label);
      if (existing) {
        existing.value += Number(d.valor || 0);
      } else {
        acc.push({ name: d.label, value: Number(d.valor || 0) });
      }
      return acc;
    }, [] as any[])
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 10);

  const hasData = genderData.length > 0 || ageData.length > 0 || countryData.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Audiência Demográfica
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado demográfico coletado ainda. Execute a coleta de conteúdo Metricool.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gênero - Pie Chart */}
            {genderData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Gênero</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {genderData.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Idade - Bar Chart */}
            {ageData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Faixa Etária</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ageData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Países - Bar Chart horizontal */}
            {countryData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">Top Países</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={countryData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
