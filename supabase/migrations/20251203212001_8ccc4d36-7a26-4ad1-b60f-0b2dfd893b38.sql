-- Adicionar coluna para armazenar o link de preview do criativo (Meta Ads preview_shareable_link)
ALTER TABLE public.criativo ADD COLUMN IF NOT EXISTS url_preview TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.criativo.url_preview IS 'Link para visualizar o criativo no Facebook (preview_shareable_link do Meta Ads)';