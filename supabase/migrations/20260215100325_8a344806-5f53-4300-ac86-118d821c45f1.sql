-- Tabela para keywords do Google Ads via Metricool
CREATE TABLE public.google_ads_keyword (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  id_campanha UUID REFERENCES public.campanha(id_campanha),
  keyword TEXT NOT NULL,
  match_type TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spent NUMERIC(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  cpc NUMERIC(8,2) DEFAULT 0,
  ctr NUMERIC(8,4) DEFAULT 0,
  quality_score INTEGER,
  campaign_name TEXT,
  campaign_id_externo TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas comuns
CREATE INDEX idx_gads_keyword_empresa ON public.google_ads_keyword(id_empresa);
CREATE INDEX idx_gads_keyword_campanha ON public.google_ads_keyword(id_campanha);
CREATE INDEX idx_gads_keyword_data ON public.google_ads_keyword(data_inicio, data_fim);
CREATE UNIQUE INDEX idx_gads_keyword_unique ON public.google_ads_keyword(id_empresa, keyword, campaign_id_externo, data_inicio, data_fim);

-- RLS
ALTER TABLE public.google_ads_keyword ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver keywords da empresa"
ON public.google_ads_keyword FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = google_ads_keyword.id_empresa
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger updated_at
CREATE TRIGGER update_google_ads_keyword_updated_at
BEFORE UPDATE ON public.google_ads_keyword
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
