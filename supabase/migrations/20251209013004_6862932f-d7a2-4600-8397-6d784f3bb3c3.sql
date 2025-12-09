-- Tabela para métricas de landing pages do GA4
CREATE TABLE public.landingpage_metricas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  url TEXT NOT NULL,
  data DATE NOT NULL,
  sessoes INTEGER NOT NULL DEFAULT 0,
  usuarios INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC,
  tempo_medio_segundos NUMERIC,
  conversoes INTEGER NOT NULL DEFAULT 0,
  taxa_conversao NUMERIC,
  pageviews INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, url, data)
);

-- Tabela para conteúdo extraído das landing pages
CREATE TABLE public.landingpage_conteudo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  url TEXT NOT NULL,
  titulo_h1 TEXT,
  subtitulos_h2 TEXT[],
  ctas TEXT[],
  primeiro_paragrafo TEXT,
  meta_description TEXT,
  palavras_chave TEXT[],
  ultima_extracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, url)
);

-- Tabela para análises IA das landing pages
CREATE TABLE public.landingpage_analise (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  data_analise DATE NOT NULL DEFAULT CURRENT_DATE,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  recomendacoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_performers JSONB NOT NULL DEFAULT '[]'::jsonb,
  padroes_identificados JSONB NOT NULL DEFAULT '[]'::jsonb,
  analise_texto TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.landingpage_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landingpage_conteudo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landingpage_analise ENABLE ROW LEVEL SECURITY;

-- Políticas para landingpage_metricas
CREATE POLICY "Todos podem ver métricas LP"
ON public.landingpage_metricas FOR SELECT
USING (true);

CREATE POLICY "Sistema pode inserir métricas LP"
ON public.landingpage_metricas FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar métricas LP"
ON public.landingpage_metricas FOR UPDATE
USING (true);

-- Políticas para landingpage_conteudo
CREATE POLICY "Todos podem ver conteúdo LP"
ON public.landingpage_conteudo FOR SELECT
USING (true);

CREATE POLICY "Sistema pode gerenciar conteúdo LP"
ON public.landingpage_conteudo FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

CREATE POLICY "Sistema pode inserir conteúdo LP"
ON public.landingpage_conteudo FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar conteúdo LP"
ON public.landingpage_conteudo FOR UPDATE
USING (true);

-- Políticas para landingpage_analise
CREATE POLICY "Todos podem ver análises LP"
ON public.landingpage_analise FOR SELECT
USING (true);

CREATE POLICY "Sistema pode inserir análises LP"
ON public.landingpage_analise FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_lp_metricas_empresa_data ON public.landingpage_metricas(id_empresa, data);
CREATE INDEX idx_lp_metricas_url ON public.landingpage_metricas(url);
CREATE INDEX idx_lp_conteudo_empresa ON public.landingpage_conteudo(id_empresa);
CREATE INDEX idx_lp_analise_empresa ON public.landingpage_analise(id_empresa, data_analise);