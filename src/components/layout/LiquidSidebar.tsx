import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart3, ListChecks, FileText, BookOpen, Target, Lightbulb,
  Eye, Activity, Building2, Calculator, AlertTriangle, Image,
  Shield, Link as LinkIcon, TrendingUp, Users, ChevronLeft,
  ChevronRight, LogOut, Receipt, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import sgtLogo from "@/assets/sgt-logo.png";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  group: string;
  requiredRole?: string[];
}

const navItems: NavItem[] = [
  // Dashboards
  { label: "Dashboard", to: "/dashboard", icon: BarChart3, group: "Dashboards" },
  { label: "Dash Direção", to: "/dashboard-direcao", icon: Eye, group: "Dashboards", requiredRole: ["DIRECAO", "ADMIN"] },
  { label: "Dash Comercial", to: "/dashboard-comercial", icon: TrendingUp, group: "Dashboards" },
  { label: "Dash Tráfego", to: "/dashboard-trafego", icon: Activity, group: "Dashboards" },
  // Operacional
  { label: "Leads", to: "/leads", icon: Users, group: "Operacional" },
  { label: "Tarefas", to: "/acoes", icon: ListChecks, group: "Operacional", requiredRole: ["TRAFEGO", "ADMIN"] },
  { label: "Alertas", to: "/alertas", icon: AlertTriangle, group: "Operacional" },
  // Análise
  { label: "Relatórios", to: "/relatorios", icon: FileText, group: "Análise" },
  { label: "Campanhas", to: "/relatorio-criativos", icon: Image, group: "Análise" },
  { label: "Landing Pages", to: "/analise-landing-pages", icon: TrendingUp, group: "Análise" },
  { label: "Concorrentes", to: "/analise-competitiva", icon: Eye, group: "Análise" },
  { label: "Hipóteses", to: "/hipoteses", icon: Target, group: "Análise" },
  { label: "Aprendizados", to: "/aprendizados", icon: Lightbulb, group: "Análise" },
  { label: "Guia UTM", to: "/guia-utm", icon: BookOpen, group: "Análise" },
  // Admin
  { label: "IRPF", to: "/irpf-importacoes", icon: Receipt, group: "Admin", requiredRole: ["DIRECAO", "ADMIN"] },
  { label: "Contas Anúncio", to: "/contas-anuncio", icon: Building2, group: "Admin", requiredRole: ["TRAFEGO", "ADMIN"] },
  { label: "Cadastro Camp.", to: "/campanhas-cadastro", icon: TrendingUp, group: "Admin", requiredRole: ["TRAFEGO", "ADMIN"] },
  { label: "Empresas", to: "/empresas", icon: Building2, group: "Admin", requiredRole: ["ADMIN"] },
  { label: "Usuários", to: "/usuarios", icon: Shield, group: "Admin", requiredRole: ["ADMIN"] },
  { label: "Integrações", to: "/integracoes", icon: LinkIcon, group: "Admin", requiredRole: ["ADMIN"] },
  { label: "Métricas", to: "/calculo-metricas", icon: Calculator, group: "Admin", requiredRole: ["ADMIN"] },
];

interface LiquidSidebarProps {
  profile: any;
  onLogout: () => void;
}

export const LiquidSidebar = ({ profile, onLogout }: LiquidSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  const isAdminUser = profile?.perfil === "ADMIN";
  const isDirecao = profile?.perfil === "DIRECAO" || isAdminUser;
  const isTrafego = profile?.perfil === "TRAFEGO" || isAdminUser;

  const hasAccess = (item: NavItem) => {
    if (!item.requiredRole) return true;
    if (item.requiredRole.includes("ADMIN") && isAdminUser) return true;
    if (item.requiredRole.includes("DIRECAO") && isDirecao) return true;
    if (item.requiredRole.includes("TRAFEGO") && isTrafego) return true;
    return false;
  };

  const filteredItems = navItems.filter(hasAccess);
  const groups = [...new Set(filteredItems.map(i => i.group))];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4", collapsed && "justify-center px-2")}>
        <img src={sgtLogo} alt="SGT" className="h-9 w-9 object-contain flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-foreground truncate">SGT</h1>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.nome}</p>
          </div>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-4 pb-4">
        {groups.map(group => (
          <div key={group}>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-1.5">
                {group}
              </p>
            )}
            <div className="space-y-0.5">
              {filteredItems.filter(i => i.group === group).map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                        collapsed && "justify-center px-2"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "drop-shadow-sm")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("px-2 pb-4 space-y-1", collapsed && "px-1")}>
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-accent/40 mb-2">
            <p className="text-[10px] text-muted-foreground">Perfil</p>
            <p className="text-xs font-medium truncate">{profile?.nome}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
            collapsed && "justify-center px-2"
          )}
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="fixed top-3 left-3 z-50 h-10 w-10 p-0 glass-card">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 liquid-sidebar">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside
      className={cn(
        "liquid-sidebar fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <SidebarContent />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-accent transition-colors z-50"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
};
