
-- ========================================
-- Fase 1: Campos LinkedIn na tabela lead
-- ========================================
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_cargo TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_empresa TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_setor TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_senioridade TEXT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_conexoes INT;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS linkedin_ultima_atualizacao TIMESTAMPTZ;

-- ========================================
-- Fase 2: Tabela concorrente_anuncio
-- ========================================
CREATE TABLE IF NOT EXISTS public.concorrente_anuncio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  concorrente_nome TEXT NOT NULL,
  plataforma TEXT NOT NULL DEFAULT 'META',
  ad_id_externo TEXT,
  titulo TEXT,
  texto_corpo TEXT,
  url_destino TEXT,
  url_midia TEXT,
  data_inicio_veiculo DATE,
  data_detectado TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ATIVO',
  impressoes_estimadas INT,
  metadados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.concorrente_anuncio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver anúncios de concorrentes"
  ON public.concorrente_anuncio FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas admins podem inserir anúncios de concorrentes"
  ON public.concorrente_anuncio FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar anúncios de concorrentes"
  ON public.concorrente_anuncio FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar anúncios de concorrentes"
  ON public.concorrente_anuncio FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_concorrente_anuncio_updated_at
  BEFORE UPDATE ON public.concorrente_anuncio
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Fase 3: Tabela tendencia_mercado
-- ========================================
CREATE TABLE IF NOT EXISTS public.tendencia_mercado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte TEXT NOT NULL,
  titulo TEXT NOT NULL,
  resumo TEXT,
  url TEXT NOT NULL,
  data_publicacao TIMESTAMPTZ,
  categorias TEXT[] DEFAULT '{}',
  relevancia_score INT DEFAULT 0,
  empresas_relacionadas TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tendencia_mercado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver tendências"
  ON public.tendencia_mercado FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas admins podem inserir tendências"
  ON public.tendencia_mercado FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar tendências"
  ON public.tendencia_mercado FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tendencia_mercado_updated_at
  BEFORE UPDATE ON public.tendencia_mercado
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Tabela de configuração de concorrentes por empresa
-- ========================================
CREATE TABLE IF NOT EXISTS public.concorrente_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  nome_concorrente TEXT NOT NULL,
  facebook_page_name TEXT,
  linkedin_page_url TEXT,
  google_advertiser_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, nome_concorrente)
);

ALTER TABLE public.concorrente_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver config de concorrentes"
  ON public.concorrente_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas admins podem gerenciar config de concorrentes"
  ON public.concorrente_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_concorrente_config_updated_at
  BEFORE UPDATE ON public.concorrente_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
