DROP MATERIALIZED VIEW IF EXISTS public.mv_irpf_inteligencia CASCADE;

CREATE MATERIALIZED VIEW public.mv_irpf_inteligencia AS
WITH bens_agg AS (
  SELECT id_declaracao,
    SUM(COALESCE(valor_ano_atual, 0)) AS patrimonio_total,
    SUM(COALESCE(valor_ano_anterior, 0)) AS patrimonio_anterior,
    SUM(CASE WHEN grupo_codigo IN ('01','01-99') THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS imoveis,
    SUM(CASE WHEN grupo_codigo = '02' THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS veiculos,
    SUM(CASE WHEN grupo_codigo = '03' THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS participacoes,
    SUM(CASE WHEN grupo_codigo IN ('04','05') THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS aplicacoes,
    SUM(CASE WHEN grupo_codigo = '06' THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS depositos,
    SUM(CASE WHEN grupo_codigo = '07' THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS fundos,
    SUM(CASE WHEN grupo_codigo = '08' THEN COALESCE(valor_ano_atual, 0) ELSE 0 END) AS cripto,
    COUNT(*) FILTER (WHERE grupo_codigo IN ('01','01-99') AND COALESCE(valor_ano_atual,0) > 0) AS qtd_imoveis,
    COUNT(*) FILTER (WHERE grupo_codigo = '02' AND COALESCE(valor_ano_atual,0) > 0) AS qtd_veiculos,
    COUNT(*) FILTER (WHERE grupo_codigo = '03' AND COALESCE(valor_ano_atual,0) > 0) AS qtd_participacoes,
    COUNT(*) FILTER (WHERE grupo_codigo = '08' AND COALESCE(valor_ano_atual,0) > 0) AS qtd_cripto
  FROM public.irpf_bem_direito
  GROUP BY id_declaracao
),
dividas_agg AS (
  SELECT id_declaracao, SUM(COALESCE(situacao_ano_atual, 0)) AS total_dividas
  FROM public.irpf_divida_onus
  GROUP BY id_declaracao
),
deps_agg AS (
  SELECT id_declaracao, COUNT(*) AS qtd_dependentes
  FROM public.irpf_dependente
  GROUP BY id_declaracao
),
rend_agg AS (
  SELECT id_declaracao, COUNT(DISTINCT cnpj_fonte) AS qtd_fontes_pagadoras
  FROM public.irpf_rendimento
  WHERE cnpj_fonte IS NOT NULL AND categoria = 'tributavel'
  GROUP BY id_declaracao
),
base AS (
  SELECT
    d.id, d.id_empresa, d.cpf, d.nome_contribuinte, d.exercicio, d.ano_calendario,
    d.id_lead, d.data_nascimento,
    CASE WHEN d.data_nascimento IS NOT NULL
      THEN EXTRACT(YEAR FROM age(current_date, d.data_nascimento))::int END AS idade,
    NULLIF(trim(COALESCE(d.ocupacao_principal_descricao, d.natureza_ocupacao_descricao)), '') AS ocupacao,
    NULLIF(trim(d.endereco_uf), '') AS uf,
    NULLIF(trim(d.endereco_municipio), '') AS municipio,
    d.possui_atividade_rural, d.resultado_atividade_rural, d.possui_conjuge,
    d.email AS email_declaracao,
    NULLIF(trim(COALESCE(d.celular_ddd,'') || COALESCE(d.celular_numero,'')), '') AS telefone_declaracao,
    COALESCE(b.patrimonio_total, 0) AS patrimonio_total,
    COALESCE(b.patrimonio_anterior, 0) AS patrimonio_anterior,
    COALESCE(b.patrimonio_total, 0) - COALESCE(b.patrimonio_anterior, 0) AS variacao_patrimonio,
    COALESCE(dv.total_dividas, 0) AS total_dividas,
    COALESCE(b.patrimonio_total, 0) - COALESCE(dv.total_dividas, 0) AS patrimonio_liquido,
    COALESCE(b.imoveis, 0) AS imoveis,
    COALESCE(b.veiculos, 0) AS veiculos,
    COALESCE(b.participacoes, 0) AS participacoes,
    COALESCE(b.aplicacoes, 0) AS aplicacoes,
    COALESCE(b.depositos, 0) AS depositos,
    COALESCE(b.fundos, 0) AS fundos,
    COALESCE(b.cripto, 0) AS cripto,
    COALESCE(b.aplicacoes,0) + COALESCE(b.fundos,0) + COALESCE(b.depositos,0) AS total_investimentos,
    COALESCE(b.qtd_imoveis, 0) AS qtd_imoveis,
    COALESCE(b.qtd_veiculos, 0) AS qtd_veiculos,
    COALESCE(b.qtd_participacoes, 0) AS qtd_participacoes,
    COALESCE(b.qtd_cripto, 0) AS qtd_cripto,
    COALESCE(de.qtd_dependentes, 0) AS qtd_dependentes,
    COALESCE(re.qtd_fontes_pagadoras, 0) AS qtd_fontes_pagadoras
  FROM public.irpf_declaracao d
  LEFT JOIN bens_agg b ON b.id_declaracao = d.id
  LEFT JOIN dividas_agg dv ON dv.id_declaracao = d.id
  LEFT JOIN deps_agg de ON de.id_declaracao = d.id
  LEFT JOIN rend_agg re ON re.id_declaracao = d.id
  WHERE d.status_processamento = 'concluido'
)
SELECT
  bs.*,
  COALESCE(NULLIF(trim(l.nome_lead),''), bs.nome_contribuinte) AS nome_lead,
  COALESCE(NULLIF(trim(l.email),''), bs.email_declaracao) AS lead_email,
  COALESCE(NULLIF(trim(l.telefone),''), bs.telefone_declaracao) AS lead_telefone,
  l.stage_atual AS lead_stage,
  l.venda_realizada AS lead_venda_realizada,
  l.tokeniza_investidor AS lead_tokeniza_investidor,
  l.tokeniza_valor_investido AS lead_tokeniza_valor_investido,
  LEAST(100, GREATEST(0, ROUND((
    LEAST(35, (COALESCE(bs.patrimonio_liquido,0) / 5000000.0) * 35)
    + LEAST(25, (COALESCE(bs.total_investimentos,0) / 1000000.0) * 25)
    + CASE WHEN bs.qtd_participacoes > 0 THEN LEAST(15, 5 + bs.qtd_participacoes*2) ELSE 0 END
    + CASE WHEN bs.qtd_cripto > 0 THEN 10 ELSE 0 END
    + CASE WHEN bs.patrimonio_anterior > 0 AND bs.variacao_patrimonio > 0
        THEN LEAST(10, (bs.variacao_patrimonio::numeric / bs.patrimonio_anterior) * 30) ELSE 0 END
    + CASE WHEN bs.possui_atividade_rural THEN 5 ELSE 0 END
    - CASE WHEN bs.patrimonio_total > 0 AND bs.total_dividas / NULLIF(bs.patrimonio_total,0) > 0.4 THEN 8 ELSE 0 END
  )::numeric, 0))) AS score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN bs.patrimonio_liquido > 1000000
      THEN 'Patrim. líquido R$ ' || to_char(bs.patrimonio_liquido/1000000.0, 'FM999G990D0') || 'M' END,
    CASE WHEN bs.total_investimentos > 200000
      THEN 'Investim. R$ ' || to_char(bs.total_investimentos/1000.0, 'FM999G990') || 'k em RF/fundos' END,
    CASE WHEN bs.qtd_participacoes > 0
      THEN 'Sócio em ' || bs.qtd_participacoes || ' empresa(s)' END,
    CASE WHEN bs.qtd_imoveis >= 3
      THEN bs.qtd_imoveis || ' imóveis declarados' END,
    CASE WHEN bs.qtd_cripto > 0
      THEN 'Tem cripto (' || bs.qtd_cripto || ')' END,
    CASE WHEN bs.patrimonio_anterior > 0 AND bs.variacao_patrimonio / bs.patrimonio_anterior > 0.3
      THEN 'Crescimento +' || ROUND((bs.variacao_patrimonio/bs.patrimonio_anterior*100)::numeric, 0) || '% no ano' END,
    CASE WHEN bs.possui_atividade_rural THEN 'Atividade rural ativa' END,
    CASE WHEN bs.total_dividas > 0 AND bs.patrimonio_total > 0
        AND bs.total_dividas / bs.patrimonio_total > 0.4
      THEN 'Endividamento ' || ROUND((bs.total_dividas/bs.patrimonio_total*100)::numeric, 0) || '%' END
  ], NULL) AS motivos_score,
  CASE
    WHEN bs.qtd_cripto > 0 AND bs.total_investimentos > 100000
      THEN 'Familiarizado com ativos digitais — abordar com tokenização (FIIs/CRIs digitais)'
    WHEN bs.qtd_participacoes > 0
      THEN 'Empresário — agendar planejamento societário e tributário'
    WHEN bs.qtd_imoveis >= 3 OR bs.imoveis > 1500000
      THEN 'Perfil imobiliário — oferecer FII e crowdfunding imobiliário Tokeniza'
    WHEN bs.total_investimentos > 300000 AND COALESCE(l.tokeniza_investidor, false) = false
      THEN 'Cross-sell Tokeniza: R$ ' || to_char(bs.total_investimentos/1000.0,'FM999G990') || 'k em renda fixa, sem alocação alternativa'
    WHEN bs.patrimonio_liquido > 1000000
      THEN 'Alto patrimônio — diversificação private/wealth'
    WHEN bs.total_dividas > 0 AND bs.patrimonio_total > 0
        AND bs.total_dividas / bs.patrimonio_total > 0.4
      THEN 'Reorganização tributária e financeira'
    ELSE 'Apresentar portfólio Blue/Tokeniza'
  END AS proxima_acao,
  (l.id_lead IS NULL) AS sem_lead_vinculado
FROM base bs
LEFT JOIN public.lead l ON l.id_lead = bs.id_lead;

CREATE UNIQUE INDEX idx_mv_irpf_inteligencia_id ON public.mv_irpf_inteligencia(id);
CREATE INDEX idx_mv_irpf_inteligencia_emp ON public.mv_irpf_inteligencia(id_empresa);
CREATE INDEX idx_mv_irpf_inteligencia_score ON public.mv_irpf_inteligencia(id_empresa, score DESC);
CREATE INDEX idx_mv_irpf_inteligencia_uf ON public.mv_irpf_inteligencia(id_empresa, uf);

DROP FUNCTION IF EXISTS public.irpf_inteligencia_listar(uuid, text, text, integer, text, numeric, text, integer, integer);

CREATE OR REPLACE FUNCTION public.irpf_inteligencia_listar(
  _id_empresa uuid,
  _busca text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _exercicio integer DEFAULT NULL,
  _tipo text DEFAULT NULL,
  _patrimonio_min numeric DEFAULT NULL,
  _ordenacao text DEFAULT 'score',
  _limite integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  total_count bigint,
  id uuid, cpf varchar, nome_contribuinte text, exercicio integer, ano_calendario integer,
  id_lead uuid, ocupacao text, uf text, idade integer, municipio text,
  possui_atividade_rural boolean, resultado_atividade_rural numeric,
  possui_conjuge boolean, qtd_dependentes bigint, qtd_fontes_pagadoras bigint,
  patrimonio_total numeric, patrimonio_anterior numeric, variacao_patrimonio numeric,
  total_dividas numeric, patrimonio_liquido numeric,
  imoveis numeric, veiculos numeric, participacoes numeric, aplicacoes numeric,
  depositos numeric, fundos numeric, cripto numeric, total_investimentos numeric,
  qtd_imoveis bigint, qtd_veiculos bigint, qtd_participacoes bigint, qtd_cripto bigint,
  nome_lead text, lead_email text, lead_telefone text, lead_stage text,
  lead_venda_realizada boolean, lead_tokeniza_investidor boolean,
  lead_tokeniza_valor_investido numeric,
  score numeric, motivos_score text[], proxima_acao text, sem_lead_vinculado boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_busca text := nullif(trim(_busca), '');
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT m.* FROM public.mv_irpf_inteligencia m
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
        OR (_tipo = 'tributario' AND m.total_dividas > 0 AND m.patrimonio_total > 0
            AND m.total_dividas / NULLIF(m.patrimonio_total,0) > 0.4)
      )
  ),
  c AS (SELECT COUNT(*)::bigint AS n FROM base)
  SELECT (SELECT n FROM c),
    b.id, b.cpf, b.nome_contribuinte, b.exercicio, b.ano_calendario,
    b.id_lead, b.ocupacao, b.uf, b.idade, b.municipio,
    b.possui_atividade_rural, b.resultado_atividade_rural,
    b.possui_conjuge, b.qtd_dependentes, b.qtd_fontes_pagadoras,
    b.patrimonio_total, b.patrimonio_anterior, b.variacao_patrimonio,
    b.total_dividas, b.patrimonio_liquido,
    b.imoveis, b.veiculos, b.participacoes, b.aplicacoes, b.depositos, b.fundos, b.cripto,
    b.total_investimentos, b.qtd_imoveis, b.qtd_veiculos, b.qtd_participacoes, b.qtd_cripto,
    b.nome_lead, b.lead_email, b.lead_telefone, b.lead_stage,
    b.lead_venda_realizada, b.lead_tokeniza_investidor, b.lead_tokeniza_valor_investido,
    b.score, b.motivos_score, b.proxima_acao, b.sem_lead_vinculado
  FROM base b
  ORDER BY
    CASE WHEN _ordenacao = 'score' THEN b.score END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'patrimonio' THEN b.patrimonio_liquido END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'investimentos' THEN b.total_investimentos END DESC NULLS LAST,
    CASE WHEN _ordenacao = 'variacao' THEN b.variacao_patrimonio END DESC NULLS LAST,
    b.id
  LIMIT _limite OFFSET _offset;
END;
$$;

DROP FUNCTION IF EXISTS public.irpf_inteligencia_kpis(uuid);
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_kpis(_id_empresa uuid)
RETURNS TABLE(
  total_decs bigint, patrimonio_total numeric, sem_lead bigint,
  imobiliario bigint, investidor bigint, empresarial bigint,
  cripto bigint, tributario bigint, total_oportunidades bigint,
  score_medio numeric, com_lead bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT m.*,
      (m.qtd_imoveis >= 3 OR m.imoveis > 1000000) AS f_imob,
      (m.total_investimentos > 200000 OR m.patrimonio_liquido > 1000000) AS f_inv,
      (m.qtd_participacoes > 0 OR m.possui_atividade_rural = true) AS f_emp,
      (m.qtd_cripto > 0) AS f_cripto,
      (m.total_dividas > 0 AND m.patrimonio_total > 0
        AND m.total_dividas / NULLIF(m.patrimonio_total,0) > 0.4) AS f_trib
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
    COUNT(*) FILTER (WHERE f_imob OR f_inv OR f_emp OR f_cripto OR f_trib)::bigint,
    ROUND(AVG(score)::numeric, 1),
    COUNT(*) FILTER (WHERE id_lead IS NOT NULL)::bigint
  FROM base;
$$;

DROP FUNCTION IF EXISTS public.irpf_inteligencia_facetas(uuid);
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_facetas(_id_empresa uuid)
RETURNS TABLE(ufs text[], exercicios integer[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ARRAY(
      SELECT DISTINCT uf FROM public.mv_irpf_inteligencia
      WHERE id_empresa = _id_empresa AND uf IS NOT NULL AND trim(uf) <> ''
      ORDER BY uf
    ),
    ARRAY(
      SELECT DISTINCT exercicio FROM public.mv_irpf_inteligencia
      WHERE id_empresa = _id_empresa AND exercicio IS NOT NULL
      ORDER BY exercicio DESC
    );
$$;

REFRESH MATERIALIZED VIEW public.mv_irpf_inteligencia;