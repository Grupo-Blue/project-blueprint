import { useEmpresa } from "@/contexts/EmpresaContext";
import { LandingPageAnalytics } from "@/components/dashboard/LandingPageAnalytics";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function AnaliseLandingPages() {
  const { empresaSelecionada, empresasPermitidas } = useEmpresa();

  // Verificar se usuário tem acesso
  if (empresasPermitidas.length === 0) {
    return <SemAcessoEmpresas />;
  }

  if (!empresaSelecionada || empresaSelecionada === "todas") {
    return (
      <div className="container mx-auto p-8">
        <Card className="p-8 text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Análise de Landing Pages
            </CardTitle>
            <CardDescription>
              Selecione uma empresa específica no filtro do cabeçalho para visualizar a análise de landing pages
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Análise de Landing Pages</h1>
        <p className="text-muted-foreground">
          Performance de conversão e análise IA de copy das landing pages
        </p>
      </div>

      <LandingPageAnalytics idEmpresa={empresaSelecionada} />
    </div>
  );
}
