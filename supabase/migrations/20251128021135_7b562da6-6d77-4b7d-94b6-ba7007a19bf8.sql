-- Adicionar MAUTIC ao enum tipo_integracao
ALTER TYPE tipo_integracao ADD VALUE IF NOT EXISTS 'MAUTIC';

-- Adicionar colunas de enriquecimento Mautic na tabela lead
ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS mautic_score INTEGER,
  ADD COLUMN IF NOT EXISTS mautic_page_hits INTEGER,
  ADD COLUMN IF NOT EXISTS mautic_last_active TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS mautic_first_visit TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS mautic_tags JSONB,
  ADD COLUMN IF NOT EXISTS mautic_segments JSONB,
  ADD COLUMN IF NOT EXISTS cidade_mautic TEXT,
  ADD COLUMN IF NOT EXISTS estado_mautic TEXT,
  ADD COLUMN IF NOT EXISTS id_mautic_contact TEXT;

-- Criar índice para busca por email
CREATE INDEX IF NOT EXISTS idx_lead_email ON public.lead(email);

-- Criar índice para busca por id_mautic_contact
CREATE INDEX IF NOT EXISTS idx_lead_mautic_contact ON public.lead(id_mautic_contact);