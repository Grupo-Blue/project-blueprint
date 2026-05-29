-- Remove Pipedrive from the project (replaced by Amélia CRM)

-- 1. Add AMELIA to tipo_integracao enum (used by future Amélia integration row, if needed)
ALTER TYPE public.tipo_integracao ADD VALUE IF NOT EXISTS 'AMELIA';

-- 2. Delete Pipedrive integration rows
DELETE FROM public.integracao WHERE tipo = 'PIPEDRIVE';

-- 3. Drop Pipedrive raw tables
DROP TABLE IF EXISTS public.pipedrive_note CASCADE;
DROP TABLE IF EXISTS public.pipedrive_activity CASCADE;

-- 4. Drop url_pipedrive column from lead
ALTER TABLE public.lead DROP COLUMN IF EXISTS url_pipedrive;