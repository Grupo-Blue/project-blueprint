
-- Enum for identifier types
CREATE TYPE public.identifier_type AS ENUM (
  'email', 'phone', 'cookie_id', 'session_id', 'fbp', 'fbc', 
  'gclid', 'gbraid', 'mautic_id', 'pipedrive_id', 'tokeniza_id', 
  'cpf', 'linkedin_url', 'device_id'
);

-- Enum for event categories
CREATE TYPE public.event_category AS ENUM (
  'page_view', 'view_content', 'lead', 'qualify_lead', 
  'schedule_call', 'purchase', 'revenue_event', 'custom'
);

-- Identity Graph table
CREATE TABLE public.identity_graph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lead UUID REFERENCES public.lead(id_lead) ON DELETE SET NULL,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  identifier_type public.identifier_type NOT NULL,
  identifier_value TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 1.0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(identifier_type, identifier_value)
);

CREATE INDEX idx_identity_graph_lead ON public.identity_graph(id_lead);
CREATE INDEX idx_identity_graph_empresa ON public.identity_graph(id_empresa);
CREATE INDEX idx_identity_graph_lookup ON public.identity_graph(identifier_type, identifier_value);

-- Lead Segmento table
CREATE TABLE public.lead_segmento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  regras JSONB NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Segmento Membro table
CREATE TABLE public.lead_segmento_membro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lead UUID NOT NULL REFERENCES public.lead(id_lead) ON DELETE CASCADE,
  id_segmento UUID NOT NULL REFERENCES public.lead_segmento(id) ON DELETE CASCADE,
  adicionado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  removido_em TIMESTAMPTZ,
  UNIQUE(id_lead, id_segmento)
);

CREATE INDEX idx_segmento_membro_lead ON public.lead_segmento_membro(id_lead);
CREATE INDEX idx_segmento_membro_segmento ON public.lead_segmento_membro(id_segmento);

-- Add event_category to stape_evento
ALTER TABLE public.stape_evento ADD COLUMN IF NOT EXISTS event_category public.event_category;

-- RLS for identity_graph
ALTER TABLE public.identity_graph ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all identities" ON public.identity_graph
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own company identities" ON public.identity_graph
  FOR SELECT TO authenticated
  USING (
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

-- RLS for lead_segmento
ALTER TABLE public.lead_segmento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all segments" ON public.lead_segmento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own company segments" ON public.lead_segmento
  FOR SELECT TO authenticated
  USING (
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

-- RLS for lead_segmento_membro
ALTER TABLE public.lead_segmento_membro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all segment members" ON public.lead_segmento_membro
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own company segment members" ON public.lead_segmento_membro
  FOR SELECT TO authenticated
  USING (
    id_segmento IN (
      SELECT id FROM public.lead_segmento 
      WHERE id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    )
  );
