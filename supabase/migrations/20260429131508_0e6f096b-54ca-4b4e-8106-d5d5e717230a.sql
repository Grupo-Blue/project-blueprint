
-- KPIs por fila + total
CREATE OR REPLACE FUNCTION public.blue_visao360_kpis()
RETURNS TABLE(
  total bigint,
  ativos bigint,
  inativos bigint,
  renovacao bigint,
  upsell bigint,
  resgate bigint,
  winback bigint,
  em_aprovacao bigint,
  procuracao_60d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE cliente_ativo)::bigint,
    COUNT(*) FILTER (WHERE NOT cliente_ativo)::bigint,
    COUNT(*) FILTER (WHERE 'renovacao' = ANY(filas))::bigint,
    COUNT(*) FILTER (WHERE 'upsell' = ANY(filas))::bigint,
    COUNT(*) FILTER (WHERE 'resgate' = ANY(filas))::bigint,
    COUNT(*) FILTER (WHERE 'winback' = ANY(filas))::bigint,
    COUNT(*) FILTER (WHERE fase_macro = 'aprovacao')::bigint,
    COUNT(*) FILTER (
      WHERE vencimento_procuracao IS NOT NULL
        AND vencimento_procuracao <= (current_date + INTERVAL '60 days')
        AND vencimento_procuracao >= current_date
    )::bigint
  FROM public.blue_cliente_360
  WHERE public.user_has_blue_visao360_access();
$$;

-- Facetas (UF, responsável CS, perfil, exercícios)
CREATE OR REPLACE FUNCTION public.blue_visao360_facetas()
RETURNS TABLE(
  ufs text[],
  responsaveis text[],
  perfis text[],
  niveis numeric[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ARRAY(SELECT DISTINCT uf FROM public.blue_cliente_360 WHERE uf IS NOT NULL ORDER BY uf),
    ARRAY(SELECT DISTINCT responsavel_cs FROM public.blue_cliente_360 WHERE responsavel_cs IS NOT NULL ORDER BY responsavel_cs),
    ARRAY(SELECT DISTINCT unnest(perfil_psicografico) FROM public.blue_cliente_360 ORDER BY 1),
    ARRAY(SELECT DISTINCT nivel FROM public.blue_cliente_360 WHERE nivel IS NOT NULL ORDER BY nivel)
  WHERE public.user_has_blue_visao360_access();
$$;

-- Listagem paginada/filtrada
CREATE OR REPLACE FUNCTION public.blue_visao360_listar(
  _fila text DEFAULT NULL,
  _busca text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _responsavel text DEFAULT NULL,
  _nivel_min numeric DEFAULT NULL,
  _nivel_max numeric DEFAULT NULL,
  _perfil text DEFAULT NULL,
  _ordenacao text DEFAULT 'score',
  _limite integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  total_count bigint,
  id uuid,
  client_key text,
  nome_canonico text,
  cpf_cnpj text,
  contato_email text,
  contato_whatsapp text,
  uf text,
  perfil_psicografico text[],
  cliente_ativo boolean,
  vencimento_procuracao date,
  nivel numeric,
  prioridade text,
  responsavel_cs text,
  historico_anos jsonb,
  anos_finalizados integer,
  anos_pendentes integer,
  status_2026 text,
  ir_geral_2026 text,
  apuracao_b3_2026 text,
  fase_macro text,
  gatilho_principal text,
  oportunidades jsonb,
  filas text[],
  score_priorizacao numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busca text := nullif(trim(_busca), '');
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT b.*
    FROM public.blue_cliente_360 b
    WHERE
      (_fila IS NULL OR _fila = 'todas' OR _fila = ANY(b.filas))
      AND (_uf IS NULL OR b.uf = _uf)
      AND (_responsavel IS NULL OR b.responsavel_cs = _responsavel)
      AND (_nivel_min IS NULL OR b.nivel >= _nivel_min)
      AND (_nivel_max IS NULL OR b.nivel <= _nivel_max)
      AND (_perfil IS NULL OR _perfil = ANY(b.perfil_psicografico))
      AND (
        v_busca IS NULL
        OR b.nome_canonico ILIKE '%' || v_busca || '%'
        OR COALESCE(b.cpf_cnpj, '') ILIKE '%' || v_busca || '%'
        OR COALESCE(b.contato_email, '') ILIKE '%' || v_busca || '%'
      )
  ),
  contagem AS (SELECT COUNT(*)::bigint AS c FROM base)
  SELECT
    (SELECT c FROM contagem) AS total_count,
    b.id, b.client_key, b.nome_canonico, b.cpf_cnpj,
    b.contato_email, b.contato_whatsapp, b.uf, b.perfil_psicografico,
    b.cliente_ativo, b.vencimento_procuracao,
    b.nivel, b.prioridade, b.responsavel_cs,
    b.historico_anos, b.anos_finalizados, b.anos_pendentes,
    b.status_2026, b.ir_geral_2026, b.apuracao_b3_2026,
    b.fase_macro, b.gatilho_principal, b.oportunidades, b.filas,
    b.score_priorizacao
  FROM base b
  ORDER BY
    CASE WHEN _ordenacao = 'score' THEN b.score_priorizacao END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'nivel' THEN b.nivel END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'procuracao' THEN b.vencimento_procuracao END ASC NULLS LAST,
    CASE WHEN _ordenacao = 'nome' THEN b.nome_canonico END ASC NULLS LAST,
    b.id
  LIMIT _limite OFFSET _offset;
END;
$$;

-- Detalhe (com raws)
CREATE OR REPLACE FUNCTION public.blue_visao360_detalhe(_client_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'cliente', to_jsonb(c.*),
    'raw_info', to_jsonb(i.*),
    'raw_crm', to_jsonb(cr.*),
    'raw_2026', to_jsonb(rd.*)
  ) INTO result
  FROM public.blue_cliente_360 c
  LEFT JOIN public.blue_cliente_raw_info i ON i.id = c.raw_info_id
  LEFT JOIN public.blue_cliente_raw_crm cr ON cr.id = c.raw_crm_id
  LEFT JOIN public.blue_cliente_raw_2026 rd ON rd.id = c.raw_2026_id
  WHERE c.client_key = _client_key
  LIMIT 1;

  RETURN result;
END;
$$;
