import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para escutar atualizações em tempo real da tabela de leads
 * Invalida as queries relacionadas quando novos leads são inseridos
 */
export function useLeadsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead',
        },
        (payload) => {
          // Invalidar queries de leads para refetch automático
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['leads-count'] });
          queryClient.invalidateQueries({ queryKey: ['vendas-mes'] });
          
          // Notificação discreta de novo lead
          const leadName = (payload.new as any)?.nome_lead || 'Novo lead';
          toast.success(`🆕 ${leadName}`, {
            description: 'Novo lead recebido',
            duration: 3000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lead',
        },
        () => {
          // Invalidar queries silenciosamente em updates
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['leads-count'] });
          queryClient.invalidateQueries({ queryKey: ['vendas-mes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
