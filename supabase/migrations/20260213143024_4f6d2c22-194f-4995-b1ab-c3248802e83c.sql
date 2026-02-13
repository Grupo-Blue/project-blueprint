
-- Adicionar coluna score_temperatura na tabela lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS score_temperatura INTEGER NOT NULL DEFAULT 0;

-- Adicionar coluna score_minimo_crm na tabela webhook_destino
ALTER TABLE public.webhook_destino ADD COLUMN IF NOT EXISTS score_minimo_crm INTEGER NOT NULL DEFAULT 70;

-- Índice para consultas de leads quentes pendentes de webhook
CREATE INDEX IF NOT EXISTS idx_lead_score_temperatura ON public.lead (score_temperatura) WHERE score_temperatura >= 70 AND merged = false;
