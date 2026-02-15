
-- Criar bucket público para thumbnails permanentes de criativos
INSERT INTO storage.buckets (id, name, public)
VALUES ('criativos-media', 'criativos-media', true);

-- Permitir leitura pública (imagens de anúncios não são sensíveis)
CREATE POLICY "Criativos media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'criativos-media');

-- Permitir upload via service role (edge functions)
CREATE POLICY "Criativos media service upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'criativos-media');

-- Permitir update via service role
CREATE POLICY "Criativos media service update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'criativos-media');
