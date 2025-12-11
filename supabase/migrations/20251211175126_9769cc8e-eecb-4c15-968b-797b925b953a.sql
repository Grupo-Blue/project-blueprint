-- Tabela de configuração de páginas por empresa
CREATE TABLE public.landingpage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  url_pattern TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'landing_page',
  ignorar_conversao BOOLEAN DEFAULT false,
  evento_conversao TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, url_pattern)
);

COMMENT ON TABLE public.landingpage_config IS 'Configuração de categorização de páginas para análise GA4';
COMMENT ON COLUMN public.landingpage_config.categoria IS 'Categorias: landing_page, oferta, sistema, conteudo';
COMMENT ON COLUMN public.landingpage_config.ignorar_conversao IS 'Se true, página é ignorada na análise de conversão';
COMMENT ON COLUMN public.landingpage_config.evento_conversao IS 'Evento específico de conversão (ex: investment_completed)';

-- Adicionar campos na tabela de métricas
ALTER TABLE public.landingpage_metricas 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'landing_page',
ADD COLUMN IF NOT EXISTS ignorar_analise BOOLEAN DEFAULT false;

-- RLS policies
ALTER TABLE public.landingpage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e Tráfego podem gerenciar config LP"
ON public.landingpage_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

CREATE POLICY "Todos podem ver config LP"
ON public.landingpage_config FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_landingpage_config_updated_at
BEFORE UPDATE ON public.landingpage_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações padrão para Tokeniza
INSERT INTO public.landingpage_config (id_empresa, url_pattern, categoria, ignorar_conversao, descricao) VALUES
-- Páginas de Sistema (ignorar)
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/account/*', 'sistema', true, 'Páginas de conta/login'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/wallet/*', 'sistema', true, 'Páginas de carteira'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/profile/*', 'sistema', true, 'Páginas de perfil'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/home', 'sistema', true, 'Home logada'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/settings/*', 'sistema', true, 'Configurações'),
-- Páginas de Oferta (conversão = investimento)
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/crowdfunding/details/*', 'oferta', false, 'Página de detalhes de oferta'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/tokenization/crowdfunding/oportunity/*', 'oferta', false, 'Página de oportunidade'),
-- Landing Pages (conversão padrão)
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/tokeniza-captadores', 'landing_page', false, 'LP Captadores'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/melhor-escolha', 'landing_page', false, 'LP Melhor Escolha'),
('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', '/lp-*', 'landing_page', false, 'Landing Pages gerais');