import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  BarChart3, 
  ListChecks, 
  CheckSquare, 
  FileText, 
  BookOpen, 
  Target, 
  Lightbulb, 
  Eye, 
  Activity, 
  Building2, 
  Calculator, 
  AlertTriangle, 
  Image, 
  Shield, 
  Link as LinkIcon,
  ArrowLeft,
  TrendingUp
} from "lucide-react";
import sgtLogo from "@/assets/sgt-logo.png";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      // Verificar se o usuário foi aprovado
      if (profileData && !profileData.aprovado) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso pendente",
          description: "Seu cadastro ainda não foi aprovado pelo administrador",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setProfile(profileData);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você saiu do sistema com sucesso",
    });
  };

  const getPerfilLabel = (perfil: string) => {
    const labels: Record<string, string> = {
      TRAFEGO: "Tráfego",
      SDR_COMERCIAL: "SDR / Comercial",
      DIRECAO: "Direção",
      ADMIN: "Administrador",
    };
    return labels[perfil] || perfil;
  };

  const isAdmin = profile?.perfil === "ADMIN";
  const isDirecao = profile?.perfil === "DIRECAO" || isAdmin;
  const showBackButton = location.pathname !== "/dashboard";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-card via-card to-accent/5 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-6">
              {showBackButton && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="hover:bg-accent/80"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Link to="/dashboard" className="flex items-center gap-3 group">
                <img 
                  src={sgtLogo} 
                  alt="SGT Logo" 
                  className="h-12 w-12 object-contain transition-transform group-hover:scale-105"
                />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent transition-all group-hover:from-primary/90 group-hover:to-primary/60">
                    SGT - Sistema de Governança de Tráfego
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    {profile?.nome} • {profile && getPerfilLabel(profile.perfil)}
                  </p>
                </div>
              </Link>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
          
          <nav className="flex gap-1.5 flex-wrap pb-2">
            <Link to="/dashboard">
              <Button 
                variant={location.pathname === "/dashboard" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            {isDirecao && (
              <Link to="/dashboard-direcao">
                <Button 
                  variant={location.pathname === "/dashboard-direcao" ? "secondary" : "ghost"} 
                  size="sm"
                  className="hover:bg-accent transition-all"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Dash Direção
                </Button>
              </Link>
            )}
            <Link to="/dashboard-trafego">
              <Button 
                variant={location.pathname === "/dashboard-trafego" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <Activity className="mr-2 h-4 w-4" />
                Dash Tráfego
              </Button>
            </Link>
            <Link to="/acoes">
              <Button 
                variant={location.pathname === "/acoes" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <ListChecks className="mr-2 h-4 w-4" />
                Ações A/B/C
              </Button>
            </Link>
            {isDirecao && (
              <Link to="/aprovacoes">
                <Button 
                  variant={location.pathname === "/aprovacoes" ? "secondary" : "ghost"} 
                  size="sm"
                  className="hover:bg-accent transition-all"
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Aprovações
                </Button>
              </Link>
            )}
            <Link to="/campanhas">
              <Button 
                variant={location.pathname === "/campanhas" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Campanhas
              </Button>
            </Link>
            <Link to="/criativos">
              <Button 
                variant={location.pathname === "/criativos" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <Image className="mr-2 h-4 w-4" />
                Criativos
              </Button>
            </Link>
            <Link to="/relatorios">
              <Button 
                variant={location.pathname === "/relatorios" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <FileText className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
            <Link to="/hipoteses">
              <Button 
                variant={location.pathname === "/hipoteses" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <Target className="mr-2 h-4 w-4" />
                Hipóteses
              </Button>
            </Link>
            <Link to="/aprendizados">
              <Button 
                variant={location.pathname === "/aprendizados" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Aprendizados
              </Button>
            </Link>
            <Link to="/alertas">
              <Button 
                variant={location.pathname === "/alertas" ? "secondary" : "ghost"} 
                size="sm"
                className="hover:bg-accent transition-all"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Alertas
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link to="/empresas">
                  <Button 
                    variant={location.pathname === "/empresas" ? "secondary" : "ghost"} 
                    size="sm"
                    className="hover:bg-accent transition-all"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Empresas
                  </Button>
                </Link>
                <Link to="/usuarios">
                  <Button 
                    variant={location.pathname === "/usuarios" ? "secondary" : "ghost"} 
                    size="sm"
                    className="hover:bg-accent transition-all"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Usuários
                  </Button>
                </Link>
                <Link to="/integracoes">
                  <Button 
                    variant={location.pathname === "/integracoes" ? "secondary" : "ghost"} 
                    size="sm"
                    className="hover:bg-accent transition-all"
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Integrações
                  </Button>
                </Link>
                <Link to="/calculo-metricas">
                  <Button 
                    variant={location.pathname === "/calculo-metricas" ? "secondary" : "ghost"} 
                    size="sm"
                    className="hover:bg-accent transition-all"
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    Métricas
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
