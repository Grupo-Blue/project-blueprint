-- Add unique constraint on id_lead,etapa for lead_evento upsert operations
ALTER TABLE public.lead_evento ADD CONSTRAINT lead_evento_id_lead_etapa_unique UNIQUE (id_lead, etapa);