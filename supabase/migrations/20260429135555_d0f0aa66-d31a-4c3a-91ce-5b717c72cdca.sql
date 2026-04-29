
CREATE OR REPLACE FUNCTION public.blue_match_revisao_listar(
  _status text DEFAULT 'pendente',
  _busca text DEFAULT NULL,
  _limite int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  total_count bigint,
  id uuid,
  base_origem text,
  raw_id uuid,
  raw_nome text,
  raw_client_key text,
  candidato_client_key text,
  candidato_nome text,
  similaridade numeric,
  status text,
  resolvido_em timestamptz,
  observacao text,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_busca text := nullif(trim(_busca), '');
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN RAISE EXCEPTION 'acesso negado'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT m.* FROM public.blue_match_revisao m
    WHERE (_status IS NULL OR _status = 'todos' OR m.status = _status)
      AND (v_busca IS NULL
        OR m.raw_nome ILIKE '%' || v_busca || '%'
        OR m.candidato_nome ILIKE '%' || v_busca || '%')
  ),
  c AS (SELECT COUNT(*)::bigint AS n FROM base)
  SELECT (SELECT n FROM c),
    b.id, b.base_origem, b.raw_id, b.raw_nome, b.raw_client_key,
    b.candidato_client_key, b.candidato_nome, b.similaridade,
    b.status, b.resolvido_em, b.observacao, b.created_at
  FROM base b
  ORDER BY CASE WHEN b.status = 'pendente' THEN 0 ELSE 1 END, b.similaridade DESC, b.created_at DESC
  LIMIT _limite OFFSET _offset;
END; $$;

CREATE OR REPLACE FUNCTION public.blue_match_revisao_kpis()
RETURNS TABLE(pendentes bigint, confirmados bigint, rejeitados bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'pendente')::bigint,
    COUNT(*) FILTER (WHERE status = 'confirmado')::bigint,
    COUNT(*) FILTER (WHERE status = 'rejeitado')::bigint,
    COUNT(*)::bigint
  FROM public.blue_match_revisao
  WHERE public.user_has_blue_visao360_access();
$$;

CREATE OR REPLACE FUNCTION public.blue_match_revisao_resolver(
  _id uuid, _decisao text, _observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; v_user uuid := auth.uid();
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN RAISE EXCEPTION 'acesso negado'; END IF;
  IF _decisao NOT IN ('confirmar', 'rejeitar') THEN RAISE EXCEPTION 'decisao invalida'; END IF;
  SELECT * INTO m FROM public.blue_match_revisao WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match nao encontrado'; END IF;

  IF _decisao = 'confirmar' THEN
    IF m.base_origem = 'info' THEN
      UPDATE public.blue_cliente_raw_info SET client_key = m.candidato_client_key, updated_at = now() WHERE id = m.raw_id;
    ELSIF m.base_origem = 'crm' THEN
      UPDATE public.blue_cliente_raw_crm SET client_key = m.candidato_client_key, updated_at = now() WHERE id = m.raw_id;
    ELSIF m.base_origem = '2026' THEN
      UPDATE public.blue_cliente_raw_2026 SET client_key = m.candidato_client_key, updated_at = now() WHERE id = m.raw_id;
    END IF;
    UPDATE public.blue_match_revisao
      SET status = 'confirmado', resolvido_em = now(), resolvido_por = v_user,
          observacao = COALESCE(_observacao, observacao), updated_at = now()
      WHERE id = _id;
  ELSE
    UPDATE public.blue_match_revisao
      SET status = 'rejeitado', resolvido_em = now(), resolvido_por = v_user,
          observacao = COALESCE(_observacao, observacao), updated_at = now()
      WHERE id = _id;
  END IF;

  RETURN jsonb_build_object('id', _id, 'decisao', _decisao, 'client_key_afetada', m.candidato_client_key);
END; $$;
