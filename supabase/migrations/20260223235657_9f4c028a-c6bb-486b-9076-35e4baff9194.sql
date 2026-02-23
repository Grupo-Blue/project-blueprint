
-- Índices para performance do cross-match FBP
CREATE INDEX IF NOT EXISTS idx_stape_evento_fbp ON public.stape_evento(fbp) WHERE fbp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_fbp ON public.lead(fbp) WHERE fbp IS NOT NULL;

-- Colunas para controle de envio Meta CAPI Purchase
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS meta_capi_purchase_enviado BOOLEAN DEFAULT false;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS meta_capi_purchase_at TIMESTAMPTZ;
