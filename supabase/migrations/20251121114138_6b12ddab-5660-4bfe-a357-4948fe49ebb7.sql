-- Add anexos column to hipotese_teste table
ALTER TABLE public.hipotese_teste ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;

-- Add anexos column to aprendizado_semana table
ALTER TABLE public.aprendizado_semana ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for hipoteses and aprendizados attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hipoteses-aprendizados-anexos', 'hipoteses-aprendizados-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the storage bucket
DROP POLICY IF EXISTS "Upload anexos hipoteses aprendizados" ON storage.objects;
CREATE POLICY "Upload anexos hipoteses aprendizados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hipoteses-aprendizados-anexos');

DROP POLICY IF EXISTS "View anexos hipoteses aprendizados" ON storage.objects;
CREATE POLICY "View anexos hipoteses aprendizados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'hipoteses-aprendizados-anexos');

DROP POLICY IF EXISTS "Delete anexos hipoteses aprendizados" ON storage.objects;
CREATE POLICY "Delete anexos hipoteses aprendizados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hipoteses-aprendizados-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);