import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Users, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in and redirect to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            SGT
          </h1>
          <p className="text-2xl text-muted-foreground mb-2">Sistema de Governança de Tráfego</p>
          <p className="text-lg text-muted-foreground">Blue & Tokeniza</p>
        </div>

        <div className="max-w-4xl mx-auto mb-12">
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <BarChart3 className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Dashboards Inteligentes</h3>
              <p className="text-sm text-muted-foreground">
                Visualize métricas de desempenho em tempo real
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <Users className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Governança A/B/C</h3>
              <p className="text-sm text-muted-foreground">
                Controle total sobre ações de tráfego e aprovações
              </p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <TrendingUp className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Relatórios Semanais</h3>
              <p className="text-sm text-muted-foreground">
                Análises detalhadas e comparações automáticas
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="group">
              Acessar Sistema
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Faça login para começar a gerenciar suas campanhas
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto bg-card/50 p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-3">Funcionalidades</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Integrações com Meta Ads, Google Ads, Pipedrive e Sistema Tokeniza</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Gestão de campanhas, leads e funil de conversão</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Sistema de aprovação de ações Categoria C pela direção</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Relatórios semanais automatizados com comparações</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Gestão de hipóteses de teste e aprendizados</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">✓</span>
              <span>Alertas automáticos para CPL e CAC fora das metas</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Index;
