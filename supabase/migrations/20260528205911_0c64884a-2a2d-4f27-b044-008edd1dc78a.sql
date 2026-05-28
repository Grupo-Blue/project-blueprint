-- ============================================================
-- Marketing unificado: Mautic emails + GSC + Blog + Atribuição
-- ============================================================

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

-- ============================================================
-- Blog / WordPress
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
-- GSC
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gsc_metricas_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  data DATE NOT NULL,
  url TEXT NOT NULL,
  query TEXT,
  impressoes INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC,
  posicao_media NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
CREATE INDEX IF NOT EXISTS idx_lead_touchpoint_lead_ordem ON public.lead_touchpoint(id_lead, ordem);

-- ============================================================
-- Lead: atribuição + vínculo a artigo
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

ALTER TABLE public.landingpage_metricas
  ADD COLUMN IF NOT EXISTS conversoes_evento INTEGER;

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

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS utm_cobertura_minima INTEGER DEFAULT 80;

-- ============================================================
-- View vw_funil_marketing
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

-- ============================================================
-- GRANTs (obrigatórios — faltavam no PR original)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campanha TO authenticated;
GRANT ALL ON public.email_campanha TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_metricas_dia TO authenticated;
GRANT ALL ON public.email_metricas_dia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_fluxo TO authenticated;
GRANT ALL ON public.email_fluxo TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artigo TO authenticated;
GRANT ALL ON public.artigo TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artigo_metricas_dia TO authenticated;
GRANT ALL ON public.artigo_metricas_dia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsc_metricas_dia TO authenticated;
GRANT ALL ON public.gsc_metricas_dia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_touchpoint TO authenticated;
GRANT ALL ON public.lead_touchpoint TO service_role;
GRANT SELECT ON public.link_curto TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_curto TO authenticated;
GRANT ALL ON public.link_curto TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_utm_gerado TO authenticated;
GRANT ALL ON public.link_utm_gerado TO service_role;
GRANT SELECT ON public.vw_funil_marketing TO authenticated;

-- ============================================================
-- RLS
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

DROP POLICY IF EXISTS email_campanha_select ON public.email_campanha;
CREATE POLICY email_campanha_select ON public.email_campanha FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = email_campanha.id_empresa));

DROP POLICY IF EXISTS email_metricas_select ON public.email_metricas_dia;
CREATE POLICY email_metricas_select ON public.email_metricas_dia FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.email_campanha c
    JOIN public.user_empresa ue ON ue.id_empresa = c.id_empresa
    WHERE c.id_email_campanha = email_metricas_dia.id_email_campanha AND ue.user_id = auth.uid()));

DROP POLICY IF EXISTS email_fluxo_select ON public.email_fluxo;
CREATE POLICY email_fluxo_select ON public.email_fluxo FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = email_fluxo.id_empresa));

DROP POLICY IF EXISTS artigo_select ON public.artigo;
CREATE POLICY artigo_select ON public.artigo FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = artigo.id_empresa));

DROP POLICY IF EXISTS artigo_metricas_select ON public.artigo_metricas_dia;
CREATE POLICY artigo_metricas_select ON public.artigo_metricas_dia FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.artigo a
    JOIN public.user_empresa ue ON ue.id_empresa = a.id_empresa
    WHERE a.id_artigo = artigo_metricas_dia.id_artigo AND ue.user_id = auth.uid()));

DROP POLICY IF EXISTS gsc_metricas_select ON public.gsc_metricas_dia;
CREATE POLICY gsc_metricas_select ON public.gsc_metricas_dia FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = gsc_metricas_dia.id_empresa));

DROP POLICY IF EXISTS lead_touchpoint_select ON public.lead_touchpoint;
CREATE POLICY lead_touchpoint_select ON public.lead_touchpoint FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.lead l
    JOIN public.user_empresa ue ON ue.id_empresa = l.id_empresa
    WHERE l.id_lead = lead_touchpoint.id_lead AND ue.user_id = auth.uid()));

DROP POLICY IF EXISTS link_curto_select ON public.link_curto;
CREATE POLICY link_curto_select ON public.link_curto FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = link_curto.id_empresa));

DROP POLICY IF EXISTS link_utm_gerado_select ON public.link_utm_gerado;
CREATE POLICY link_utm_gerado_select ON public.link_utm_gerado FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IS NULL OR EXISTS (
    SELECT 1 FROM public.user_empresa ue
    WHERE ue.user_id = auth.uid() AND ue.id_empresa = link_utm_gerado.id_empresa));

