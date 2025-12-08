-- Create enums for campaign demands
CREATE TYPE public.status_demanda AS ENUM ('PENDENTE', 'EM_EXECUCAO', 'EXECUTADA', 'VERIFICADA', 'REJEITADA');
CREATE TYPE public.plataforma_ads AS ENUM ('META', 'GOOGLE');
CREATE TYPE public.tipo_campanha_meta AS ENUM ('CONVERSAO', 'TRAFEGO', 'LEAD_GEN', 'AWARENESS', 'ENGAJAMENTO');
CREATE TYPE public.tipo_campanha_google AS ENUM ('SEARCH', 'DISPLAY', 'PERFORMANCE_MAX', 'VIDEO', 'SHOPPING');
CREATE TYPE public.prioridade_demanda AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- Create demanda_campanha table
CREATE TABLE public.demanda_campanha (
  id_demanda UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  id_criador UUID NOT NULL,
  id_executor UUID,
  
  -- Campos base
  titulo VARCHAR NOT NULL,
  descricao TEXT,
  plataforma public.plataforma_ads NOT NULL,
  prioridade public.prioridade_demanda DEFAULT 'MEDIA',
  
  -- Campos Meta Ads
  meta_tipo_campanha public.tipo_campanha_meta,
  meta_objetivo VARCHAR,
  meta_publico_alvo TEXT,
  meta_idade_min INTEGER,
  meta_idade_max INTEGER,
  meta_genero VARCHAR,
  meta_interesses TEXT[],
  meta_localizacoes TEXT[],
  meta_posicionamentos TEXT[],
  
  -- Campos Google Ads
  google_tipo_campanha public.tipo_campanha_google,
  google_palavras_chave TEXT[],
  google_palavras_negativas TEXT[],
  google_tipo_correspondencia VARCHAR,
  google_extensoes TEXT[],
  
  -- Orçamento
  verba_diaria NUMERIC,
  verba_total NUMERIC,
  data_inicio DATE,
  data_fim DATE,
  
  -- Criativos e LPs
  criativos JSONB DEFAULT '[]',
  landing_pages TEXT[],
  teste_ab_paginas BOOLEAN DEFAULT false,
  
  -- UTMs sugeridos
  utm_source VARCHAR,
  utm_medium VARCHAR,
  utm_campaign VARCHAR,
  utm_content VARCHAR,
  
  -- Workflow
  status public.status_demanda DEFAULT 'PENDENTE',
  id_campanha_criada VARCHAR,
  observacoes_executor TEXT,
  
  -- Verificação
  verificada BOOLEAN DEFAULT false,
  data_verificacao TIMESTAMPTZ,
  resultado_verificacao TEXT,
  
  -- Sugestão IA
  sugerida_por_ia BOOLEAN DEFAULT false,
  contexto_ia JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demanda_campanha ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Direção e Admin podem ver todas as demandas
CREATE POLICY "Direção e Admin podem ver demandas" ON public.demanda_campanha
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role) OR
  has_role(auth.uid(), 'trafego'::app_role)
);

-- Direção e Admin podem criar demandas
CREATE POLICY "Direção e Admin podem criar demandas" ON public.demanda_campanha
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role)
);

-- Direção, Admin e Tráfego podem atualizar demandas
CREATE POLICY "Roles autorizados podem atualizar demandas" ON public.demanda_campanha
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role) OR
  has_role(auth.uid(), 'trafego'::app_role)
);

-- Direção e Admin podem deletar demandas
CREATE POLICY "Direção e Admin podem deletar demandas" ON public.demanda_campanha
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role)
);

-- Trigger para updated_at
CREATE TRIGGER update_demanda_campanha_updated_at
BEFORE UPDATE ON public.demanda_campanha
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();