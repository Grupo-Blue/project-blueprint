
-- Posts orgânicos de todas as redes
CREATE TABLE public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa),
  rede_social TEXT NOT NULL,
  post_id_externo TEXT NOT NULL,
  tipo TEXT,
  data_publicacao TIMESTAMPTZ,
  texto TEXT,
  url_midia TEXT,
  url_post TEXT,
  likes INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  compartilhamentos INTEGER DEFAULT 0,
  salvos INTEGER DEFAULT 0,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  cliques_link INTEGER DEFAULT 0,
  visitas_perfil INTEGER DEFAULT 0,
  engajamento_total INTEGER DEFAULT 0,
  taxa_engajamento NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, post_id_externo)
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social_posts of their companies"
ON public.social_posts FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

-- Demográficos da audiência
CREATE TABLE public.social_audiencia_demografica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa),
  rede_social TEXT NOT NULL,
  data_coleta DATE NOT NULL,
  tipo TEXT NOT NULL,
  label TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  percentual NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, data_coleta, tipo, label)
);

ALTER TABLE public.social_audiencia_demografica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social_audiencia_demografica of their companies"
ON public.social_audiencia_demografica FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

-- Concorrentes via Metricool
CREATE TABLE public.social_concorrentes_metricool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa),
  rede_social TEXT NOT NULL,
  nome_concorrente TEXT NOT NULL,
  username_concorrente TEXT,
  data DATE NOT NULL,
  seguidores INTEGER DEFAULT 0,
  posts_total INTEGER DEFAULT 0,
  engajamento_medio NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, nome_concorrente, data)
);

ALTER TABLE public.social_concorrentes_metricool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social_concorrentes_metricool of their companies"
ON public.social_concorrentes_metricool FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

-- Índices para performance
CREATE INDEX idx_social_posts_empresa_rede ON public.social_posts(id_empresa, rede_social);
CREATE INDEX idx_social_posts_data ON public.social_posts(data_publicacao DESC);
CREATE INDEX idx_social_audiencia_empresa ON public.social_audiencia_demografica(id_empresa, rede_social, tipo);
CREATE INDEX idx_social_concorrentes_empresa ON public.social_concorrentes_metricool(id_empresa, rede_social);

-- Trigger updated_at para social_posts
CREATE TRIGGER update_social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
