-- Converter client_key (gerada) em coluna normal com trigger, para permitir merge manual via Revisão de Matches

-- 1) blue_cliente_raw_info
ALTER TABLE public.blue_cliente_raw_info DROP COLUMN client_key;
ALTER TABLE public.blue_cliente_raw_info ADD COLUMN client_key text;
UPDATE public.blue_cliente_raw_info SET client_key = public.blue_client_key(nome_cliente);
CREATE INDEX IF NOT EXISTS idx_blue_raw_info_client_key ON public.blue_cliente_raw_info (client_key);

CREATE OR REPLACE FUNCTION public.tg_blue_raw_info_set_client_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_key IS NULL THEN
    NEW.client_key := public.blue_client_key(NEW.nome_cliente);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_blue_raw_info_set_client_key ON public.blue_cliente_raw_info;
CREATE TRIGGER trg_blue_raw_info_set_client_key
BEFORE INSERT OR UPDATE ON public.blue_cliente_raw_info
FOR EACH ROW EXECUTE FUNCTION public.tg_blue_raw_info_set_client_key();

-- 2) blue_cliente_raw_crm
ALTER TABLE public.blue_cliente_raw_crm DROP COLUMN client_key;
ALTER TABLE public.blue_cliente_raw_crm ADD COLUMN client_key text;
UPDATE public.blue_cliente_raw_crm SET client_key = public.blue_client_key(cliente);
CREATE INDEX IF NOT EXISTS idx_blue_raw_crm_client_key ON public.blue_cliente_raw_crm (client_key);

CREATE OR REPLACE FUNCTION public.tg_blue_raw_crm_set_client_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_key IS NULL THEN
    NEW.client_key := public.blue_client_key(NEW.cliente);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_blue_raw_crm_set_client_key ON public.blue_cliente_raw_crm;
CREATE TRIGGER trg_blue_raw_crm_set_client_key
BEFORE INSERT OR UPDATE ON public.blue_cliente_raw_crm
FOR EACH ROW EXECUTE FUNCTION public.tg_blue_raw_crm_set_client_key();

-- 3) blue_cliente_raw_2026
ALTER TABLE public.blue_cliente_raw_2026 DROP COLUMN client_key;
ALTER TABLE public.blue_cliente_raw_2026 ADD COLUMN client_key text;
UPDATE public.blue_cliente_raw_2026 SET client_key = public.blue_client_key(cliente);
CREATE INDEX IF NOT EXISTS idx_blue_raw_2026_client_key ON public.blue_cliente_raw_2026 (client_key);

CREATE OR REPLACE FUNCTION public.tg_blue_raw_2026_set_client_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_key IS NULL THEN
    NEW.client_key := public.blue_client_key(NEW.cliente);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_blue_raw_2026_set_client_key ON public.blue_cliente_raw_2026;
CREATE TRIGGER trg_blue_raw_2026_set_client_key
BEFORE INSERT OR UPDATE ON public.blue_cliente_raw_2026
FOR EACH ROW EXECUTE FUNCTION public.tg_blue_raw_2026_set_client_key();