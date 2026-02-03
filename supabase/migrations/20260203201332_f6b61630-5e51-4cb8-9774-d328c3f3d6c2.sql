-- Tornar id_semana opcional para permitir relatórios mensais
ALTER TABLE public.relatorio_semanal 
ALTER COLUMN id_semana DROP NOT NULL;