-- Adicionar constraint unique no id_criativo_externo para permitir upsert
ALTER TABLE criativo ADD CONSTRAINT criativo_id_criativo_externo_key UNIQUE (id_criativo_externo);