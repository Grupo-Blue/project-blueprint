-- Fase 3: Pacing de Orçamento e Tempo de Ciclo

-- 1. Adicionar campo de meta mensal de verba na empresa
ALTER TABLE empresa 
ADD COLUMN meta_verba_mensal NUMERIC DEFAULT 0;

-- Atualizar empresas existentes com metas estimadas baseadas no histórico
UPDATE empresa SET meta_verba_mensal = 3000 WHERE nome = 'Blue';
UPDATE empresa SET meta_verba_mensal = 6000 WHERE nome = 'Tokeniza';

-- 2. Adicionar colunas de data de transição no lead
ALTER TABLE lead 
ADD COLUMN data_mql TIMESTAMP WITH TIME ZONE,
ADD COLUMN data_levantou_mao TIMESTAMP WITH TIME ZONE,
ADD COLUMN data_reuniao TIMESTAMP WITH TIME ZONE;

-- 3. Criar índice para queries de ciclo
CREATE INDEX idx_lead_ciclo_datas ON lead(data_criacao, data_mql, data_levantou_mao, data_reuniao, data_venda);

-- 4. Corrigir leads onde data_venda < data_criacao (problema de timezone)
UPDATE lead 
SET data_venda = data_criacao + INTERVAL '1 day'
WHERE venda_realizada = true 
  AND data_venda IS NOT NULL 
  AND data_venda < data_criacao;