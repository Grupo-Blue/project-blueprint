-- ============================================================
-- RPCs de performance para o módulo Marketing
-- ============================================================

-- Incremento atômico do contador de cliques (resolve race condition em redirect-link-curto)
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.link_curto
  SET cliques = cliques + 1
  WHERE id_link_curto = link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_link_clicks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(UUID) TO anon, authenticated, service_role;

-- Agregação de leads/vendas/receita por canal usando o modelo de atribuição escolhido.
-- modelo ∈ ('first','last','linear'). 'first'/'last' lê last_touch_canal/first_touch_canal
-- (com fallback para origem_canal). 'linear' usa lead.atribuicao_linear (JSONB).
-- Retorna: canal | leads | vendas | receita
CREATE OR REPLACE FUNCTION public.agregado_marketing(
  p_id_empresa UUID,
  p_inicio TIMESTAMPTZ,
  p_fim TIMESTAMPTZ,
  p_modelo TEXT DEFAULT 'last'
)
RETURNS TABLE (canal TEXT, leads NUMERIC, vendas NUMERIC, receita NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      l.id_lead,
      l.venda_realizada,
      COALESCE(l.valor_venda, 0) AS valor_venda,
      l.atribuicao_linear,
      COALESCE(l.first_touch_canal, l.origem_canal::TEXT, 'DESCONHECIDO') AS canal_first,
      COALESCE(l.last_touch_canal,  l.origem_canal::TEXT, 'DESCONHECIDO') AS canal_last
    FROM public.lead l
    WHERE (l.merged = false OR l.merged IS NULL)
      AND l.data_criacao >= p_inicio
      AND l.data_criacao <= p_fim
      AND (p_id_empresa IS NULL OR l.id_empresa = p_id_empresa)
  ),
  flat AS (
    -- modelo 'first' / 'last'
    SELECT
      CASE WHEN p_modelo = 'first' THEN canal_first ELSE canal_last END AS canal,
      1::NUMERIC AS peso_lead,
      CASE WHEN venda_realizada THEN 1::NUMERIC ELSE 0 END AS peso_venda,
      CASE WHEN venda_realizada THEN valor_venda ELSE 0 END AS peso_receita
    FROM base
    WHERE p_modelo IN ('first', 'last')

    UNION ALL

    -- modelo 'linear': expande JSONB { canal: peso }
    SELECT
      (kv).key                                                AS canal,
      (kv).value::NUMERIC                                     AS peso_lead,
      CASE WHEN venda_realizada THEN (kv).value::NUMERIC ELSE 0 END  AS peso_venda,
      CASE WHEN venda_realizada THEN valor_venda * (kv).value::NUMERIC ELSE 0 END AS peso_receita
    FROM base, jsonb_each_text(COALESCE(atribuicao_linear, '{}'::jsonb)) kv
    WHERE p_modelo = 'linear'
  )
  SELECT
    canal,
    SUM(peso_lead)    AS leads,
    SUM(peso_venda)   AS vendas,
    SUM(peso_receita) AS receita
  FROM flat
  GROUP BY canal
  ORDER BY leads DESC;
$$;

REVOKE ALL ON FUNCTION public.agregado_marketing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agregado_marketing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO authenticated, service_role;

-- Contagem agrupada de leads gerados por campanha de e-mail num dia.
-- Substitui o loop N+1 em coletar-emails-mautic.enriquecerLeadsGerados.
CREATE OR REPLACE FUNCTION public.leads_por_email_campanha_dia(
  p_id_empresa UUID,
  p_data DATE
)
RETURNS TABLE (utm_campaign TEXT, total INTEGER)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.utm_campaign::TEXT,
    COUNT(*)::INTEGER AS total
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
GRANT EXECUTE ON FUNCTION public.leads_por_email_campanha_dia(UUID, DATE)
  TO authenticated, service_role;
