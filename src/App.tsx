import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/acoes" element={<Acoes />} />
          <Route path="/aprovacoes" element={<Aprovacoes />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/relatorios/novo" element={<RelatorioNovo />} />
          <Route path="/relatorios/:id" element={<RelatorioEditor />} />
          <Route path="/hipoteses" element={<Hipoteses />} />
          <Route path="/aprendizados" element={<Aprendizados />} />
          <Route path="/dashboard-direcao" element={<DashboardDirecao />} />
          <Route path="/dashboard-trafego" element={<DashboardTrafego />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/calculo-metricas" element={<CalculoMetricas />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/criativos" element={<Criativos />} />
          <Route path="/usuarios" element={<Usuarios />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
