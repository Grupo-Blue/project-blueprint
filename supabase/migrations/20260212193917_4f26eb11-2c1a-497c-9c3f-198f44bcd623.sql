
-- Adicionar campos de confirmação de envio
ALTER TABLE public.disparo_whatsapp 
  ADD COLUMN IF NOT EXISTS enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_envio timestamptz;
