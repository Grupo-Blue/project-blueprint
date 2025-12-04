-- Criar ENUM para redes sociais
CREATE TYPE rede_social AS ENUM (
  'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 
  'TIKTOK', 'YOUTUBE', 'TWITTER'
);

-- Criar tabela genérica para métricas de todas as redes sociais
CREATE TABLE public.social_metricas_dia (
  id_metrica UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  rede_social rede_social NOT NULL,
  data DATE NOT NULL,
  seguidores_total INTEGER NOT NULL DEFAULT 0,
  novos_seguidores INTEGER NOT NULL DEFAULT 0,
  visitas_perfil INTEGER NOT NULL DEFAULT 0,
  cliques_website INTEGER NOT NULL DEFAULT 0,
  alcance INTEGER NOT NULL DEFAULT 0,
  impressoes INTEGER NOT NULL DEFAULT 0,
  engajamento INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (id_empresa, rede_social, data)
);

-- Criar índices para consultas frequentes
CREATE INDEX idx_social_metricas_empresa_rede ON public.social_metricas_dia(id_empresa, rede_social);
CREATE INDEX idx_social_metricas_data ON public.social_metricas_dia(data);

-- Enable RLS
ALTER TABLE public.social_metricas_dia ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (mesmas de instagram_metricas_dia)
CREATE POLICY "Sistema pode inserir métricas sociais"
ON public.social_metricas_dia
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar métricas sociais"
ON public.social_metricas_dia
FOR UPDATE
USING (true);

CREATE POLICY "Todos podem ver métricas sociais"
ON public.social_metricas_dia
FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_social_metricas_dia_updated_at
BEFORE UPDATE ON public.social_metricas_dia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();