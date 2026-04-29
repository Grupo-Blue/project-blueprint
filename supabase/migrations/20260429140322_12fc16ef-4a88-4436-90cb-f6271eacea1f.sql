
-- Tabela de ações comerciais
CREATE TABLE IF NOT EXISTS public.blue_cliente_acao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('abordagem','follow_up','ganho','perdido','observacao')),
  fila TEXT CHECK (fila IS NULL OR fila IN ('renovacao','upsell','resgate','winback')),
  vendedor_id UUID,
  vendedor_nome TEXT,
  observacao TEXT,
  valor_estimado NUMERIC,
  data_acao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blue_acao_client_key ON public.blue_cliente_acao(client_key);
CREATE INDEX IF NOT EXISTS idx_blue_acao_data ON public.blue_cliente_acao(data_acao DESC);
CREATE INDEX IF NOT EXISTS idx_blue_acao_vendedor ON public.blue_cliente_acao(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_blue_acao_tipo_fila ON public.blue_cliente_acao(tipo, fila);

ALTER TABLE public.blue_cliente_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blue_acao_select" ON public.blue_cliente_acao
  FOR SELECT USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_acao_insert" ON public.blue_cliente_acao
  FOR INSERT WITH CHECK (public.user_has_blue_visao360_access() AND vendedor_id = auth.uid());
CREATE POLICY "blue_acao_update_own" ON public.blue_cliente_acao
  FOR UPDATE USING (public.user_has_blue_visao360_access() AND (vendedor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY "blue_acao_delete_own" ON public.blue_cliente_acao
  FOR DELETE USING (public.user_has_blue_visao360_access() AND (vendedor_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)));

CREATE TRIGGER trg_blue_acao_updated BEFORE UPDATE ON public.blue_cliente_acao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- KPIs gerenciais
CREATE OR REPLACE FUNCTION public.blue_visao360_gestao_kpis(_dias INT DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inicio TIMESTAMPTZ := now() - (_dias || ' days')::INTERVAL;
  v_total BIGINT; v_ganhos BIGINT; v_perdidos BIGINT; v_abertos BIGINT;
  v_tempo_medio NUMERIC;
  v_por_fila JSONB; v_ranking JSONB; v_serie JSONB;
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN RAISE EXCEPTION 'acesso negado'; END IF;

  SELECT
    COUNT(*) FILTER (WHERE data_acao >= v_inicio),
    COUNT(*) FILTER (WHERE tipo = 'ganho' AND data_acao >= v_inicio),
    COUNT(*) FILTER (WHERE tipo = 'perdido' AND data_acao >= v_inicio),
    COUNT(*) FILTER (WHERE tipo IN ('abordagem','follow_up') AND data_acao >= v_inicio
      AND NOT EXISTS (
        SELECT 1 FROM public.blue_cliente_acao d
        WHERE d.client_key = blue_cliente_acao.client_key
          AND d.tipo IN ('ganho','perdido')
          AND d.data_acao > blue_cliente_acao.data_acao
      ))
  INTO v_total, v_ganhos, v_perdidos, v_abertos
  FROM public.blue_cliente_acao;

  -- Tempo médio entre primeira abordagem e desfecho (dias)
  WITH desfechos AS (
    SELECT a.client_key, MIN(a.data_acao) AS desfecho_em
    FROM public.blue_cliente_acao a
    WHERE a.tipo IN ('ganho','perdido') AND a.data_acao >= v_inicio
    GROUP BY a.client_key
  ),
  primeiras AS (
    SELECT a.client_key, MIN(a.data_acao) AS primeiro_em
    FROM public.blue_cliente_acao a
    WHERE a.tipo IN ('abordagem','follow_up')
    GROUP BY a.client_key
  )
  SELECT AVG(EXTRACT(EPOCH FROM (d.desfecho_em - p.primeiro_em)) / 86400.0)
  INTO v_tempo_medio
  FROM desfechos d JOIN primeiras p ON p.client_key = d.client_key
  WHERE d.desfecho_em > p.primeiro_em;

  -- Conversão por fila (no período)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'fila', fila,
    'ganhos', ganhos,
    'perdidos', perdidos,
    'abertos', abertos,
    'taxa', CASE WHEN (ganhos + perdidos) > 0 THEN ROUND(ganhos::NUMERIC / (ganhos + perdidos) * 100, 1) ELSE 0 END
  ) ORDER BY (ganhos + perdidos) DESC), '[]'::jsonb)
  INTO v_por_fila
  FROM (
    SELECT
      COALESCE(fila, 'sem_fila') AS fila,
      COUNT(*) FILTER (WHERE tipo = 'ganho')::INT AS ganhos,
      COUNT(*) FILTER (WHERE tipo = 'perdido')::INT AS perdidos,
      COUNT(*) FILTER (WHERE tipo IN ('abordagem','follow_up'))::INT AS abertos
    FROM public.blue_cliente_acao
    WHERE data_acao >= v_inicio
    GROUP BY COALESCE(fila, 'sem_fila')
  ) f;

  -- Ranking vendedores
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendedor_nome', vendedor_nome,
    'vendedor_id', vendedor_id,
    'acoes', acoes,
    'ganhos', ganhos,
    'valor_ganho', valor_ganho
  ) ORDER BY ganhos DESC, acoes DESC), '[]'::jsonb)
  INTO v_ranking
  FROM (
    SELECT vendedor_id, COALESCE(vendedor_nome, 'Sem nome') AS vendedor_nome,
      COUNT(*)::INT AS acoes,
      COUNT(*) FILTER (WHERE tipo = 'ganho')::INT AS ganhos,
      COALESCE(SUM(valor_estimado) FILTER (WHERE tipo = 'ganho'), 0) AS valor_ganho
    FROM public.blue_cliente_acao
    WHERE data_acao >= v_inicio AND vendedor_id IS NOT NULL
    GROUP BY vendedor_id, vendedor_nome
    LIMIT 20
  ) r;

  -- Série temporal por dia
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'dia', dia, 'acoes', acoes, 'ganhos', ganhos
  ) ORDER BY dia), '[]'::jsonb)
  INTO v_serie
  FROM (
    SELECT date_trunc('day', data_acao)::DATE AS dia,
      COUNT(*)::INT AS acoes,
      COUNT(*) FILTER (WHERE tipo = 'ganho')::INT AS ganhos
    FROM public.blue_cliente_acao
    WHERE data_acao >= v_inicio
    GROUP BY 1
  ) s;

  RETURN jsonb_build_object(
    'periodo_dias', _dias,
    'total_acoes', COALESCE(v_total, 0),
    'ganhos', COALESCE(v_ganhos, 0),
    'perdidos', COALESCE(v_perdidos, 0),
    'em_aberto', COALESCE(v_abertos, 0),
    'tempo_medio_dias', ROUND(COALESCE(v_tempo_medio, 0)::NUMERIC, 1),
    'por_fila', v_por_fila,
    'ranking_vendedores', v_ranking,
    'serie_temporal', v_serie
  );
