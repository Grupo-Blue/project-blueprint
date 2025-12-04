-- Adicionar campos para controle de merge na tabela lead
ALTER TABLE lead ADD COLUMN IF NOT EXISTS merged boolean DEFAULT false;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS merged_into_lead_id uuid REFERENCES lead(id_lead);
ALTER TABLE lead ADD COLUMN IF NOT EXISTS merged_at timestamp with time zone;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS merged_by uuid;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_merged ON lead(merged) WHERE merged = true;
CREATE INDEX IF NOT EXISTS idx_lead_email_duplicates ON lead(email) WHERE email IS NOT NULL AND (merged IS NULL OR merged = false);