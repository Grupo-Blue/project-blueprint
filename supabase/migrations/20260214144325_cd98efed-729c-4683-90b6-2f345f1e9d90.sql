
-- Expandir campanha_metricas_dia com métricas avançadas
ALTER TABLE public.campanha_metricas_dia
  ADD COLUMN IF NOT EXISTS alcance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequencia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcela_impressao numeric,
  ADD COLUMN IF NOT EXISTS video_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_avg_watch_time numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_clicks integer DEFAULT 0;

-- Expandir criativo_metricas_dia com métricas avançadas
ALTER TABLE public.criativo_metricas_dia
  ADD COLUMN IF NOT EXISTS alcance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequencia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversoes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_conversao numeric DEFAULT 0;
