-- Criar índice único na coluna id_anuncio_externo para permitir upsert
CREATE UNIQUE INDEX IF NOT EXISTS criativo_id_anuncio_externo_unique 
ON public.criativo (id_anuncio_externo) 
WHERE id_anuncio_externo IS NOT NULL;