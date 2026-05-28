-- Saúde de integrações + action_types + Composio fallback
ALTER TABLE public.integracao
  ADD COLUMN IF NOT EXISTS ultimo_erro TEXT,
  ADD COLUMN IF NOT EXISTS ultima_validacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS composio_connected_account_id TEXT;

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS action_types_conversao_default TEXT[]
    DEFAULT ARRAY['lead', 'onsite_conversion.lead_grouped'];

ALTER TABLE public.campanha
  ADD COLUMN IF NOT EXISTS action_types_conversao TEXT[];

ALTER TABLE public.campanha_metricas_dia
  ADD COLUMN IF NOT EXISTS actions_json JSONB;

CREATE INDEX IF NOT EXISTS idx_integracao_erro
  ON public.integracao(id_empresa, tipo)
  WHERE ultimo_erro IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_auditoria_coleta
WITH (security_invoker = true) AS
SELECT
  cm.id_metricas_dia,
  cm.id_campanha,
  c.nome AS nome_campanha,
  c.action_types_conversao AS campanha_action_types,
  cm.data,
  cm.verba_investida,
  cm.leads,
  cm.impressoes,
  cm.cliques,
  cm.actions_json,
  cm.fonte_conversoes,
  ca.id_empresa,
  ca.plataforma,
  e.nome AS nome_empresa,
  e.action_types_conversao_default AS empresa_action_types_default,
  i.id_integracao,
  i.tipo AS tipo_integracao,
  i.ativo AS integracao_ativa,
  i.ultimo_erro,
  i.ultima_validacao,
  i.expira_em
FROM public.campanha_metricas_dia cm
JOIN public.campanha c ON c.id_campanha = cm.id_campanha
JOIN public.conta_anuncio ca ON ca.id_conta = c.id_conta
JOIN public.empresa e ON e.id_empresa = ca.id_empresa
LEFT JOIN public.integracao i
  ON i.id_empresa = ca.id_empresa
  AND ((ca.plataforma = 'META' AND i.tipo = 'META_ADS')
    OR (ca.plataforma = 'GOOGLE' AND i.tipo = 'GOOGLE_ADS'));

COMMENT ON COLUMN public.integracao.ultimo_erro IS 'Última mensagem de erro da API. NULL = saudável.';
COMMENT ON COLUMN public.integracao.composio_connected_account_id IS 'ID da conexão Composio para fallback automático.';
COMMENT ON COLUMN public.empresa.action_types_conversao_default IS 'Lista de action_types do Meta Ads somados como conversão por padrão.';
COMMENT ON COLUMN public.campanha.action_types_conversao IS 'Override de action_types por campanha. NULL = usar default da empresa.';
COMMENT ON COLUMN public.campanha_metricas_dia.actions_json IS 'Array bruto de actions retornado pela API, para recálculo sem nova coleta.';
COMMENT ON VIEW public.vw_auditoria_coleta IS 'Auditoria: métricas + campanha + empresa + saúde da integração.';