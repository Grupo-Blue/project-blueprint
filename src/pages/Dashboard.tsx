import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, TrendingUp, Target, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const mesAtual = new Date();
  const inicioMes = startOfMonth(mesAtual);
  const fimMes = endOfMonth(mesAtual);

  // Buscar campanhas ativas
  const { data: campanhas } = useQuery({
    queryKey: ["campanhas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha")
        .select("id_campanha")
        .eq("ativa", true);
      if (error) throw error;
      return data;
    },
  });

  // Buscar leads do mês atual
  const { data: leadsDoMes } = useQuery({
    queryKey: ["leads-mes-atual", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select("id_lead, venda_realizada, valor_venda")
        .gte("data_criacao", inicioMes.toISOString())
        .lte("data_criacao", fimMes.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Buscar métricas semanais mais recentes para calcular CPL médio
  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-atual-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: metricasSemanais } = useQuery({
    queryKey: ["metricas-dashboard", semanaAtual?.id_semana],
    queryFn: async () => {
      if (!semanaAtual) return null;
      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select("*")
        .eq("id_semana", semanaAtual.id_semana);
      if (error) throw error;
      return data;
    },
    enabled: !!semanaAtual,
  });

  // Calcular estatísticas
  const totalCampanhas = campanhas?.length || 0;
  const totalLeads = leadsDoMes?.length || 0;
  const totalVendas = leadsDoMes?.filter((l) => l.venda_realizada).length || 0;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;

  const totaisMetricas = metricasSemanais?.reduce(
    (acc, m) => ({
      verba: acc.verba + m.verba_investida,
      leads: acc.leads + m.leads_total,
    }),
    { verba: 0, leads: 0 }
  ) || { verba: 0, leads: 0 };

  const cplMedio = totaisMetricas.leads > 0 ? totaisMetricas.verba / totaisMetricas.leads : 0;

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Bem-vindo ao SGT!</h2>
        <p className="text-muted-foreground">
          Sistema de Governança de Tráfego Pago
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <Calendar className="inline h-3 w-3 mr-1" />
          {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampanhas}</div>
            <p className="text-xs text-muted-foreground">
              {totalCampanhas === 0 ? "Nenhuma campanha cadastrada" : "Em execução"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads do Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalLeads === 0 ? "Nenhum lead este mês" : `${format(inicioMes, "dd/MMM", { locale: ptBR })} - ${format(fimMes, "dd/MMM", { locale: ptBR })}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cplMedio > 0 
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(cplMedio)
                : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricasSemanais && metricasSemanais.length > 0 
                ? `Semana ${semanaAtual?.numero_semana}/${semanaAtual?.ano}` 
                : "Sem métricas semanais"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão do Mês</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaConversao.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {totalVendas} vendas de {totalLeads} leads
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
            <CardDescription>Backend configurado e pronto para uso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">✅ Banco de dados criado</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">✅ Autenticação configurada</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">✅ Empresas cadastradas</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">✅ Governança A/B/C ativa</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
            <CardDescription>Configure o sistema para começar a usar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">Configure as integrações com Meta e Google Ads</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">Configure a integração com Pipedrive</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">Configure a integração com Tokeniza</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">Cadastre suas campanhas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
export default Dashboard;