ALTER TABLE public.lead_segmento 
ADD COLUMN IF NOT EXISTS mautic_segment_id text,
ADD COLUMN IF NOT EXISTS meta_audience_id text;