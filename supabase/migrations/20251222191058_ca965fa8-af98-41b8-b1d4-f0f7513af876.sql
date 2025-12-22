-- Add Stape tracking fields to lead table
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_client_id TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_session_id TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_fbp TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_fbc TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_gclid TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_tempo_total_segundos INTEGER;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_paginas_visitadas JSONB;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_eventos JSONB;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_ip_address TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_user_agent TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_first_visit TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_last_activity TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS stape_referrer TEXT;

-- Create stape_evento table for detailed event logging
CREATE TABLE public.stape_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  session_id TEXT,
  event_name TEXT NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  page_url TEXT,
  page_title TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbp TEXT,
  fbc TEXT,
  gclid TEXT,
  ip_address TEXT,
  user_agent TEXT,
  custom_data JSONB,
  id_lead UUID REFERENCES public.lead(id_lead),
  id_empresa UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_stape_evento_client_id ON public.stape_evento(client_id);
CREATE INDEX idx_stape_evento_event_name ON public.stape_evento(event_name);
CREATE INDEX idx_stape_evento_timestamp ON public.stape_evento(event_timestamp);
CREATE INDEX idx_stape_evento_id_empresa ON public.stape_evento(id_empresa);
CREATE INDEX idx_lead_stape_client_id ON public.lead(stape_client_id);

-- Enable RLS
ALTER TABLE public.stape_evento ENABLE ROW LEVEL SECURITY;

-- RLS policies for stape_evento
CREATE POLICY "Sistema pode inserir stape_evento" 
ON public.stape_evento 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar stape_evento" 
ON public.stape_evento 
FOR UPDATE 
USING (true);

CREATE POLICY "Admin pode ver stape_evento" 
ON public.stape_evento 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trafego pode ver stape_evento" 
ON public.stape_evento 
FOR SELECT 
USING (has_role(auth.uid(), 'trafego'::app_role));