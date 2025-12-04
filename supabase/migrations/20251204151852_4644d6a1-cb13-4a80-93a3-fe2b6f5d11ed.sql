-- Criar tabela empresa_metricas_dia para métricas diárias por empresa
CREATE TABLE IF NOT EXISTS public.empresa_metricas_dia (
  id_metricas_dia uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  data date NOT NULL,
  verba_investida numeric DEFAULT 0,
  leads_total integer DEFAULT 0,
  leads_pagos integer DEFAULT 0,
  mqls integer DEFAULT 0,
  levantadas integer DEFAULT 0,
  reunioes integer DEFAULT 0,
  vendas integer DEFAULT 0,
  valor_vendas numeric DEFAULT 0,
  cpl numeric,
  cac numeric,
  ticket_medio numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(id_empresa, data)
);

-- Habilitar RLS
ALTER TABLE public.empresa_metricas_dia ENABLE ROW LEVEL SECURITY;

-- Política para visualização
CREATE POLICY "Todos podem ver métricas diárias empresa"
ON public.empresa_metricas_dia
FOR SELECT
USING (true);

-- Política para sistema inserir/atualizar
CREATE POLICY "Sistema pode inserir métricas diárias empresa"
ON public.empresa_metricas_dia
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar métricas diárias empresa"
ON public.empresa_metricas_dia
FOR UPDATE
USING (true);

-- Índice para performance
CREATE INDEX idx_empresa_metricas_dia_empresa_data 
ON public.empresa_metricas_dia(id_empresa, data DESC);

-- Trigger para updated_at
CREATE TRIGGER update_empresa_metricas_dia_updated_at
BEFORE UPDATE ON public.empresa_metricas_dia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();