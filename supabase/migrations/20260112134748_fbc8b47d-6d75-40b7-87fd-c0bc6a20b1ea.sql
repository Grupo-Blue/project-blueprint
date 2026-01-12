-- Habilitar realtime na tabela lead para atualizações instantâneas
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead;

-- Habilitar realtime na tabela cronjob_execucao para indicador de status
ALTER PUBLICATION supabase_realtime ADD TABLE public.cronjob_execucao;