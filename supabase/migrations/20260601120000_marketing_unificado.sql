-- ============================================================
-- Marketing unificado: Mautic emails + GSC + Blog + Atribuição
-- ============================================================

-- ENUMs novos (ALTER TYPE precisa rodar fora de transação BEGIN/COMMIT em alguns clientes;
-- Supabase aplica cada statement de forma autocommit, então funciona)
ALTER TYPE public.canal_origem ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE public.canal_origem ADD VALUE IF NOT EXISTS 'SOCIAL_ORGANICO';
ALTER TYPE public.canal_origem ADD VALUE IF NOT EXISTS 'DIRETO';

ALTER TYPE public.tipo_integracao ADD VALUE IF NOT EXISTS 'GSC';
ALTER TYPE public.tipo_integracao ADD VALUE IF NOT EXISTS 'WORDPRESS';

-- ============================================================
-- E-mail Marketing (Mautic)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_campanha (
  id_email_campanha UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  id_externo VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  assunto TEXT,
  status VARCHAR(50),
  tipo VARCHAR(50),
  data_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_empresa, id_externo)
);
COMMENT ON TABLE public.email_campanha IS 'Campanhas de e-mail (Mautic /api/emails) por empresa.';
COMMENT ON COLUMN public.email_campanha.tipo IS 'campaign | template | automation';
COMMENT ON COLUMN public.email_campanha.status IS 'enviada | agendada | rascunho';

CREATE TABLE IF NOT EXISTS public.email_metricas_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_email_campanha UUID NOT NULL REFERENCES public.email_campanha(id_email_campanha) ON DELETE CASCADE,
  data DATE NOT NULL,
  enviados INTEGER NOT NULL DEFAULT 0,
  entregues INTEGER NOT NULL DEFAULT 0,
  abertos INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  bounces_hard INTEGER NOT NULL DEFAULT 0,
  bounces_soft INTEGER NOT NULL DEFAULT 0,
  descadastros INTEGER NOT NULL DEFAULT 0,
  leads_gerados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_email_campanha, data)
);
CREATE INDEX IF NOT EXISTS idx_email_metricas_dia_data ON public.email_metricas_dia(data);

CREATE TABLE IF NOT EXISTS public.email_fluxo (
  id_email_fluxo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  id_externo VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  contatos_no_fluxo INTEGER NOT NULL DEFAULT 0,
  taxa_abertura NUMERIC,
  taxa_cliques NUMERIC,
  conversoes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_empresa, id_externo)
);
COMMENT ON TABLE public.email_fluxo IS 'Automações/fluxos do Mautic (/api/campaigns).';

-- ============================================================
-- Blog / Conteúdo (WordPress)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artigo (
  id_artigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  id_externo VARCHAR(100) NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  slug VARCHAR(255),
  data_publicacao TIMESTAMPTZ,
  autor VARCHAR(255),
  palavra_chave_alvo VARCHAR(255),
  categorias TEXT[],
  status VARCHAR(50) DEFAULT 'publish',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_empresa, id_externo)
);
CREATE INDEX IF NOT EXISTS idx_artigo_empresa ON public.artigo(id_empresa);
CREATE INDEX IF NOT EXISTS idx_artigo_url ON public.artigo(url);

CREATE TABLE IF NOT EXISTS public.artigo_metricas_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_artigo UUID NOT NULL REFERENCES public.artigo(id_artigo) ON DELETE CASCADE,
  data DATE NOT NULL,
  sessoes INTEGER NOT NULL DEFAULT 0,
  usuarios INTEGER NOT NULL DEFAULT 0,
  tempo_medio_seg INTEGER,
  bounce_rate NUMERIC,
  impressoes_organicas INTEGER NOT NULL DEFAULT 0,
  cliques_organicos INTEGER NOT NULL DEFAULT 0,
  ctr_organico NUMERIC,
  posicao_media NUMERIC,
  leads_gerados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_artigo, data)
);
CREATE INDEX IF NOT EXISTS idx_artigo_metricas_data ON public.artigo_metricas_dia(data);

-- ============================================================
-- Google Search Console
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gsc_metricas_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  data DATE NOT NULL,
  url TEXT NOT NULL,
  query TEXT, -- NULL = agregado por URL
  impressoes INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC,
  posicao_media NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- UNIQUE com query=NULL requer índice expressão. Usar coalesce para tornar query estável.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_metricas_unique
  ON public.gsc_metricas_dia(id_empresa, data, url, COALESCE(query, ''));
CREATE INDEX IF NOT EXISTS idx_gsc_metricas_data ON public.gsc_metricas_dia(data);
CREATE INDEX IF NOT EXISTS idx_gsc_metricas_url ON public.gsc_metricas_dia(url);

-- ============================================================
-- Atribuição multi-toque
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_touchpoint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_lead UUID NOT NULL REFERENCES public.lead(id_lead) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  url_origem TEXT,
  referrer TEXT,
  fonte VARCHAR(50),
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN public.lead_touchpoint.fonte IS 'cookie_first_touch | cookie_history | form_submit | webhook';
CREATE INDEX IF NOT EXISTS idx_lead_touchpoint_lead_ordem ON public.lead_touchpoint(id_lead, ordem);

-- ============================================================
-- Lead: campos de atribuição + vínculo a artigo
-- ============================================================

