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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <Link to="/dashboard">
                  <h1 className="text-2xl font-bold hover:text-primary transition-colors cursor-pointer">
                    SGT - Sistema de Governança de Tráfego
                  </h1>
                </Link>
                <p className="text-sm text-muted-foreground">
                  {profile?.nome} • {profile && getPerfilLabel(profile.perfil)}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
          
          <nav className="flex gap-2 flex-wrap">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            {isDirecao && (
              <Link to="/dashboard-direcao">
                <Button variant="ghost" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  Dash Direção
                </Button>
              </Link>
            )}
            <Link to="/dashboard-trafego">
              <Button variant="ghost" size="sm">
                <Activity className="mr-2 h-4 w-4" />
                Dash Tráfego
              </Button>
            </Link>
            <Link to="/acoes">
              <Button variant="ghost" size="sm">
                <ListChecks className="mr-2 h-4 w-4" />
                Ações A/B/C
              </Button>
            </Link>
            {isDirecao && (
              <Link to="/aprovacoes">
                <Button variant="ghost" size="sm">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Aprovações
                </Button>
              </Link>
            )}
            <Link to="/campanhas">
              <Button variant="ghost" size="sm">
                <TrendingUp className="mr-2 h-4 w-4" />
                Campanhas
              </Button>
            </Link>
            <Link to="/criativos">
              <Button variant="ghost" size="sm">
                <Image className="mr-2 h-4 w-4" />
                Criativos
              </Button>
            </Link>
            <Link to="/relatorios">
              <Button variant="ghost" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
            <Link to="/hipoteses">
              <Button variant="ghost" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Hipóteses
              </Button>
            </Link>
            <Link to="/aprendizados">
              <Button variant="ghost" size="sm">
                <Lightbulb className="mr-2 h-4 w-4" />
                Aprendizados
              </Button>
            </Link>
            <Link to="/alertas">
              <Button variant="ghost" size="sm">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Alertas
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link to="/empresas">
                  <Button variant="ghost" size="sm">
                    <Building2 className="mr-2 h-4 w-4" />
                    Empresas
                  </Button>
                </Link>
                <Link to="/usuarios">
                  <Button variant="ghost" size="sm">
                    <Shield className="mr-2 h-4 w-4" />
                    Usuários
                  </Button>
                </Link>
                <Link to="/integracoes">
                  <Button variant="ghost" size="sm">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Integrações
                  </Button>
                </Link>
                <Link to="/calculo-metricas">
                  <Button variant="ghost" size="sm">
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
