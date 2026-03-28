ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS mautic_segments jsonb DEFAULT null;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS mautic_do_not_contact boolean DEFAULT false;