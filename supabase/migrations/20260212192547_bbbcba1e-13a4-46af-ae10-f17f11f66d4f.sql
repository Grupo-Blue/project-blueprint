
-- Tabela de disparos WhatsApp
CREATE TABLE public.disparo_whatsapp (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa),
  nome text NOT NULL,
  descricao text,
  preset_usado text,
  filtros_aplicados jsonb,
  qtd_leads integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de vinculação lead <-> disparo (N:N)
CREATE TABLE public.disparo_whatsapp_lead (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_disparo uuid NOT NULL REFERENCES public.disparo_whatsapp(id) ON DELETE CASCADE,
  id_lead uuid NOT NULL REFERENCES public.lead(id_lead) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id_disparo, id_lead)
);

-- Enable RLS
ALTER TABLE public.disparo_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparo_whatsapp_lead ENABLE ROW LEVEL SECURITY;

-- RLS policies for disparo_whatsapp
CREATE POLICY "Usuarios autenticados podem ver disparos de suas empresas"
ON public.disparo_whatsapp FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'trafego'::app_role) OR
    has_role(auth.uid(), 'sdr'::app_role) OR
    has_role(auth.uid(), 'direcao'::app_role) OR
    EXISTS (
      SELECT 1 FROM user_empresa
      WHERE user_empresa.user_id = auth.uid()
      AND user_empresa.id_empresa = disparo_whatsapp.id_empresa
    )
  )
);

CREATE POLICY "Usuarios podem criar disparos"
ON public.disparo_whatsapp FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'trafego'::app_role) OR
    has_role(auth.uid(), 'sdr'::app_role)
  )
);

CREATE POLICY "Usuarios podem atualizar disparos"
ON public.disparo_whatsapp FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid()
);

CREATE POLICY "Usuarios podem deletar disparos"
ON public.disparo_whatsapp FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid()
);

-- RLS policies for disparo_whatsapp_lead
CREATE POLICY "Ver vinculos de disparos permitidos"
ON public.disparo_whatsapp_lead FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.disparo_whatsapp d
    WHERE d.id = disparo_whatsapp_lead.id_disparo
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'trafego'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role) OR
      has_role(auth.uid(), 'direcao'::app_role) OR
      EXISTS (
        SELECT 1 FROM user_empresa
        WHERE user_empresa.user_id = auth.uid()
        AND user_empresa.id_empresa = d.id_empresa
      )
    )
  )
);

CREATE POLICY "Inserir vinculos de disparos"
ON public.disparo_whatsapp_lead FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.disparo_whatsapp d
    WHERE d.id = disparo_whatsapp_lead.id_disparo
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'trafego'::app_role) OR
      has_role(auth.uid(), 'sdr'::app_role)
    )
  )
);

-- Indexes
CREATE INDEX idx_disparo_whatsapp_empresa ON public.disparo_whatsapp(id_empresa);
CREATE INDEX idx_disparo_whatsapp_lead_disparo ON public.disparo_whatsapp_lead(id_disparo);
CREATE INDEX idx_disparo_whatsapp_lead_lead ON public.disparo_whatsapp_lead(id_lead);
