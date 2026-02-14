
-- Nova coluna para vinculação direta lead -> campanha
ALTER TABLE public.lead ADD COLUMN id_campanha_vinculada UUID REFERENCES public.campanha(id_campanha);

-- Índice para performance
CREATE INDEX idx_lead_campanha_vinculada ON public.lead(id_campanha_vinculada);

-- Backfill 1: Via id_criativo (herdar campanha do criativo)
UPDATE public.lead SET id_campanha_vinculada = cr.id_campanha
FROM public.criativo cr 
WHERE lead.id_criativo = cr.id_criativo 
AND lead.id_campanha_vinculada IS NULL;

-- Backfill 2: Via utm_campaign = id_campanha_externo
UPDATE public.lead SET id_campanha_vinculada = c.id_campanha
FROM public.campanha c 
WHERE lead.utm_campaign = c.id_campanha_externo
AND lead.id_campanha_vinculada IS NULL 
AND lead.utm_campaign IS NOT NULL;

-- Backfill 3: Via utm_campaign = nome da campanha
UPDATE public.lead SET id_campanha_vinculada = c.id_campanha
FROM public.campanha c 
WHERE lead.utm_campaign = c.nome
AND lead.id_campanha_vinculada IS NULL 
AND lead.utm_campaign IS NOT NULL;

-- Função de vinculação automática para novos leads
CREATE OR REPLACE FUNCTION public.vincular_lead_campanha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só processar se id_campanha_vinculada ainda é NULL
  IF NEW.id_campanha_vinculada IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Estratégia 1: Via id_criativo
  IF NEW.id_criativo IS NOT NULL THEN
    SELECT cr.id_campanha INTO NEW.id_campanha_vinculada
    FROM public.criativo cr
    WHERE cr.id_criativo = NEW.id_criativo;
    
    IF NEW.id_campanha_vinculada IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Estratégia 2: Via utm_campaign = id_campanha_externo
  IF NEW.utm_campaign IS NOT NULL THEN
    SELECT c.id_campanha INTO NEW.id_campanha_vinculada
    FROM public.campanha c
    WHERE c.id_campanha_externo = NEW.utm_campaign
    LIMIT 1;
    
    IF NEW.id_campanha_vinculada IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Estratégia 3: Via utm_campaign = nome da campanha
    SELECT c.id_campanha INTO NEW.id_campanha_vinculada
    FROM public.campanha c
    WHERE c.nome = NEW.utm_campaign
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE para vincular automaticamente
CREATE TRIGGER trg_vincular_lead_campanha
BEFORE INSERT OR UPDATE OF id_criativo, utm_campaign
ON public.lead
FOR EACH ROW
EXECUTE FUNCTION public.vincular_lead_campanha();
