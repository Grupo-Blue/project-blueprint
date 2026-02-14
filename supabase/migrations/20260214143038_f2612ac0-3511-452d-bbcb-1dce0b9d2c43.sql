
-- Apenas adicionar as constraints que podem estar faltando (usando IF NOT EXISTS via DO block)
DO $$
BEGIN
  -- UNIQUE em concorrente_anuncio.ad_id_externo
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'concorrente_anuncio_ad_id_externo_key'
  ) THEN
    ALTER TABLE public.concorrente_anuncio 
      ADD CONSTRAINT concorrente_anuncio_ad_id_externo_key UNIQUE (ad_id_externo);
  END IF;

  -- UNIQUE em tendencia_mercado.url
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tendencia_mercado_url_key'
  ) THEN
    ALTER TABLE public.tendencia_mercado 
      ADD CONSTRAINT tendencia_mercado_url_key UNIQUE (url);
  END IF;
END $$;
