ALTER TABLE public.disparo_whatsapp ADD COLUMN IF NOT EXISTS id_campanha_externa text;

CREATE INDEX IF NOT EXISTS idx_disparo_whatsapp_idempotency ON public.disparo_whatsapp (id_campanha_externa, data_envio);