ALTER TABLE public.lead
  ADD COLUMN IF NOT EXISTS first_touch_utm_source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_touch_utm_medium VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_touch_utm_campaign VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_touch_utm_content VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_touch_canal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS first_touch_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_touch_canal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS total_toques INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS atribuicao_linear JSONB,
  ADD COLUMN IF NOT EXISTS id_artigo UUID REFERENCES public.artigo(id_artigo) ON DELETE SET NULL;

COMMENT ON COLUMN public.lead.first_touch_canal IS 'Canal do primeiro toque rastreado (cookie 30d).';
COMMENT ON COLUMN public.lead.atribuicao_linear IS 'JSON { canal: peso } onde sum = 1.0, calculado de lead_touchpoint.';

-- ============================================================
-- Landing Page: coluna `conversoes_evento` separada do `conversoes` nativo
-- ============================================================

ALTER TABLE public.landingpage_metricas
  ADD COLUMN IF NOT EXISTS conversoes_evento INTEGER;
COMMENT ON COLUMN public.landingpage_metricas.conversoes_evento IS
  'Contagem do evento configurado em landingpage_config.evento_conversao. Independe do flag "marcado como conversão" do GA4.';

-- ============================================================
-- Encurtador + histórico UTM
-- ============================================================

CREATE TABLE IF NOT EXISTS public.link_curto (
  id_link_curto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  codigo VARCHAR(12) NOT NULL UNIQUE,
  url_destino TEXT NOT NULL,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  cliques INTEGER NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_link_curto_codigo ON public.link_curto(codigo);

CREATE TABLE IF NOT EXISTS public.link_utm_gerado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  url_destino TEXT NOT NULL,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  canal VARCHAR(50),
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_link_utm_gerado_empresa ON public.link_utm_gerado(id_empresa, created_at DESC);

-- ============================================================
-- Empresa: threshold de cobertura UTM
-- ============================================================

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS utm_cobertura_minima INTEGER DEFAULT 80;

-- ============================================================
-- View Funil Unificado de Marketing (3 modelos de atribuição)
-- ============================================================

CREATE OR REPLACE VIEW public.vw_funil_marketing
WITH (security_invoker = true) AS
SELECT
  l.id_empresa,
  DATE_TRUNC('month', l.data_criacao)::date AS mes,
  COALESCE(l.last_touch_canal, l.origem_canal::text, 'DESCONHECIDO') AS canal_last,
  COALESCE(l.first_touch_canal, l.origem_canal::text, 'DESCONHECIDO') AS canal_first,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE l.is_mql) AS mqls,
  COUNT(*) FILTER (WHERE l.levantou_mao) AS levantadas,
  COUNT(*) FILTER (WHERE l.tem_reuniao) AS reunioes,
  COUNT(*) FILTER (WHERE l.venda_realizada) AS vendas,
  COALESCE(SUM(l.valor_venda) FILTER (WHERE l.venda_realizada), 0) AS receita
FROM public.lead l
WHERE l.merged = false OR l.merged IS NULL
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.vw_funil_marketing IS
  'Funil unificado com 2 dimensões de canal: canal_last (último toque) e canal_first (primeiro toque). Modelo linear consultado direto de lead.atribuicao_linear.';

-- ============================================================
-- RLS / políticas
-- ============================================================

ALTER TABLE public.email_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_metricas_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_fluxo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigo_metricas_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_metricas_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_touchpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_curto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_utm_gerado ENABLE ROW LEVEL SECURITY;

-- Política: ver dados das empresas que o usuário tem acesso (mesmo padrão de integracao_select_policy)
CREATE POLICY email_campanha_select ON public.email_campanha FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );
CREATE POLICY email_metricas_select ON public.email_metricas_dia FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_email_campanha IN (
      SELECT id_email_campanha FROM public.email_campanha
      WHERE id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    )
  );
CREATE POLICY email_fluxo_select ON public.email_fluxo FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );
CREATE POLICY artigo_select ON public.artigo FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );
CREATE POLICY artigo_metricas_select ON public.artigo_metricas_dia FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_artigo IN (
      SELECT id_artigo FROM public.artigo
      WHERE id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    )
  );
CREATE POLICY gsc_metricas_select ON public.gsc_metricas_dia FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );
CREATE POLICY lead_touchpoint_select ON public.lead_touchpoint FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_lead IN (
      SELECT id_lead FROM public.lead
      WHERE id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    )
  );
CREATE POLICY link_curto_select ON public.link_curto FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );
CREATE POLICY link_utm_gerado_select ON public.link_utm_gerado FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    id_empresa IS NULL OR
    id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

-- Insert/Update apenas admin e tráfego (igual padrão landingpage_config)
CREATE POLICY email_campanha_admin ON public.email_campanha FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY email_metricas_admin ON public.email_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY email_fluxo_admin ON public.email_fluxo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY artigo_admin ON public.artigo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY artigo_metricas_admin ON public.artigo_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY gsc_metricas_admin ON public.gsc_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY lead_touchpoint_admin ON public.lead_touchpoint FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY link_curto_admin ON public.link_curto FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
CREATE POLICY link_utm_gerado_admin ON public.link_utm_gerado FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

-- Triggers updated_at
CREATE TRIGGER update_email_campanha_updated_at
  BEFORE UPDATE ON public.email_campanha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_fluxo_updated_at
  BEFORE UPDATE ON public.email_fluxo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_artigo_updated_at
  BEFORE UPDATE ON public.artigo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
