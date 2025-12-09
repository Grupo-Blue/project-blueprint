-- Adicionar coluna telefone à tabela lead para matching por telefone
ALTER TABLE public.lead
ADD COLUMN IF NOT EXISTS telefone text;

-- Criar índice para buscas por telefone
CREATE INDEX IF NOT EXISTS idx_lead_telefone ON public.lead(telefone);

-- Adicionar enum WHATSAPP ao canal_origem se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WHATSAPP' AND enumtypid = 'canal_origem'::regtype) THEN
    ALTER TYPE public.canal_origem ADD VALUE 'WHATSAPP';
  END IF;
END $$;