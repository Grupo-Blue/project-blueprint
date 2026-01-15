-- Remover índice parcial atual que não funciona com ON CONFLICT
DROP INDEX IF EXISTS criativo_id_anuncio_externo_unique;

-- Criar constraint UNIQUE real (não parcial)
-- Primeiro, vamos limpar possíveis duplicatas mantendo o mais recente
DELETE FROM criativo a USING criativo b
WHERE a.id_anuncio_externo IS NOT NULL 
  AND a.id_anuncio_externo = b.id_anuncio_externo 
  AND a.created_at < b.created_at;

-- Agora criar a constraint UNIQUE
ALTER TABLE criativo 
ADD CONSTRAINT criativo_id_anuncio_externo_unique_constraint 
UNIQUE (id_anuncio_externo);