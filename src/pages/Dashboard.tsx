import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, TrendingUp, Users, DollarSign, ListChecks, CheckSquare, FileText, BookOpen, Target } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
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
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você saiu do sistema com sucesso",
    });
  };

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

  const getPerfilLabel = (perfil: string) => {
    const labels: Record<string, string> = {
      TRAFEGO: "Tráfego",
      SDR_COMERCIAL: "SDR / Comercial",
      DIRECAO: "Direção",
      ADMIN: "Administrador",
    };
    return labels[perfil] || perfil;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
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
            <Link to="/acoes">
              <Button variant="ghost" size="sm">
                <ListChecks className="mr-2 h-4 w-4" />
                Ações A/B/C
              </Button>
            </Link>
            {(profile?.perfil === "DIRECAO" || profile?.perfil === "ADMIN") && (
              <Link to="/aprovacoes">
                <Button variant="ghost" size="sm">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Aprovações
                </Button>
              </Link>
            )}
            <Link to="/campanhas">
              <Button variant="ghost" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Campanhas
              </Button>
            </Link>
            <Link to="/relatorios">
              <Button variant="ghost" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Bem-vindo ao SGT!</h2>
          <p className="text-muted-foreground">
            Sistema de Governança de Tráfego para Blue e Tokeniza
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Nenhuma campanha cadastrada</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads do Mês</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Aguardando integração</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 0,00</div>
              <p className="text-xs text-muted-foreground">Sem dados disponíveis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">Sem dados disponíveis</p>
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
              <CardTitle>Acesso Rápido</CardTitle>
              <CardDescription>Navegue pelos módulos do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/acoes" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ListChecks className="mr-2 h-4 w-4" />
                  Gerenciar Ações A/B/C
                </Button>
              </Link>
              {(profile?.perfil === "DIRECAO" || profile?.perfil === "ADMIN") && (
                <Link to="/aprovacoes" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Aprovar Ações Categoria C
                  </Button>
                </Link>
              )}
              <Link to="/campanhas" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Target className="mr-2 h-4 w-4" />
                  Ver Campanhas
                </Button>
              </Link>
              <Link to="/relatorios" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Relatórios Semanais
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
