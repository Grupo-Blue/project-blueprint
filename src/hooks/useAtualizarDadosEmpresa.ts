import { useState, useCallback } from "react";
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

interface ResultadoAtualizacao {
  sucesso: boolean;
  fases: FaseExecucao[];
  duracao_total_ms: number;
  mensagem: string;
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

  const resetState = useCallback(() => {
    setFases([]);
    setDuracaoTotal(undefined);
    setConcluido(false);
    setSucesso(false);
    setErro(undefined);
  }, []);

  const atualizarDados = useCallback(async (idEmpresa: string) => {
    setIsAtualizando(true);
    resetState();

    try {
      console.log("[useAtualizarDadosEmpresa] Iniciando atualização para:", idEmpresa);

      const { data, error } = await supabase.functions.invoke<ResultadoAtualizacao>(
        "atualizar-dados-empresa",
        {
          body: { id_empresa: idEmpresa },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        setFases(data.fases);
        setDuracaoTotal(data.duracao_total_ms);
        setSucesso(data.sucesso);
        
        if (!data.sucesso) {
          const fasesComErro = data.fases.filter(f => f.status === "erro");
          if (fasesComErro.length > 0) {
            setErro(`Algumas fases falharam: ${fasesComErro.map(f => f.nome).join(", ")}`);
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
          title: data.sucesso ? "Atualização concluída!" : "Atualização parcial",
          description: data.mensagem,
          variant: data.sucesso ? "default" : "destructive",
        });
      }

      setConcluido(true);
      
    } catch (err: any) {
      console.error("[useAtualizarDadosEmpresa] Erro:", err);
      setErro(err.message || "Erro desconhecido ao atualizar dados");
      setSucesso(false);
      setConcluido(true);
      
      toast({
        title: "Erro ao atualizar",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsAtualizando(false);
    }
  }, [queryClient, toast, resetState]);

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
