-- Fase 2: Adicionar campos de comportamento GA4 na tabela lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_landing_page TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_categoria_jornada TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_engajamento_score INTEGER;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_tempo_site_segundos NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_bounce_rate NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS ga4_sessoes INTEGER;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.lead.ga4_landing_page IS 'URL da landing page de entrada do lead baseado em UTMs';
COMMENT ON COLUMN public.lead.ga4_categoria_jornada IS 'Categoria de jornada inferida (investidor, captador, prospect, plataforma)';
COMMENT ON COLUMN public.lead.ga4_engajamento_score IS 'Score de engajamento 0-100 baseado em métricas GA4';
COMMENT ON COLUMN public.lead.ga4_tempo_site_segundos IS 'Tempo médio no site em segundos da LP de origem';
COMMENT ON COLUMN public.lead.ga4_bounce_rate IS 'Taxa de rejeição da LP de origem';
COMMENT ON COLUMN public.lead.ga4_sessoes IS 'Número de sessões da LP de origem no período';