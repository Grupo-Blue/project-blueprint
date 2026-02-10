
-- Tabela de métricas de atendimento (Chatblue)
CREATE TABLE public.metricas_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  data DATE NOT NULL,
  tickets_total INT DEFAULT 0,
  tickets_pendentes INT DEFAULT 0,
  tickets_resolvidos INT DEFAULT 0,
  tickets_sla_violado INT DEFAULT 0,
  tickets_ia INT DEFAULT 0,
  tempo_resposta_medio_seg INT,
  tempo_resolucao_medio_seg INT,
  sla_compliance NUMERIC(5,2),
  nps_score INT,
  dados_departamentos JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, data)
);

-- RLS
ALTER TABLE public.metricas_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view metricas_atendimento"
  ON public.metricas_atendimento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage metricas_atendimento"
  ON public.metricas_atendimento FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Novas colunas Chatblue no lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_ticket_id TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_protocolo TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_departamento TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_prioridade TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_sla_violado BOOLEAN DEFAULT false;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_tempo_resolucao_seg INT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS chatblue_atendido_por_ia BOOLEAN DEFAULT false;
