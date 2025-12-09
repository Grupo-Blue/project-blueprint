-- Adicionar campos Chatwoot na tabela lead
ALTER TABLE public.lead
ADD COLUMN IF NOT EXISTS chatwoot_contact_id integer,
ADD COLUMN IF NOT EXISTS chatwoot_conversas_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS chatwoot_mensagens_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS chatwoot_ultima_conversa timestamp with time zone,
ADD COLUMN IF NOT EXISTS chatwoot_status_atendimento text,
ADD COLUMN IF NOT EXISTS chatwoot_tempo_resposta_medio integer,
ADD COLUMN IF NOT EXISTS chatwoot_agente_atual text,
ADD COLUMN IF NOT EXISTS chatwoot_inbox text;

-- Adicionar índice para busca por chatwoot_contact_id
CREATE INDEX IF NOT EXISTS idx_lead_chatwoot_contact_id ON public.lead(chatwoot_contact_id);

-- Adicionar CHATWOOT como tipo de integração
ALTER TYPE public.tipo_integracao ADD VALUE IF NOT EXISTS 'CHATWOOT';