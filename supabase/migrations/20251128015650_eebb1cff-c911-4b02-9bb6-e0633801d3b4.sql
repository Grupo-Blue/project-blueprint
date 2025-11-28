-- Adicionar campo url_midia na tabela criativo para armazenar URL direta da imagem/vídeo
ALTER TABLE public.criativo
ADD COLUMN url_midia TEXT;