END;
$$;

-- Listar ações de um cliente
CREATE OR REPLACE FUNCTION public.blue_cliente_acao_listar(_client_key TEXT)
RETURNS TABLE(
  id UUID, client_key TEXT, tipo TEXT, fila TEXT,
  vendedor_id UUID, vendedor_nome TEXT, observacao TEXT,
  valor_estimado NUMERIC, data_acao TIMESTAMPTZ, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, client_key, tipo, fila, vendedor_id, vendedor_nome, observacao,
    valor_estimado, data_acao, created_at
  FROM public.blue_cliente_acao
  WHERE client_key = _client_key AND public.user_has_blue_visao360_access()
  ORDER BY data_acao DESC;
$$;

-- Get/save score config
CREATE OR REPLACE FUNCTION public.blue_score_config_get()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.user_has_blue_visao360_access() THEN RAISE EXCEPTION 'acesso negado'; END IF;
  SELECT * INTO r FROM public.blue_score_config
    WHERE id_empresa = '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db'::uuid LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'peso_nivel', 100, 'peso_prioridade', 30,
      'bonus_procuracao_30d', 50, 'bonus_procuracao_60d', 25,
      'bonus_aprovacao', 40, 'bonus_fidelidade_por_ano', 5,
      'bonus_fidelidade_max', 25, 'penalty_inatividade_por_mes', 10
    );
  END IF;
  RETURN to_jsonb(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.blue_score_config_save(
  _peso_nivel NUMERIC,
  _peso_prioridade NUMERIC,
  _bonus_procuracao_30d NUMERIC,
  _bonus_procuracao_60d NUMERIC,
  _bonus_aprovacao NUMERIC,
  _bonus_fidelidade_por_ano NUMERIC,
  _bonus_fidelidade_max NUMERIC,
  _penalty_inatividade_por_mes NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp UUID := '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db'::uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'apenas admin pode editar pesos';
  END IF;
  INSERT INTO public.blue_score_config (
    id_empresa, peso_nivel, peso_prioridade,
    bonus_procuracao_30d, bonus_procuracao_60d, bonus_aprovacao,
    bonus_fidelidade_por_ano, bonus_fidelidade_max, penalty_inatividade_por_mes
  ) VALUES (
    v_emp, _peso_nivel, _peso_prioridade,
    _bonus_procuracao_30d, _bonus_procuracao_60d, _bonus_aprovacao,
    _bonus_fidelidade_por_ano, _bonus_fidelidade_max, _penalty_inatividade_por_mes
  )
  ON CONFLICT (id_empresa) DO UPDATE SET
    peso_nivel = EXCLUDED.peso_nivel,
    peso_prioridade = EXCLUDED.peso_prioridade,
    bonus_procuracao_30d = EXCLUDED.bonus_procuracao_30d,
    bonus_procuracao_60d = EXCLUDED.bonus_procuracao_60d,
    bonus_aprovacao = EXCLUDED.bonus_aprovacao,
    bonus_fidelidade_por_ano = EXCLUDED.bonus_fidelidade_por_ano,
    bonus_fidelidade_max = EXCLUDED.bonus_fidelidade_max,
    penalty_inatividade_por_mes = EXCLUDED.penalty_inatividade_por_mes,
    updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
