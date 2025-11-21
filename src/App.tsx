import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Acoes from "./pages/Acoes";
import Aprovacoes from "./pages/Aprovacoes";
import Campanhas from "./pages/Campanhas";
import Relatorios from "./pages/Relatorios";
import RelatorioEditor from "./pages/RelatorioEditor";
import RelatorioNovo from "./pages/RelatorioNovo";
import Hipoteses from "./pages/Hipoteses";
import Aprendizados from "./pages/Aprendizados";
import DashboardDirecao from "./pages/DashboardDirecao";
import DashboardTrafego from "./pages/DashboardTrafego";
import Empresas from "./pages/Empresas";
import CalculoMetricas from "./pages/CalculoMetricas";
import Alertas from "./pages/Alertas";
import Criativos from "./pages/Criativos";
import Usuarios from "./pages/Usuarios";
import Integracoes from "./pages/Integracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/acoes" element={<AppLayout><Acoes /></AppLayout>} />
          <Route path="/aprovacoes" element={<AppLayout><Aprovacoes /></AppLayout>} />
          <Route path="/campanhas" element={<AppLayout><Campanhas /></AppLayout>} />
          <Route path="/relatorios" element={<AppLayout><Relatorios /></AppLayout>} />
          <Route path="/relatorios/novo" element={<AppLayout><RelatorioNovo /></AppLayout>} />
          <Route path="/relatorios/:id" element={<AppLayout><RelatorioEditor /></AppLayout>} />
          <Route path="/hipoteses" element={<AppLayout><Hipoteses /></AppLayout>} />
          <Route path="/aprendizados" element={<AppLayout><Aprendizados /></AppLayout>} />
          <Route path="/dashboard-direcao" element={<AppLayout><DashboardDirecao /></AppLayout>} />
          <Route path="/dashboard-trafego" element={<AppLayout><DashboardTrafego /></AppLayout>} />
          <Route path="/empresas" element={<AppLayout><Empresas /></AppLayout>} />
          <Route path="/calculo-metricas" element={<AppLayout><CalculoMetricas /></AppLayout>} />
          <Route path="/alertas" element={<AppLayout><Alertas /></AppLayout>} />
          <Route path="/criativos" element={<AppLayout><Criativos /></AppLayout>} />
          <Route path="/usuarios" element={<AppLayout><Usuarios /></AppLayout>} />
          <Route path="/integracoes" element={<AppLayout><Integracoes /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
