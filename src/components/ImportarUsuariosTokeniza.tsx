import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

export function ImportarUsuariosTokeniza() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });
      data.push(row);
    }
    
    return data;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV");
      return;
    }

    setLoading(true);
    setProgress(10);
    setResult(null);

    try {
      const text = await file.text();
      setProgress(30);

      const csvData = parseCSV(text);
      setProgress(50);

      console.log(`Parsed ${csvData.length} records from CSV`);

      const { data, error } = await supabase.functions.invoke('importar-usuarios-tokeniza', {
        body: { csvData }
      });

      setProgress(90);

      if (error) throw error;

      setResult(data);
      setProgress(100);

      if (data.success) {
        toast.success(`${data.totalInserido} usuários importados com sucesso!`);
      } else {
        toast.error(`Erro na importação: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error(`Erro: ${error.message}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichLeads = async () => {
    setLoading(true);
    setProgress(10);

    try {
      toast.info("Iniciando enriquecimento de leads com dados Tokeniza...");

      const { data, error } = await supabase.functions.invoke('enriquecer-leads-tokeniza', {
        body: {}
      });

      setProgress(100);

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Enriquecimento concluído! ${data.totalEnriquecidos} leads enriquecidos, ` +
          `${data.totalInvestidores} investidores, ${data.totalCarrinhosAbandonados} carrinhos abandonados`
        );
      } else {
        toast.error(`Erro: ${data.error}`);
      }

      setResult(data);
    } catch (error: any) {
      console.error('Erro ao enriquecer:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importar Usuários Tokeniza
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Usuários Tokeniza</DialogTitle>
          <DialogDescription>
            Faça upload do CSV de usuários para criar mapeamento ID → Email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Arquivo: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Processando... {progress}%
              </p>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800">Importação concluída!</p>
                    <p className="text-green-700">
                      {result.totalInserido || result.totalEnriquecidos} registros processados
                    </p>
                    {result.totalInvestidores !== undefined && (
                      <p className="text-green-700">
                        {result.totalInvestidores} investidores • {result.totalCarrinhosAbandonados} carrinhos
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800">Erro na importação</p>
                    <p className="text-red-700">{result.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={handleImport} disabled={!file || loading}>
              {loading ? "Processando..." : "1. Importar CSV de Usuários"}
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={handleEnrichLeads} 
              disabled={loading}
            >
              {loading ? "Enriquecendo..." : "2. Enriquecer Leads com Dados Tokeniza"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
