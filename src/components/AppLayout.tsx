import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Users, Activity, AlertTriangle, Calendar, Building2, ChevronDown
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataStatusIndicator } from "@/components/DataStatusIndicator";
import { ChatIAFlutuante } from "@/components/ChatIAFlutuante";
import { LiquidSidebar } from "@/components/layout/LiquidSidebar";
import { Link } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    empresaSelecionada, setEmpresaSelecionada, empresasPermitidas, isAdmin
  } = useEmpresa();

  const {
    tipoFiltro, setTipoFiltro, dataEspecifica, setDataEspecifica, labelPeriodo
  } = usePeriodo();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/auth"); return; }
        setUser(session.user);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profileData && !profileData.aprovado) {
          await supabase.auth.signOut();
          toast({ title: "Acesso pendente", description: "Seu cadastro ainda não foi aprovado pelo administrador", variant: "destructive" });
          navigate("/auth");
          return;
        }
        setProfile(profileData);
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        toast({ title: "Erro de conexão", description: "Não foi possível carregar seus dados. Tente novamente.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") navigate("/auth");
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logout realizado", description: "Você saiu do sistema com sucesso" });
  };

  const handleTipoFiltroChange = (value: string) => {
    setTipoFiltro(value as any);
    if (value !== "data_especifica") setDataEspecifica(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen liquid-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Detect sidebar width for offset
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 68 : 240);

  return (
    <div className="min-h-screen liquid-bg">
      {/* Sidebar */}
      <LiquidSidebar profile={profile} onLogout={handleLogout} />

      {/* Main content area */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Simplified Header */}
        <header className="sticky top-0 z-30 glass-card rounded-none border-0 border-b border-border/40">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-3">
              {isMobile && <div className="w-10" />} {/* spacer for mobile menu button */}
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Bem-vindo, {profile?.nome?.split(' ')[0] || 'Usuário'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Global Filters */}
            <div className="flex items-center gap-2">
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger className="w-[140px] md:w-[180px] h-9 rounded-xl bg-accent/40 border-0 text-xs">
                  <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
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

              <Select value={tipoFiltro} onValueChange={handleTipoFiltroChange}>
                <SelectTrigger className="w-[120px] md:w-[150px] h-9 rounded-xl bg-accent/40 border-0 text-xs">
                  <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
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
                    <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl bg-accent/40 border-0 text-xs">
                      {dataEspecifica
                        ? format(dataEspecifica, "MMM/yy", { locale: ptBR })
                        : "Selecionar"
                      }
                      <ChevronDown className="ml-1.5 h-3 w-3" />
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

              <div className="hidden md:block">
                <DataStatusIndicator />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 md:px-6 py-5 pb-20 lg:pb-8 relative z-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card rounded-none border-0 border-t border-border/40 safe-area-inset-bottom">
          <div className="flex justify-around items-center h-14 px-2">
            <Link to="/dashboard" className="flex-1">
              <Button
                variant={location.pathname === "/dashboard" ? "secondary" : "ghost"}
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-xl"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-[10px]">Dashboard</span>
              </Button>
            </Link>
            <Link to="/leads" className="flex-1">
              <Button
                variant={location.pathname === "/leads" ? "secondary" : "ghost"}
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-xl"
              >
                <Users className="h-5 w-5" />
                <span className="text-[10px]">Leads</span>
              </Button>
            </Link>
            <Link to="/dashboard-trafego" className="flex-1">
              <Button
                variant={location.pathname === "/dashboard-trafego" ? "secondary" : "ghost"}
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-xl"
              >
                <Activity className="h-5 w-5" />
                <span className="text-[10px]">Tráfego</span>
              </Button>
            </Link>
            <Link to="/alertas" className="flex-1">
              <Button
                variant={location.pathname === "/alertas" ? "secondary" : "ghost"}
                size="sm"
                className="w-full h-12 flex flex-col gap-0.5 rounded-xl"
              >
                <AlertTriangle className="h-5 w-5" />
                <span className="text-[10px]">Alertas</span>
              </Button>
            </Link>
          </div>
        </nav>
      )}

      <ChatIAFlutuante />
    </div>
  );
};
