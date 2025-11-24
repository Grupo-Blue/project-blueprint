-- Adicionar constraint única para permitir upsert de leads
-- Permite múltiplos leads com id_lead_externo NULL, mas garante unicidade quando não é NULL
CREATE UNIQUE INDEX IF NOT EXISTS lead_id_externo_empresa_unique 
ON lead (id_lead_externo, id_empresa) 
WHERE id_lead_externo IS NOT NULL;