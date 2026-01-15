-- Adicionar colunas para dados de conversão vindos do Metricool/Google Ads
ALTER TABLE public.campanha_metricas_dia 
ADD COLUMN IF NOT EXISTS conversoes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_conversao numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fonte_conversoes text DEFAULT NULL;

COMMENT ON COLUMN public.campanha_metricas_dia.conversoes IS 'Número de conversões (pode vir do Google Ads direto ou do Metricool)';
COMMENT ON COLUMN public.campanha_metricas_dia.valor_conversao IS 'Valor total das conversões em reais';
COMMENT ON COLUMN public.campanha_metricas_dia.fonte_conversoes IS 'Fonte dos dados de conversão: GOOGLE_ADS, METRICOOL, ou NULL se não preenchido';