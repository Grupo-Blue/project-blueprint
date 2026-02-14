
-- Adicionar colunas de enriquecimento Metricool na tabela lead
ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS metricool_conversao_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS metricool_roas_campanha NUMERIC,
  ADD COLUMN IF NOT EXISTS metricool_cpc_campanha NUMERIC,
  ADD COLUMN IF NOT EXISTS metricool_ctr_campanha NUMERIC,
  ADD COLUMN IF NOT EXISTS metricool_fonte TEXT,
  ADD COLUMN IF NOT EXISTS id_post_organico_vinculado UUID REFERENCES public.social_posts(id);

-- Índice para busca por post orgânico vinculado
CREATE INDEX IF NOT EXISTS idx_lead_post_organico ON public.lead(id_post_organico_vinculado) WHERE id_post_organico_vinculado IS NOT NULL;

-- Índice para busca por campanha vinculada (usado no enriquecimento)
CREATE INDEX IF NOT EXISTS idx_lead_campanha_vinculada ON public.lead(id_campanha_vinculada) WHERE id_campanha_vinculada IS NOT NULL;
