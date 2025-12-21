import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface FaseExecucao {
  nome: string;
  jobs: string[];
  status: "pendente" | "executando" | "concluido" | "erro";
  duracao_ms?: number;
  erro?: string;
}

interface DetalhesExecucao {
  id_empresa: string;
  fases: FaseExecucao[];
  mensagem?: string;
}

export function useAtualizarDadosEmpresa() {
  const [isAtualizando, setIsAtualizando] = useState(false);
  const [fases, setFases] = useState<FaseExecucao[]>([]);
  const [duracaoTotal, setDuracaoTotal] = useState<number | undefined>();
  const [concluido, setConcluido] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const execucaoIdRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setFases([]);
    setDuracaoTotal(undefined);
    setConcluido(false);
    setSucesso(false);
    setErro(undefined);
    execucaoIdRef.current = null;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const buscarProgresso = useCallback(async () => {
    if (!execucaoIdRef.current) return;

    try {
      const { data, error } = await supabase
        .from("cronjob_execucao")
        .select("status, duracao_ms, detalhes_execucao")
        .eq("id_execucao", execucaoIdRef.current)
        .single();

      if (error) {
        console.error("[useAtualizarDadosEmpresa] Erro ao buscar progresso:", error);
        return;
      }

      if (data) {
        const detalhes = data.detalhes_execucao as unknown as DetalhesExecucao | null;
        
        if (detalhes?.fases) {
          setFases(detalhes.fases);
        }
        
        setDuracaoTotal(data.duracao_ms || undefined);

        // Verificar se a execução terminou
        if (data.status === "sucesso" || data.status === "parcial" || data.status === "erro") {
          // Parar polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setConcluido(true);
          setSucesso(data.status === "sucesso");
          setIsAtualizando(false);

          if (data.status === "parcial" || data.status === "erro") {
            const fasesComErro = detalhes?.fases?.filter(f => f.status === "erro") || [];
            if (fasesComErro.length > 0) {
              setErro(`Algumas fases falharam: ${fasesComErro.map(f => f.nome).join(", ")}`);
            } else if (detalhes?.mensagem) {
              setErro(detalhes.mensagem);
            }
          }

          // Invalidar queries relacionadas
          queryClient.invalidateQueries({ queryKey: ["campanhas-metricas"] });
          queryClient.invalidateQueries({ queryKey: ["totais-gerais-empresa"] });
          queryClient.invalidateQueries({ queryKey: ["mql-distribuicao"] });
          queryClient.invalidateQueries({ queryKey: ["cpl-organico"] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          queryClient.invalidateQueries({ queryKey: ["criativos"] });

          toast({
            title: data.status === "sucesso" ? "Atualização concluída!" : "Atualização parcial",
            description: detalhes?.mensagem || `Duração: ${((data.duracao_ms || 0) / 1000).toFixed(1)}s`,
            variant: data.status === "sucesso" ? "default" : "destructive",
          });
        }
      }
    } catch (err) {
      console.error("[useAtualizarDadosEmpresa] Erro no polling:", err);
    }
  }, [queryClient, toast]);

  const atualizarDados = useCallback(async (idEmpresa: string) => {
    setIsAtualizando(true);
    resetState();

    try {
      console.log("[useAtualizarDadosEmpresa] Iniciando atualização para:", idEmpresa);

      const { data, error } = await supabase.functions.invoke(
        "atualizar-dados-empresa",
        {
          body: { id_empresa: idEmpresa },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data?.id_execucao) {
        execucaoIdRef.current = data.id_execucao;
        console.log("[useAtualizarDadosEmpresa] Execução iniciada:", data.id_execucao);

        // Iniciar polling a cada 2 segundos
        pollingIntervalRef.current = setInterval(buscarProgresso, 2000);
        
        // Fazer primeira busca imediatamente
        setTimeout(buscarProgresso, 500);
      } else {
        throw new Error("Não foi possível iniciar a atualização");
      }
      
    } catch (err: any) {
      console.error("[useAtualizarDadosEmpresa] Erro:", err);
      setErro(err.message || "Erro desconhecido ao atualizar dados");
      setSucesso(false);
      setConcluido(true);
      setIsAtualizando(false);
      
      toast({
        title: "Erro ao atualizar",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [resetState, buscarProgresso, toast]);

  return {
    atualizarDados,
    isAtualizando,
    fases,
    duracaoTotal,
    concluido,
    sucesso,
    erro,
    resetState,
  };
}
