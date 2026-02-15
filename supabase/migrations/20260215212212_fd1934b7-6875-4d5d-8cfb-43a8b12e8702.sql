
-- Tabela para rastrear progresso de sincronizações paginadas
CREATE TABLE public.sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  tipo_sync TEXT NOT NULL, -- ex: 'metricool_enriquecimento'
  last_cursor JSONB, -- ex: {"dia_offset": 10, "plataforma": "adwords"}
  total_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, running, completed, error
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, tipo_sync)
);

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa (usado por edge functions)
CREATE POLICY "Service role only" ON public.sync_status
  FOR ALL USING (false);
