
-- Sprint 1: Fundação Dashboard Comercial V3

-- 1. Novos campos na tabela lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS proprietario_nome text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS proprietario_id text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS tempo_primeira_resposta_seg integer;

-- 2. Adicionar campo tipo_negocio em empresa_metricas_dia
ALTER TABLE public.empresa_metricas_dia ADD COLUMN IF NOT EXISTS tipo_negocio text NOT NULL DEFAULT 'total';

-- Remover constraint unique antiga e criar nova incluindo tipo_negocio
ALTER TABLE public.empresa_metricas_dia DROP CONSTRAINT IF EXISTS empresa_metricas_dia_id_empresa_data_key;
ALTER TABLE public.empresa_metricas_dia ADD CONSTRAINT empresa_metricas_dia_id_empresa_data_tipo_key UNIQUE (id_empresa, data, tipo_negocio);

-- 3. Criar tabela meta_comercial
CREATE TABLE IF NOT EXISTS public.meta_comercial (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  tipo_negocio text NOT NULL DEFAULT 'total',
  meta_receita numeric DEFAULT 0,
  meta_vendas integer DEFAULT 0,
  meta_leads integer DEFAULT 0,
  indice_sazonal numeric DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, ano, mes, tipo_negocio)
);

-- RLS para meta_comercial
ALTER TABLE public.meta_comercial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler metas"
  ON public.meta_comercial FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem inserir metas"
  ON public.meta_comercial FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.perfil = 'ADMIN'
    )
  );

CREATE POLICY "Admins podem atualizar metas"
  ON public.meta_comercial FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.perfil = 'ADMIN'
    )
  );

CREATE POLICY "Admins podem deletar metas"
  ON public.meta_comercial FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.perfil = 'ADMIN'
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_proprietario ON public.lead(proprietario_nome);
CREATE INDEX IF NOT EXISTS idx_lead_motivo_perda ON public.lead(motivo_perda) WHERE motivo_perda IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_tempo_resposta ON public.lead(tempo_primeira_resposta_seg) WHERE tempo_primeira_resposta_seg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_empresa_metricas_dia_tipo ON public.empresa_metricas_dia(id_empresa, data, tipo_negocio);
CREATE INDEX IF NOT EXISTS idx_meta_comercial_empresa ON public.meta_comercial(id_empresa, ano, mes);
