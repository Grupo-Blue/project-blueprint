-- Add unique constraint on id_lead_externo for upsert operations
ALTER TABLE public.lead ADD CONSTRAINT lead_id_lead_externo_unique UNIQUE (id_lead_externo);