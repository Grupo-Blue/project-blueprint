import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCard } from "@/components/AlertCard";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface EmpresaMetrica {
  empresa: string;
  id_empresa: string;
  verba: number;
  leads: number;
  cpl: number;
  cpl_maximo: number;
  cac: number;
  cac_maximo: number;
  vendas: number;
}

const Alertas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Buscar semana atual
  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-atual"],
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

  // Buscar empresas
  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("*");

      if (error) throw error;
      return data;
    },
  });

  // Buscar métricas semanais
  const { data: metricas, isLoading, refetch } = useQuery({
    queryKey: ["metricas-alertas", semanaAtual?.id_semana],
    queryFn: async () => {
      if (!semanaAtual) return [];

      const { data, error } = await supabase
        .from("empresa_semana_metricas")
        .select(`
          *,
          empresa:id_empresa (
            nome,
            cpl_maximo,
            cac_maximo
          )
        `)
        .eq("id_semana", semanaAtual.id_semana);

      if (error) throw error;
      return data;
    },
    enabled: !!semanaAtual,
  });

  // Processar alertas
  const alertas: EmpresaMetrica[] = metricas
    ?.filter((m: any) => {
      const cplAcima = m.cpl && m.empresa?.cpl_maximo && m.cpl > m.empresa.cpl_maximo;
      const cacAcima = m.cac && m.empresa?.cac_maximo && m.cac > m.empresa.cac_maximo;
      return cplAcima || cacAcima;
    })
    .map((m: any) => ({
      empresa: m.empresa?.nome || "N/A",
      id_empresa: m.id_empresa,
      verba: m.verba_investida || 0,
      leads: m.leads_total || 0,
      cpl: m.cpl || 0,
      cpl_maximo: m.empresa?.cpl_maximo || 0,
      cac: m.cac || 0,
      cac_maximo: m.empresa?.cac_maximo || 0,
      vendas: m.vendas || 0,
    })) || [];

  const alertasCPL = alertas.filter((a) => a.cpl > a.cpl_maximo);
  const alertasCAC = alertas.filter((a) => a.cac > a.cac_maximo);

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Alertas atualizados",
      description: "Os dados foram recarregados com sucesso",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando alertas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Alertas Automáticos</h1>
                <p className="text-sm text-muted-foreground">
                  CPL e CAC acima das metas • Semana {semanaAtual?.numero_semana}/{semanaAtual?.ano}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Resumo de Alertas */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertas.length}</div>
              <p className="text-xs text-muted-foreground">
                {alertas.length === 0 ? "Nenhum alerta ativo" : "Empresas com alertas ativos"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas CPL</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertasCPL.length}</div>
              <p className="text-xs text-muted-foreground">
                Custo por Lead acima da meta
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas CAC</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertasCAC.length}</div>
              <p className="text-xs text-muted-foreground">
                Custo de Aquisição acima da meta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Alertas */}
        {alertas.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum Alerta Ativo</CardTitle>
              <CardDescription>
                Todas as empresas estão dentro das metas de CPL e CAC para a semana atual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Continue monitorando as métricas semanalmente.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-4">Alertas CPL (Custo Por Lead)</h2>
              {alertasCPL.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-6">Nenhum alerta de CPL ativo.</p>
              ) : (
                <div className="grid gap-4 mb-8">
                  {alertasCPL.map((alerta) => (
                    <AlertCard
                      key={`cpl-${alerta.id_empresa}`}
                      empresa={alerta.empresa}
                      tipo="CPL"
                      valorAtual={alerta.cpl}
                      valorMaximo={alerta.cpl_maximo}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Alertas CAC (Custo de Aquisição)</h2>
              {alertasCAC.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta de CAC ativo.</p>
              ) : (
                <div className="grid gap-4">
                  {alertasCAC.map((alerta) => (
                    <AlertCard
                      key={`cac-${alerta.id_empresa}`}
                      empresa={alerta.empresa}
                      tipo="CAC"
                      valorAtual={alerta.cac}
                      valorMaximo={alerta.cac_maximo}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Alertas;
