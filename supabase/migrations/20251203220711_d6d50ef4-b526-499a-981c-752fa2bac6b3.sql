-- Tabela para armazenar alertas de discrepâncias UTM
CREATE TABLE public.alerta_utm (
  id_alerta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_criativo UUID NOT NULL REFERENCES public.criativo(id_criativo) ON DELETE CASCADE,
  id_campanha UUID NOT NULL REFERENCES public.campanha(id_campanha) ON DELETE CASCADE,
  tipo_discrepancia TEXT NOT NULL,
  url_esperada TEXT,
  url_capturada TEXT,
  detalhes JSONB DEFAULT '{}',
  resolvido BOOLEAN DEFAULT false,
  data_deteccao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_resolucao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_alerta_utm_criativo ON public.alerta_utm(id_criativo);
CREATE INDEX idx_alerta_utm_campanha ON public.alerta_utm(id_campanha);
CREATE INDEX idx_alerta_utm_resolvido ON public.alerta_utm(resolvido);
CREATE INDEX idx_alerta_utm_data ON public.alerta_utm(data_deteccao DESC);

-- Constraint única para evitar alertas duplicados para mesmo criativo/tipo
CREATE UNIQUE INDEX idx_alerta_utm_unico ON public.alerta_utm(id_criativo, tipo_discrepancia) WHERE resolvido = false;

-- Enable RLS
ALTER TABLE public.alerta_utm ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver alertas UTM"
ON public.alerta_utm FOR SELECT
USING (true);

CREATE POLICY "Sistema pode gerenciar alertas UTM"
ON public.alerta_utm FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

CREATE POLICY "Sistema pode inserir alertas UTM"
ON public.alerta_utm FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar alertas UTM"
ON public.alerta_utm FOR UPDATE
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_alerta_utm_updated_at
BEFORE UPDATE ON public.alerta_utm
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();