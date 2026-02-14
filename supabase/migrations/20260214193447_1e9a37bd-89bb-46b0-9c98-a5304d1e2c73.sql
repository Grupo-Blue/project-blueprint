
-- Adicionar constraint unique em (id_campanha, data) para permitir upsert correto
-- Primeiro remover duplicatas mantendo o mais recente
DELETE FROM public.campanha_metricas_dia a
USING public.campanha_metricas_dia b
WHERE a.id_metricas_dia < b.id_metricas_dia
  AND a.id_campanha = b.id_campanha
  AND a.data = b.data;

-- Criar constraint unique
ALTER TABLE public.campanha_metricas_dia
  ADD CONSTRAINT campanha_metricas_dia_campanha_data_unique UNIQUE (id_campanha, data);
