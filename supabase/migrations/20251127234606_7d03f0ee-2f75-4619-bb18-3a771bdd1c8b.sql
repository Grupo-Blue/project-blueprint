-- Adicionar campo url_final na tabela criativo para armazenar a URL do anúncio com UTM parameters
ALTER TABLE criativo ADD COLUMN IF NOT EXISTS url_final TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN criativo.url_final IS 'URL final do anúncio contendo os UTM parameters configurados';