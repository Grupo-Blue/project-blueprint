import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
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
  TrendingUp,
  Users,
  Menu,
  Calendar,
  ChevronDown,
  ClipboardList,
  Receipt
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import sgtLogo from "@/assets/sgt-logo.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataStatusIndicator } from "@/components/DataStatusIndicator";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Contextos globais
  const { 
    empresaSelecionada, 
    setEmpresaSelecionada, 
    empresasPermitidas, 
    isAdmin,
    nomeEmpresaSelecionada 
  } = useEmpresa();
  
  const { 
    tipoFiltro, 
    setTipoFiltro, 
    dataEspecifica, 
    setDataEspecifica,
    labelPeriodo 
  } = usePeriodo();

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

  const handleTipoFiltroChange = (value: string) => {
    setTipoFiltro(value as any);
    if (value !== "data_especifica") {
      setDataEspecifica(null);
    }
  };

  const isAdminUser = profile?.perfil === "ADMIN";
  const isDirecao = profile?.perfil === "DIRECAO" || isAdminUser;
  const isTrafego = profile?.perfil === "TRAFEGO" || isAdminUser;
  const showBackButton = location.pathname !== "/dashboard" && !isMobile;

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

  const NavLinks = () => (
    <>
      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/dashboard" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </Link>
      {isDirecao && (
        <Link to="/dashboard-direcao" onClick={() => setMobileMenuOpen(false)}>
          <Button 
            variant={location.pathname === "/dashboard-direcao" ? "secondary" : "ghost"} 
            size="sm"
            className="w-full justify-start hover:bg-accent transition-all"
          >
            <Eye className="mr-2 h-4 w-4" />
            Dash Direção
          </Button>
        </Link>
      )}
      <Link to="/dashboard-comercial" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/dashboard-comercial" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Dash Comercial
        </Button>
      </Link>
      <Link to="/metas-comerciais" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/metas-comerciais" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Target className="mr-2 h-4 w-4" />
          Metas Comerciais
        </Button>
      </Link>
      <Link to="/dashboard-trafego" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/dashboard-trafego" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Activity className="mr-2 h-4 w-4" />
          Dash Tráfego
        </Button>
      </Link>
      {(isTrafego || isDirecao) && (
        <Link to="/acoes" onClick={() => setMobileMenuOpen(false)}>
          <Button 
            variant={location.pathname === "/acoes" ? "secondary" : "ghost"} 
            size="sm"
            className="w-full justify-start hover:bg-accent transition-all"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            Tarefas Tráfego
          </Button>
        </Link>
      )}
      <Link to="/leads" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/leads" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Users className="mr-2 h-4 w-4" />
          Leads
        </Button>
      </Link>
      <Link to="/relatorios" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/relatorios" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <FileText className="mr-2 h-4 w-4" />
          Relatórios
        </Button>
      </Link>
      <Link to="/relatorio-criativos" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/relatorio-criativos" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Image className="mr-2 h-4 w-4" />
          Performance Criativos
        </Button>
      </Link>
      <Link to="/analise-landing-pages" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/analise-landing-pages" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Análise LPs
        </Button>
      </Link>
      <Link to="/guia-utm" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/guia-utm" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Guia UTM
        </Button>
      </Link>
      <Link to="/hipoteses" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/hipoteses" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Target className="mr-2 h-4 w-4" />
          Hipóteses
        </Button>
      </Link>
      <Link to="/aprendizados" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/aprendizados" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Lightbulb className="mr-2 h-4 w-4" />
          Aprendizados
        </Button>
      </Link>
      <Link to="/alertas" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/alertas" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Alertas
        </Button>
      </Link>
      <Link to="/analise-competitiva" onClick={() => setMobileMenuOpen(false)}>
        <Button 
          variant={location.pathname === "/analise-competitiva" ? "secondary" : "ghost"} 
          size="sm"
          className="w-full justify-start hover:bg-accent transition-all"
        >
          <Eye className="mr-2 h-4 w-4" />
          Análise de Concorrentes
        </Button>
      </Link>
      {isDirecao && (
        <Link to="/irpf-importacoes" onClick={() => setMobileMenuOpen(false)}>
          <Button 
            variant={location.pathname === "/irpf-importacoes" ? "secondary" : "ghost"} 
            size="sm"
            className="w-full justify-start hover:bg-accent transition-all"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Imposto de Renda
          </Button>
        </Link>
      )}
      {isTrafego && (
        <>
          <Link to="/contas-anuncio" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/contas-anuncio" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Contas Anúncio
            </Button>
          </Link>
          <Link to="/campanhas-cadastro" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/campanhas-cadastro" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Cadastro Campanhas
            </Button>
          </Link>
        </>
      )}
      {isAdminUser && (
        <>
          <Link to="/empresas" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/empresas" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Empresas
            </Button>
          </Link>
          <Link to="/usuarios" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/usuarios" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <Shield className="mr-2 h-4 w-4" />
              Usuários
            </Button>
          </Link>
          <Link to="/integracoes" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/integracoes" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Integrações
            </Button>
          </Link>
          <Link to="/calculo-metricas" onClick={() => setMobileMenuOpen(false)}>
            <Button 
              variant={location.pathname === "/calculo-metricas" ? "secondary" : "ghost"} 
              size="sm"
              className="w-full justify-start hover:bg-accent transition-all"
            >
              <Calculator className="mr-2 h-4 w-4" />
              Métricas
            </Button>
          </Link>
        </>
      )}
    </>
  );

  // Componente dos filtros globais
  const GlobalFilters = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      {/* Seletor de Empresa */}
      <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
        <SelectTrigger className="w-full sm:w-[180px] h-9">
          <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          {(isAdmin || empresasPermitidas.length > 1) && (
            <SelectItem value="todas">Todas as empresas</SelectItem>
          )}
          {empresasPermitidas.map((empresa) => (
            <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
              {empresa.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Seletor de Período */}
      <div className="flex gap-2">
        <Select value={tipoFiltro} onValueChange={handleTipoFiltroChange}>
          <SelectTrigger className="w-full sm:w-[150px] h-9">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
            <SelectItem value="data_especifica">Mês Específico</SelectItem>
          </SelectContent>
        </Select>

        {tipoFiltro === "data_especifica" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3">
                {dataEspecifica 
                  ? format(dataEspecifica, "MMM/yy", { locale: ptBR })
                  : "Selecionar"
                }
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <CalendarComponent
                mode="single"
                selected={dataEspecifica || undefined}
                onSelect={(date) => date && setDataEspecifica(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-card via-card to-accent/5 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 md:px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 md:gap-4">
              {showBackButton && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="hover:bg-accent/80 h-8 w-8 p-0 md:h-10 md:w-auto md:px-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              
              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="lg:hidden h-8 w-8 p-0"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-left">Menu</SheetTitle>
                  </SheetHeader>
                  {/* Filtros no menu mobile */}
                  <div className="mt-4 pb-4 border-b">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">FILTROS GLOBAIS</p>
                    <GlobalFilters />
                  </div>
                  <nav className="flex flex-col gap-2 mt-4">
                    <NavLinks />
                  </nav>
                </SheetContent>
              </Sheet>
              
              <Link to="/dashboard" className="flex items-center gap-2 md:gap-3 group">
                <img 
                  src={sgtLogo} 
                  alt="SGT Logo" 
                  className="h-8 w-8 md:h-10 md:w-10 object-contain transition-transform group-hover:scale-105"
                />
                <div className="hidden md:block">
                  <h1 className="text-sm md:text-base font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent transition-all group-hover:from-primary/90 group-hover:to-primary/60">
                    SGT
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    {profile?.nome}
                  </p>
                </div>
              </Link>
            </div>

            {/* Filtros globais no header (desktop) */}
            <div className="hidden lg:flex items-center gap-3">
              <GlobalFilters />
              <DataStatusIndicator />
              <div className="h-8 w-px bg-border" />
              <Button 
                variant="outline" 
                onClick={handleLogout}
                size="sm"
                className="hover:bg-destructive hover:text-destructive-foreground transition-colors h-9"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden xl:inline">Sair</span>
              </Button>
            </div>

            {/* Logout mobile */}
            <Button 
              variant="outline" 
              onClick={handleLogout}
              size="sm"
              className="lg:hidden hover:bg-destructive hover:text-destructive-foreground transition-colors h-8 w-8 p-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Desktop navigation */}
          <nav className="hidden lg:flex gap-1.5 flex-wrap pb-2">
            <NavLinks />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8 pb-20 lg:pb-8">
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-inset-bottom">
          <div className="flex justify-around items-center h-14 px-2">
            <Link to="/dashboard" className="flex-1">
              <Button 
                variant={location.pathname === "/dashboard" ? "secondary" : "ghost"} 
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-none"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-[10px]">Dashboard</span>
              </Button>
            </Link>
            <Link to="/leads" className="flex-1">
              <Button 
                variant={location.pathname === "/leads" ? "secondary" : "ghost"} 
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-none"
              >
                <Users className="h-5 w-5" />
                <span className="text-[10px]">Leads</span>
              </Button>
            </Link>
            <Link to="/dashboard-trafego" className="flex-1">
              <Button 
                variant={location.pathname === "/dashboard-trafego" ? "secondary" : "ghost"} 
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-none"
              >
                <Activity className="h-5 w-5" />
                <span className="text-[10px]">Tráfego</span>
              </Button>
            </Link>
            <Link to="/alertas" className="flex-1">
              <Button 
                variant={location.pathname === "/alertas" ? "secondary" : "ghost"} 
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-none"
              >
                <AlertTriangle className="h-5 w-5" />
                <span className="text-[10px]">Alertas</span>
              </Button>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
};
