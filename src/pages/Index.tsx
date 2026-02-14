import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Users, TrendingUp, Zap, Shield, LineChart } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import sgtLogo from "@/assets/sgt-logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    { icon: BarChart3, title: "Dashboards Inteligentes", desc: "Métricas em tempo real com visualizações líquidas", glow: "cyan" as const },
    { icon: Users, title: "Governança A/B/C", desc: "Controle total sobre ações de tráfego e aprovações", glow: "amber" as const },
    { icon: TrendingUp, title: "Relatórios Semanais", desc: "Análises detalhadas e comparações automáticas", glow: "mint" as const },
  ];

  const checks = [
    "Integrações com Meta Ads, Google Ads, Pipedrive e Tokeniza",
    "Gestão de campanhas, leads e funil de conversão",
    "Aprovação de ações Categoria C pela direção",
    "Relatórios semanais automatizados com comparações",
    "Gestão de hipóteses de teste e aprendizados",
    "Alertas automáticos para CPL e CAC fora das metas",
  ];

  return (
    <div className="min-h-screen liquid-bg flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-14 animate-fade-up relative z-10">
        <img src={sgtLogo} alt="SGT" className="h-16 w-16 mx-auto mb-4 drop-shadow-lg" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-2">
          SGT
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-1">Sistema de Governança de Tráfego</p>
        <p className="text-sm text-muted-foreground/70">Blue & Tokeniza</p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl w-full mb-10 relative z-10">
        {features.map((f, i) => (
          <GlassCard key={f.title} glow={f.glow} className="animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
            <f.icon className={`h-10 w-10 mb-4 ${f.glow === "cyan" ? "text-liquid-cyan" : f.glow === "amber" ? "text-liquid-amber" : "text-liquid-mint"}`} />
            <h3 className="text-base font-bold mb-1 text-foreground">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </GlassCard>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mb-10 relative z-10 animate-fade-up" style={{ animationDelay: "300ms" }}>
        <Button size="lg" onClick={() => navigate("/auth")} className="group rounded-2xl px-8 h-12 text-base font-semibold shadow-lg">
          Acessar Sistema
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Faça login para começar a gerenciar suas campanhas
        </p>
      </div>

      {/* Checklist */}
      <GlassCard className="max-w-2xl w-full animate-fade-up relative z-10" style={{ animationDelay: "400ms" }}>
        <h2 className="text-sm font-bold mb-3 text-foreground">Funcionalidades</h2>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c} className="flex items-start text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-liquid-cyan mr-2 mt-0.5 flex-shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
};

export default Index;
