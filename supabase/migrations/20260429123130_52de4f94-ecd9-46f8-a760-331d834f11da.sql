
-- RPC: lista paginada com filtros
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_listar(
  _id_empresa uuid,
  _busca text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _exercicio integer DEFAULT NULL,
  _tipo text DEFAULT NULL,            -- 'imobiliario'|'investidor'|'empresarial'|'cripto'|'tributario'
  _patrimonio_min numeric DEFAULT NULL,
  _ordenacao text DEFAULT 'patrimonio', -- 'patrimonio'|'investimentos'|'variacao'
  _limite integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  total_count bigint,
  id uuid,
  cpf varchar,
  nome_contribuinte text,
  exercicio integer,
  ano_calendario integer,
  id_lead uuid,
  ocupacao text,
  uf varchar,
  possui_atividade_rural boolean,
  resultado_atividade_rural numeric,
  patrimonio_total numeric,
  patrimonio_anterior numeric,
  variacao_patrimonio numeric,
  total_dividas numeric,
  patrimonio_liquido numeric,
  imoveis numeric,
  veiculos numeric,
  participacoes numeric,
  aplicacoes numeric,
  depositos numeric,
  fundos numeric,
  cripto numeric,
  total_investimentos numeric,
  qtd_imoveis bigint,
  qtd_veiculos bigint,
  qtd_participacoes bigint,
  qtd_cripto bigint,
  nome_lead text,
  lead_email text,
  lead_telefone text,
  lead_stage text,
  lead_venda_realizada boolean,
  lead_tokeniza_investidor boolean,
  lead_tokeniza_valor_investido numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_busca text := nullif(trim(_busca), '');
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT m.*
    FROM public.mv_irpf_inteligencia m
    WHERE m.id_empresa = _id_empresa
      AND (_uf IS NULL OR m.uf = _uf)
      AND (_exercicio IS NULL OR m.exercicio = _exercicio)
      AND (_patrimonio_min IS NULL OR m.patrimonio_liquido >= _patrimonio_min)
      AND (
        v_busca IS NULL
        OR m.nome_contribuinte ILIKE '%' || v_busca || '%'
        OR m.cpf ILIKE '%' || v_busca || '%'
        OR COALESCE(m.lead_email, '') ILIKE '%' || v_busca || '%'
        OR COALESCE(m.nome_lead, '') ILIKE '%' || v_busca || '%'
      )
      AND (
        _tipo IS NULL OR _tipo = 'todos'
        OR (_tipo = 'imobiliario' AND (m.qtd_imoveis >= 3 OR m.imoveis > 1000000))
        OR (_tipo = 'empresarial' AND (m.qtd_participacoes > 0 OR m.possui_atividade_rural = true))
        OR (_tipo = 'investidor' AND (m.total_investimentos > 200000 OR m.patrimonio_liquido > 1000000))
        OR (_tipo = 'cripto' AND m.qtd_cripto > 0)
        OR (_tipo = 'tributario' AND m.total_dividas > 0 AND m.patrimonio_total > 0 AND m.total_dividas / NULLIF(m.patrimonio_total,0) > 0.4)
      )
  ),
  contagem AS (SELECT COUNT(*)::bigint AS c FROM base)
  SELECT
    (SELECT c FROM contagem) AS total_count,
    b.id, b.cpf, b.nome_contribuinte, b.exercicio, b.ano_calendario, b.id_lead,
    b.ocupacao, b.uf, b.possui_atividade_rural, b.resultado_atividade_rural,
    b.patrimonio_total, b.patrimonio_anterior, b.variacao_patrimonio,
    b.total_dividas, b.patrimonio_liquido,
    b.imoveis, b.veiculos, b.participacoes, b.aplicacoes, b.depositos, b.fundos, b.cripto,
    b.total_investimentos,
    b.qtd_imoveis, b.qtd_veiculos, b.qtd_participacoes, b.qtd_cripto,
    b.nome_lead, b.lead_email, b.lead_telefone, b.lead_stage,
    b.lead_venda_realizada, b.lead_tokeniza_investidor, b.lead_tokeniza_valor_investido
  FROM base b
  ORDER BY
    CASE WHEN _ordenacao = 'patrimonio' THEN b.patrimonio_liquido END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'investimentos' THEN b.total_investimentos END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'variacao' THEN b.variacao_patrimonio END DESC NULLS LAST,
    b.id
  LIMIT _limite OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.irpf_inteligencia_listar(uuid, text, text, integer, text, numeric, text, integer, integer) TO authenticated;

-- RPC: KPIs agregados
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_kpis(_id_empresa uuid)
RETURNS TABLE (
  total_decs bigint,
  patrimonio_total numeric,
  sem_lead bigint,
  imobiliario bigint,
  investidor bigint,
  empresarial bigint,
  cripto bigint,
  tributario bigint,
  total_oportunidades bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      m.*,
      (m.qtd_imoveis >= 3 OR m.imoveis > 1000000) AS f_imob,
      (m.total_investimentos > 200000 OR m.patrimonio_liquido > 1000000) AS f_inv,
      (m.qtd_participacoes > 0 OR m.possui_atividade_rural = true) AS f_emp,
      (m.qtd_cripto > 0) AS f_cripto,
      (m.total_dividas > 0 AND m.patrimonio_total > 0 AND m.total_dividas / NULLIF(m.patrimonio_total,0) > 0.4) AS f_trib
    FROM public.mv_irpf_inteligencia m
    WHERE m.id_empresa = _id_empresa
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(patrimonio_liquido), 0),
    COUNT(*) FILTER (WHERE id_lead IS NULL)::bigint,
    COUNT(*) FILTER (WHERE f_imob)::bigint,
    COUNT(*) FILTER (WHERE f_inv)::bigint,
    COUNT(*) FILTER (WHERE f_emp)::bigint,
    COUNT(*) FILTER (WHERE f_cripto)::bigint,
    COUNT(*) FILTER (WHERE f_trib)::bigint,
    COUNT(*) FILTER (WHERE f_imob OR f_inv OR f_emp OR f_cripto OR f_trib)::bigint
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.irpf_inteligencia_kpis(uuid) TO authenticated;

-- UFs/Exercícios disponíveis para os filtros
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_facetas(_id_empresa uuid)
RETURNS TABLE (ufs text[], exercicios integer[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ARRAY(SELECT DISTINCT uf FROM public.mv_irpf_inteligencia WHERE id_empresa = _id_empresa AND uf IS NOT NULL ORDER BY uf),
    ARRAY(SELECT DISTINCT exercicio FROM public.mv_irpf_inteligencia WHERE id_empresa = _id_empresa AND exercicio IS NOT NULL ORDER BY exercicio DESC);
$$;

GRANT EXECUTE ON FUNCTION public.irpf_inteligencia_facetas(uuid) TO authenticated;

-- Refresh inicial
SELECT public.refresh_mv_irpf_inteligencia();
