
-- 1. Fix lote status constraint to support erro + cancelado
ALTER TABLE irpf_importacao_lote DROP CONSTRAINT irpf_importacao_lote_status_check;
ALTER TABLE irpf_importacao_lote ADD CONSTRAINT irpf_importacao_lote_status_check 
  CHECK (status = ANY (ARRAY['pendente','processando','concluido','erro','cancelado']));

-- 2. Add resilience columns to fila
ALTER TABLE irpf_importacao_fila ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;
ALTER TABLE irpf_importacao_fila ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 3. Fix stuck batch 493cd4f5-7c50-4d28-944a-5091a9f1739f
UPDATE irpf_importacao_fila 
SET status = 'pendente', tentativas = 0, processing_started_at = NULL 
WHERE id_lote = '493cd4f5-7c50-4d28-944a-5091a9f1739f' AND status = 'processando';

UPDATE irpf_importacao_lote 
SET status = 'pendente',
    processados = (SELECT count(*) FROM irpf_importacao_fila WHERE id_lote = '493cd4f5-7c50-4d28-944a-5091a9f1739f' AND status = 'sucesso'),
    erros = (SELECT count(*) FROM irpf_importacao_fila WHERE id_lote = '493cd4f5-7c50-4d28-944a-5091a9f1739f' AND status = 'erro')
WHERE id = '493cd4f5-7c50-4d28-944a-5091a9f1739f';
