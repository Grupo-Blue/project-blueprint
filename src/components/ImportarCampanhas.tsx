import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportarCampanhasProps {
  plataforma: "META" | "GOOGLE";
  integracaoId: string;
  empresaNome: string;
}

export const ImportarCampanhas = ({ plataforma, integracaoId, empresaNome }: ImportarCampanhasProps) => {
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImportar = async () => {
    setImportando(true);
    setResultado(null);

    try {
      const functionName = plataforma === "META" 
        ? "importar-campanhas-meta" 
        : "importar-campanhas-google";

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { integracao_id: integracaoId },
      });

      if (error) throw error;

      setResultado(data);

      // Verificar se houve sucesso
      const sucesso = data.resultados?.some((r: any) => r.status === "success");
      
      if (sucesso) {
        const resultado = data.resultados.find((r: any) => r.status === "success");
        
        toast({
          title: "Campanhas importadas com sucesso!",
          description: `${resultado.campanhas_importadas} nova(s) campanha(s) importada(s) e ${resultado.campanhas_atualizadas} atualizada(s).`,
        });

        // Invalidar queries para atualizar a UI
        queryClient.invalidateQueries({ queryKey: ["campanhas"] });
        queryClient.invalidateQueries({ queryKey: ["contas-anuncio"] });
      } else {
        const erro = data.resultados?.[0]?.error || "Erro desconhecido";
        toast({
          title: "Erro ao importar campanhas",
          description: erro,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Erro ao importar campanhas:", err);
      toast({
        title: "Erro ao importar campanhas",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Download className="h-4 w-4" />
        <AlertTitle>Importar Campanhas Automaticamente</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Importe automaticamente todas as campanhas ativas da conta {plataforma === "META" ? "Meta Ads" : "Google Ads"} 
            da empresa <strong>{empresaNome}</strong>.
          </p>
          <Button 
            onClick={handleImportar} 
            disabled={importando}
            size="sm"
          >
            {importando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar Campanhas
              </>
            )}
          </Button>
        </AlertDescription>
      </Alert>

      {resultado && resultado.resultados && resultado.resultados[0]?.status === "success" && (
        <Alert className="border-green-600">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Importação Concluída!</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>{resultado.resultados[0].campanhas_importadas} nova(s) campanha(s) importada(s)</li>
              <li>{resultado.resultados[0].campanhas_atualizadas} campanha(s) atualizada(s)</li>
              <li>{resultado.resultados[0].total_processadas} campanha(s) processada(s)</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};