
-- Materialized view com agregações por declaração IRPF
DROP MATERIALIZED VIEW IF EXISTS public.mv_irpf_inteligencia CASCADE;

CREATE MATERIALIZED VIEW public.mv_irpf_inteligencia AS
WITH bens_agg AS (
  SELECT
    id_declaracao,
    SUM(COALESCE(valor_ano_atual, 0)) AS patrimonio_total,
    SUM(COALESCE(valor_ano_anterior, 0)) AS patrimonio_anterior,
    SUM(CASE WHEN grupo_codigo IN ('01','01-99') THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS imoveis,
    SUM(CASE WHEN grupo_codigo = '02' THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS veiculos,
    SUM(CASE WHEN grupo_codigo = '03' THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS participacoes,
    SUM(CASE WHEN grupo_codigo IN ('04','05') THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS aplicacoes,
    SUM(CASE WHEN grupo_codigo = '06' THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS depositos,
    SUM(CASE WHEN grupo_codigo = '07' THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS fundos,
    SUM(CASE WHEN grupo_codigo = '08' THEN COALESCE(valor_ano_atual,0) ELSE 0 END) AS cripto,
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
)
SELECT
  d.id,
  d.id_empresa,
  d.cpf,
  d.nome_contribuinte,
  d.exercicio,
  d.ano_calendario,
  d.id_lead,
  d.ocupacao_principal_descricao AS ocupacao,
  d.endereco_uf AS uf,
  d.possui_atividade_rural,
  d.resultado_atividade_rural,
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
  COALESCE(b.aplicacoes, 0) + COALESCE(b.fundos, 0) + COALESCE(b.depositos, 0) AS total_investimentos,
  COALESCE(b.qtd_imoveis, 0) AS qtd_imoveis,
  COALESCE(b.qtd_veiculos, 0) AS qtd_veiculos,
  COALESCE(b.qtd_participacoes, 0) AS qtd_participacoes,
  COALESCE(b.qtd_cripto, 0) AS qtd_cripto,
  l.nome_lead,
  l.email AS lead_email,
  l.telefone AS lead_telefone,
  l.stage_atual AS lead_stage,
  l.venda_realizada AS lead_venda_realizada,
  l.tokeniza_investidor AS lead_tokeniza_investidor,
  l.tokeniza_valor_investido AS lead_tokeniza_valor_investido
FROM public.irpf_declaracao d
LEFT JOIN bens_agg b ON b.id_declaracao = d.id
LEFT JOIN dividas_agg dv ON dv.id_declaracao = d.id
LEFT JOIN public.lead l ON l.id_lead = d.id_lead
WHERE d.status_processamento = 'concluido';

CREATE UNIQUE INDEX idx_mv_irpf_inteligencia_id ON public.mv_irpf_inteligencia (id);
CREATE INDEX idx_mv_irpf_inteligencia_empresa ON public.mv_irpf_inteligencia (id_empresa);
CREATE INDEX idx_mv_irpf_inteligencia_pat_liq ON public.mv_irpf_inteligencia (id_empresa, patrimonio_liquido DESC);
CREATE INDEX idx_mv_irpf_inteligencia_invest ON public.mv_irpf_inteligencia (id_empresa, total_investimentos DESC);
CREATE INDEX idx_mv_irpf_inteligencia_var ON public.mv_irpf_inteligencia (id_empresa, variacao_patrimonio DESC);
CREATE INDEX idx_mv_irpf_inteligencia_uf ON public.mv_irpf_inteligencia (uf);
CREATE INDEX idx_mv_irpf_inteligencia_exercicio ON public.mv_irpf_inteligencia (exercicio);
CREATE INDEX idx_mv_irpf_inteligencia_lead ON public.mv_irpf_inteligencia (id_lead);

GRANT SELECT ON public.mv_irpf_inteligencia TO authenticated;

-- Função de refresh (admin/direcao)
CREATE OR REPLACE FUNCTION public.refresh_mv_irpf_inteligencia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_irpf_inteligencia;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_mv_irpf_inteligencia() TO authenticated;
