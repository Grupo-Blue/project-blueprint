import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function SemAcessoEmpresas() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Não Configurado</h2>
        <p className="text-muted-foreground">
          Você ainda não possui acesso a nenhuma empresa.
          Solicite ao administrador para configurar suas permissões.
        </p>
      </Card>
    </div>
  );
}
