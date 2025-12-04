-- Adicionar METRICOOL ao enum tipo_integracao
ALTER TYPE tipo_integracao ADD VALUE IF NOT EXISTS 'METRICOOL';

-- Tabela para métricas diárias do Instagram vindas do Metricool
CREATE TABLE public.instagram_metricas_dia (
  id_metrica uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  data date NOT NULL,
  seguidores_total integer NOT NULL DEFAULT 0,
  novos_seguidores integer NOT NULL DEFAULT 0,
  visitas_perfil integer NOT NULL DEFAULT 0,
  cliques_website integer NOT NULL DEFAULT 0,
  alcance integer NOT NULL DEFAULT 0,
  impressoes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, data)
);

-- Tabela para cliques de SmartLinks do Metricool
CREATE TABLE public.smartlink_cliques (
  id_smartlink uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  smartlink_id text NOT NULL,
  smartlink_nome text,
  smartlink_url text,
  data date NOT NULL,
  cliques integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, smartlink_id, data)
);

-- Enable RLS
ALTER TABLE public.instagram_metricas_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlink_cliques ENABLE ROW LEVEL SECURITY;

-- Policies para instagram_metricas_dia
CREATE POLICY "Todos podem ver métricas Instagram"
ON public.instagram_metricas_dia FOR SELECT
USING (true);

CREATE POLICY "Sistema pode inserir métricas Instagram"
ON public.instagram_metricas_dia FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar métricas Instagram"
ON public.instagram_metricas_dia FOR UPDATE
USING (true);

-- Policies para smartlink_cliques
CREATE POLICY "Todos podem ver cliques SmartLinks"
ON public.smartlink_cliques FOR SELECT
USING (true);

CREATE POLICY "Sistema pode inserir cliques SmartLinks"
ON public.smartlink_cliques FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar cliques SmartLinks"
ON public.smartlink_cliques FOR UPDATE
USING (true);

-- Indexes para performance
CREATE INDEX idx_instagram_metricas_empresa_data ON public.instagram_metricas_dia(id_empresa, data);
CREATE INDEX idx_smartlink_cliques_empresa_data ON public.smartlink_cliques(id_empresa, data);