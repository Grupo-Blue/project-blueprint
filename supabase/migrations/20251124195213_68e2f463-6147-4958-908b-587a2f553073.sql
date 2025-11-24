-- Remove o índice parcial anterior
DROP INDEX IF EXISTS public.lead_id_externo_empresa_unique;

-- Cria um constraint UNIQUE sem a cláusula WHERE
ALTER TABLE public.lead 
ADD CONSTRAINT lead_id_lead_externo_id_empresa_key 
UNIQUE (id_lead_externo, id_empresa);