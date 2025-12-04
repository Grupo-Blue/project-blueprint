-- Criar enum para tipo de origem do lead
CREATE TYPE origem_lead AS ENUM ('PAGO', 'ORGANICO', 'INDICACAO', 'LISTA', 'MANUAL');

-- Adicionar colunas na tabela lead
ALTER TABLE public.lead ADD COLUMN origem_tipo origem_lead DEFAULT 'MANUAL';
ALTER TABLE public.lead ADD COLUMN lead_pago boolean DEFAULT false;

-- Índice para performance nas queries de CPL
CREATE INDEX idx_lead_pago ON public.lead(lead_pago) WHERE lead_pago = true;
CREATE INDEX idx_lead_origem_tipo ON public.lead(origem_tipo);

-- Classificar leads existentes baseado em UTM e id_criativo
UPDATE public.lead SET 
  origem_tipo = CASE
    WHEN id_criativo IS NOT NULL THEN 'PAGO'::origem_lead
    WHEN utm_source ILIKE ANY(ARRAY['%facebook%', '%meta%', '%fb%', '%google%', '%ads%']) THEN 'PAGO'::origem_lead
    WHEN utm_source IN ('ig', 'instagram') THEN 'PAGO'::origem_lead
    WHEN utm_source ILIKE ANY(ARRAY['%email%', '%mail%']) THEN 'ORGANICO'::origem_lead
    WHEN utm_source IN ('orgânico', 'comunidade-tokeniza', 'fluxo') THEN 'ORGANICO'::origem_lead
    ELSE 'MANUAL'::origem_lead
  END,
  lead_pago = CASE
    WHEN id_criativo IS NOT NULL THEN true
    WHEN utm_source ILIKE ANY(ARRAY['%facebook%', '%meta%', '%fb%', '%google%', '%ads%']) THEN true
    WHEN utm_source IN ('ig', 'instagram') THEN true
    ELSE false
  END;