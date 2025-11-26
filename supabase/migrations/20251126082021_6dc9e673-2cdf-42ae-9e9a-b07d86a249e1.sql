-- Criar tabela para métricas diárias de criativos
CREATE TABLE IF NOT EXISTS public.criativo_metricas_dia (
  id_metricas_dia UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_criativo UUID NOT NULL REFERENCES public.criativo(id_criativo) ON DELETE CASCADE,
  data DATE NOT NULL,
  impressoes INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  verba_investida NUMERIC NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_criativo, data)
);

-- Adicionar índices para performance
CREATE INDEX idx_criativo_metricas_dia_id_criativo ON public.criativo_metricas_dia(id_criativo);
CREATE INDEX idx_criativo_metricas_dia_data ON public.criativo_metricas_dia(data);

-- Habilitar RLS
ALTER TABLE public.criativo_metricas_dia ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver métricas de criativos"
  ON public.criativo_metricas_dia
  FOR SELECT
  USING (true);

CREATE POLICY "Sistema pode inserir métricas de criativos"
  ON public.criativo_metricas_dia
  FOR INSERT
  WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.criativo_metricas_dia IS 'Armazena métricas diárias de cada criativo (investimento, impressões, cliques, leads)';