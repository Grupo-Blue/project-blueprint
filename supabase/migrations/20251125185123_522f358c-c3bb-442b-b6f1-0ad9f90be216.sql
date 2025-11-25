-- Adicionar campos para enriquecer informações dos leads do Pipedrive
ALTER TABLE public.lead 
ADD COLUMN IF NOT EXISTS nome_lead TEXT,
ADD COLUMN IF NOT EXISTS organizacao TEXT,
ADD COLUMN IF NOT EXISTS stage_atual TEXT,
ADD COLUMN IF NOT EXISTS pipeline_id TEXT,
ADD COLUMN IF NOT EXISTS url_pipedrive TEXT;