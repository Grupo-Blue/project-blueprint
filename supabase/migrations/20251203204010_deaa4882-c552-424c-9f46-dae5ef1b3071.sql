-- Fase 4: Adicionar coluna id_anuncio_externo para match por Ad ID
ALTER TABLE public.criativo ADD COLUMN IF NOT EXISTS id_anuncio_externo VARCHAR;

-- Criar índice para busca eficiente
CREATE INDEX IF NOT EXISTS idx_criativo_id_anuncio ON public.criativo(id_anuncio_externo);

-- Comentário explicativo
COMMENT ON COLUMN public.criativo.id_anuncio_externo IS 'ID do anúncio no Meta/Google (diferente do creative_id). Usado para match com utm_content dos leads.';