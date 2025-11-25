-- Adicionar campo id_criativo na tabela lead para rastreamento
ALTER TABLE public.lead 
ADD COLUMN id_criativo uuid REFERENCES public.criativo(id_criativo);

-- Adicionar índice para melhorar performance de queries
CREATE INDEX idx_lead_id_criativo ON public.lead(id_criativo);

-- Adicionar campos para capturar UTM parameters do Pipedrive
ALTER TABLE public.lead 
ADD COLUMN utm_source varchar,
ADD COLUMN utm_medium varchar,
ADD COLUMN utm_campaign varchar,
ADD COLUMN utm_content varchar,
ADD COLUMN utm_term varchar;

COMMENT ON COLUMN public.lead.id_criativo IS 'Referência ao criativo que gerou este lead';
COMMENT ON COLUMN public.lead.utm_source IS 'UTM source capturado do Pipedrive';
COMMENT ON COLUMN public.lead.utm_medium IS 'UTM medium capturado do Pipedrive';
COMMENT ON COLUMN public.lead.utm_campaign IS 'UTM campaign capturado do Pipedrive';
COMMENT ON COLUMN public.lead.utm_content IS 'UTM content - usado para identificar o criativo';
COMMENT ON COLUMN public.lead.utm_term IS 'UTM term capturado do Pipedrive';