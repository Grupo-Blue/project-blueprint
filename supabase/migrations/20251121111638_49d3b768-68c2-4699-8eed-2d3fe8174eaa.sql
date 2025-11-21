-- Criar bucket para anexos de ações
INSERT INTO storage.buckets (id, name, public)
VALUES ('acao-anexos', 'acao-anexos', false);

-- Políticas de acesso para anexos de ações
CREATE POLICY "Usuários autenticados podem fazer upload de anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'acao-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem visualizar anexos de suas ações"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'acao-anexos');

CREATE POLICY "Usuários podem deletar seus próprios anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'acao-anexos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Adicionar coluna para armazenar URLs dos anexos na tabela acao
ALTER TABLE public.acao ADD COLUMN anexos JSONB DEFAULT '[]'::jsonb;