DROP POLICY IF EXISTS email_campanha_admin ON public.email_campanha;
CREATE POLICY email_campanha_admin ON public.email_campanha FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS email_metricas_admin ON public.email_metricas_dia;
CREATE POLICY email_metricas_admin ON public.email_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS email_fluxo_admin ON public.email_fluxo;
CREATE POLICY email_fluxo_admin ON public.email_fluxo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS artigo_admin ON public.artigo;
CREATE POLICY artigo_admin ON public.artigo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS artigo_metricas_admin ON public.artigo_metricas_dia;
CREATE POLICY artigo_metricas_admin ON public.artigo_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS gsc_metricas_admin ON public.gsc_metricas_dia;
CREATE POLICY gsc_metricas_admin ON public.gsc_metricas_dia FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS lead_touchpoint_admin ON public.lead_touchpoint;
CREATE POLICY lead_touchpoint_admin ON public.lead_touchpoint FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS link_curto_admin ON public.link_curto;
CREATE POLICY link_curto_admin ON public.link_curto FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));
DROP POLICY IF EXISTS link_utm_gerado_admin ON public.link_utm_gerado;
CREATE POLICY link_utm_gerado_admin ON public.link_utm_gerado FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

-- Triggers updated_at
DROP TRIGGER IF EXISTS update_email_campanha_updated_at ON public.email_campanha;
CREATE TRIGGER update_email_campanha_updated_at
  BEFORE UPDATE ON public.email_campanha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_email_fluxo_updated_at ON public.email_fluxo;
CREATE TRIGGER update_email_fluxo_updated_at
  BEFORE UPDATE ON public.email_fluxo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_artigo_updated_at ON public.artigo;
CREATE TRIGGER update_artigo_updated_at
  BEFORE UPDATE ON public.artigo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.link_curto SET cliques = cliques + 1 WHERE id_link_curto = link_id;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_link_clicks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agregado_marketing(
  p_id_empresa UUID, p_inicio TIMESTAMPTZ, p_fim TIMESTAMPTZ, p_modelo TEXT DEFAULT 'last'
) RETURNS TABLE (canal TEXT, leads NUMERIC, vendas NUMERIC, receita NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS (
    SELECT l.id_lead, l.venda_realizada, COALESCE(l.valor_venda, 0) AS valor_venda,
      l.atribuicao_linear,
      COALESCE(l.first_touch_canal, l.origem_canal::TEXT, 'DESCONHECIDO') AS canal_first,
      COALESCE(l.last_touch_canal,  l.origem_canal::TEXT, 'DESCONHECIDO') AS canal_last
    FROM public.lead l
    WHERE (l.merged = false OR l.merged IS NULL)
      AND l.data_criacao >= p_inicio AND l.data_criacao <= p_fim
      AND (p_id_empresa IS NULL OR l.id_empresa = p_id_empresa)
  ),
  flat AS (
    SELECT
      CASE WHEN p_modelo = 'first' THEN canal_first ELSE canal_last END AS canal,
      1::NUMERIC AS peso_lead,
      CASE WHEN venda_realizada THEN 1::NUMERIC ELSE 0 END AS peso_venda,
      CASE WHEN venda_realizada THEN valor_venda ELSE 0 END AS peso_receita
    FROM base WHERE p_modelo IN ('first', 'last')
    UNION ALL
    SELECT (kv).key, (kv).value::NUMERIC,
      CASE WHEN venda_realizada THEN (kv).value::NUMERIC ELSE 0 END,
      CASE WHEN venda_realizada THEN valor_venda * (kv).value::NUMERIC ELSE 0 END
    FROM base, jsonb_each_text(COALESCE(atribuicao_linear, '{}'::jsonb)) kv
    WHERE p_modelo = 'linear'
  )
  SELECT canal, SUM(peso_lead), SUM(peso_venda), SUM(peso_receita)
  FROM flat GROUP BY canal ORDER BY SUM(peso_lead) DESC;
$$;
REVOKE ALL ON FUNCTION public.agregado_marketing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agregado_marketing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leads_por_email_campanha_dia(p_id_empresa UUID, p_data DATE)
RETURNS TABLE (utm_campaign TEXT, total INTEGER)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT l.utm_campaign::TEXT, COUNT(*)::INTEGER
  FROM public.lead l
  WHERE l.id_empresa = p_id_empresa
    AND l.utm_source IN ('email', 'newsletter')
    AND l.utm_campaign IS NOT NULL
    AND l.data_criacao >= (p_data::TIMESTAMP)
    AND l.data_criacao <  (p_data::TIMESTAMP + INTERVAL '1 day')
    AND (l.merged = false OR l.merged IS NULL)
  GROUP BY l.utm_campaign;
$$;
REVOKE ALL ON FUNCTION public.leads_por_email_campanha_dia(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_por_email_campanha_dia(UUID, DATE) TO authenticated, service_role;