-- Adicionar campos de mês e ano para relatórios mensais
ALTER TABLE public.relatorio_semanal 
ADD COLUMN IF NOT EXISTS mes INTEGER,
ADD COLUMN IF NOT EXISTS ano INTEGER;

-- Comentário: id_semana será opcional agora, permitindo relatórios mensais
COMMENT ON TABLE public.relatorio_semanal IS 'Tabela de relatórios (mensais ou semanais). Para relatórios mensais, usar campos mes/ano.';