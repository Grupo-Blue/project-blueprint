-- Fase 0: Atualizar leads para apontar para o criativo mais recente (que será mantido)
WITH criativos_a_manter AS (
  SELECT DISTINCT ON (id_anuncio_externo) 
    id_criativo,
    id_anuncio_externo
  FROM criativo 
  WHERE id_anuncio_externo IS NOT NULL
  ORDER BY id_anuncio_externo, created_at DESC
),
mapeamento AS (
  SELECT 
    c.id_criativo as id_antigo,
    m.id_criativo as id_novo
  FROM criativo c
  JOIN criativos_a_manter m ON c.id_anuncio_externo = m.id_anuncio_externo
  WHERE c.id_criativo != m.id_criativo
)
UPDATE lead l
SET id_criativo = m.id_novo
FROM mapeamento m
WHERE l.id_criativo = m.id_antigo;

-- Fase 1: Deletar métricas dos criativos duplicados
WITH criativos_a_manter AS (
  SELECT DISTINCT ON (id_anuncio_externo) 
    id_criativo,
    id_anuncio_externo
  FROM criativo 
  WHERE id_anuncio_externo IS NOT NULL
  ORDER BY id_anuncio_externo, created_at DESC
)
DELETE FROM criativo_metricas_dia 
WHERE id_criativo IN (
  SELECT c.id_criativo
  FROM criativo c
  WHERE c.id_anuncio_externo IS NOT NULL
    AND c.id_criativo NOT IN (SELECT id_criativo FROM criativos_a_manter)
);

-- Fase 2: Deletar criativos duplicados (manter apenas o mais recente por id_anuncio_externo)
DELETE FROM criativo a
USING criativo b
WHERE a.id_anuncio_externo IS NOT NULL
  AND a.id_anuncio_externo = b.id_anuncio_externo
  AND a.created_at < b.created_at;

-- Fase 3: Adicionar constraint UNIQUE em id_anuncio_externo
ALTER TABLE criativo DROP CONSTRAINT IF EXISTS criativo_id_anuncio_externo_unique;

CREATE UNIQUE INDEX criativo_id_anuncio_externo_unique 
ON criativo (id_anuncio_externo) 
WHERE id_anuncio_externo IS NOT NULL;