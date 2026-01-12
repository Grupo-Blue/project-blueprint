import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DataStatusInfo {
  ultimaAtualizacao: Date | null;
  tempoRelativo: string;
  status: 'fresh' | 'stale' | 'old';
  isLoading: boolean;
}

/**
 * Hook para monitorar status da última atualização de dados
 */
export function useDataStatus(): DataStatusInfo {
  const { data: ultimaExecucao, isLoading } = useQuery({
    queryKey: ['ultima-execucao-cronjob'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronjob_execucao')
        .select('data_execucao, nome_cronjob, status')
        .eq('status', 'sucesso')
        .order('data_execucao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 60 * 1000, // Atualizar a cada 1 minuto
    staleTime: 30 * 1000,
  });

  const ultimaAtualizacao = ultimaExecucao?.data_execucao 
    ? new Date(ultimaExecucao.data_execucao) 
    : null;

  const getTempoRelativo = () => {
    if (!ultimaAtualizacao) return 'Nunca';
    return formatDistanceToNow(ultimaAtualizacao, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const getStatus = (): 'fresh' | 'stale' | 'old' => {
    if (!ultimaAtualizacao) return 'old';
    const diffMs = Date.now() - ultimaAtualizacao.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 4) return 'fresh';
    if (diffHours < 24) return 'stale';
    return 'old';
  };

  return {
    ultimaAtualizacao,
    tempoRelativo: getTempoRelativo(),
    status: getStatus(),
    isLoading,
  };
}
