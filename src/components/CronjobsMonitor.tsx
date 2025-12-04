import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Clock, CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CronjobConfig {
  name: string;
  displayName: string;
  functionName: string;
  schedule: string;
  description: string;
}

const CRONJOBS: CronjobConfig[] = [
  {
    name: "importar-campanhas-meta",
    displayName: "Importar Campanhas Meta",
    functionName: "importar-campanhas-meta",
    schedule: "04:00",
    description: "Importa campanhas ativas do Meta Ads"
  },
  {
    name: "importar-campanhas-google",
    displayName: "Importar Campanhas Google",
    functionName: "importar-campanhas-google",
    schedule: "04:15",
    description: "Importa campanhas ativas do Google Ads"
  },
  {
    name: "coletar-metricas-meta",
    displayName: "Coletar Métricas Meta",
    functionName: "coletar-metricas-meta",
    schedule: "04:30",
    description: "Coleta métricas diárias do Meta Ads"
  },
  {
    name: "coletar-metricas-google",
    displayName: "Coletar Métricas Google",
    functionName: "coletar-metricas-google",
    schedule: "04:45",
    description: "Coleta métricas diárias do Google Ads"
  },
  {
    name: "coletar-criativos-meta",
    displayName: "Coletar Criativos Meta",
    functionName: "coletar-criativos-meta",
    schedule: "05:00",
    description: "Coleta criativos e suas métricas do Meta Ads"
  },
  {
    name: "coletar-criativos-google",
    displayName: "Coletar Criativos Google",
    functionName: "coletar-criativos-google",
    schedule: "05:15",
    description: "Coleta criativos e suas métricas do Google Ads"
  },
  {
    name: "sincronizar-notion",
    displayName: "Sincronizar Notion",
    functionName: "sincronizar-notion",
    schedule: "05:30",
    description: "Sincroniza clientes do Notion e atualiza flags"
  },
  {
    name: "sincronizar-pipedrive",
    displayName: "Sincronizar Pipedrive",
    functionName: "sincronizar-pipedrive",
    schedule: "05:45",
    description: "Sincroniza leads e deals do Pipedrive"
  },
  {
    name: "sincronizar-tokeniza",
    displayName: "Sincronizar Tokeniza",
    functionName: "sincronizar-tokeniza",
    schedule: "06:00",
    description: "Sincroniza pedidos da Tokeniza"
  },
  {
    name: "enriquecer-leads-lote",
    displayName: "Enriquecer Leads (Mautic)",
    functionName: "enriquecer-leads-lote",
    schedule: "06:15",
    description: "Enriquece leads com dados do Mautic"
  },
  {
    name: "sincronizar-metricool",
    displayName: "Sincronizar Metricool",
    functionName: "sincronizar-metricool",
    schedule: "04:00",
    description: "Coleta métricas do Instagram e SmartLinks do Metricool"
  }
];

export function CronjobsMonitor() {
  const [executingJobs, setExecutingJobs] = useState<Set<string>>(new Set());

  // Buscar histórico de execuções
  const { data: historicoExecucoes, refetch: refetchHistorico } = useQuery({
    queryKey: ["cronjob-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronjob_execucao")
        .select("*")
        .order("data_execucao", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  // Agrupar execuções por cronjob (última execução de cada)
  const ultimasExecucoes = historicoExecucoes?.reduce((acc, exec) => {
    if (!acc[exec.nome_cronjob]) {
      acc[exec.nome_cronjob] = exec;
    }
    return acc;
  }, {} as Record<string, any>);

  const handleExecuteJob = async (job: CronjobConfig) => {
    setExecutingJobs(prev => new Set(prev).add(job.name));
    const startTime = Date.now();
    
    try {
      const body = job.functionName === "enriquecer-leads-lote" 
        ? { id_empresa: "4ab6f9be-aed2-4d25-a869-d7c51e0e6ee2" }
        : {};

      const { data, error } = await supabase.functions.invoke(job.functionName, {
        body
      });

      const duracao = Date.now() - startTime;

      if (error) {
        console.error("Erro ao executar cronjob:", error);
        
        // Registrar erro no histórico
        await supabase.from("cronjob_execucao").insert({
          nome_cronjob: job.functionName,
          status: "error",
          duracao_ms: duracao,
          mensagem_erro: error.message,
          detalhes_execucao: { error: error.message }
        });
        
        toast.error(`Erro ao executar ${job.displayName}: ${error.message}`);
        refetchHistorico();
        return;
      }

      // Registrar sucesso no histórico
      await supabase.from("cronjob_execucao").insert({
        nome_cronjob: job.functionName,
        status: "success",
        duracao_ms: duracao,
        detalhes_execucao: data
      });

      console.log(`Resultado ${job.displayName}:`, data);
      toast.success(`${job.displayName} executada com sucesso!`);
      refetchHistorico();
    } catch (error: any) {
      const duracao = Date.now() - startTime;
      console.error("Erro inesperado:", error);
      
      // Registrar erro no histórico
      await supabase.from("cronjob_execucao").insert({
        nome_cronjob: job.functionName,
        status: "error",
        duracao_ms: duracao,
        mensagem_erro: error.message,
        detalhes_execucao: { error: error.message }
      });
      
      toast.error(`Erro inesperado ao executar ${job.displayName}: ${error.message}`);
      refetchHistorico();
    } finally {
      setExecutingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.name);
        return newSet;
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Cronjobs Automáticas
        </CardTitle>
        <CardDescription>
          Monitoramento e execução manual das rotinas automatizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CRONJOBS.map((job) => {
            const isExecuting = executingJobs.has(job.name);
            const ultimaExecucao = ultimasExecucoes?.[job.functionName];
            
            return (
              <div
                key={job.name}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium">{job.displayName}</h4>
                    <Badge variant="outline" className="text-xs">
                      {job.schedule}
                    </Badge>
                    {ultimaExecucao && (
                      <Badge 
                        variant={ultimaExecucao.status === "success" || ultimaExecucao.status === "sucesso" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {ultimaExecucao.status === "success" || ultimaExecucao.status === "sucesso" ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {ultimaExecucao.status === "success" || ultimaExecucao.status === "sucesso" ? "Sucesso" : "Erro"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{job.description}</p>
                  {ultimaExecucao && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <History className="w-3 h-3" />
                      <span>
                        Última execução: {formatDistanceToNow(new Date(ultimaExecucao.data_execucao), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </span>
                      {ultimaExecucao.duracao_ms && (
                        <span className="ml-2">
                          • Duração: {(ultimaExecucao.duracao_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                  {ultimaExecucao?.status !== "success" && ultimaExecucao?.status !== "sucesso" && ultimaExecucao?.mensagem_erro && (
                    <p className="text-xs text-destructive mt-1">
                      Erro: {ultimaExecucao.mensagem_erro}
                    </p>
                  )}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExecuteJob(job)}
                  disabled={isExecuting}
                  className="ml-4"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Executar
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Sobre as Cronjobs</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Todas as cronjobs executam automaticamente antes das 07:00</li>
                <li>Você pode executar manualmente a qualquer momento usando o botão "Executar"</li>
                <li>As execuções manuais não afetam o agendamento automático</li>
                <li>Os dados são coletados do dia anterior</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
