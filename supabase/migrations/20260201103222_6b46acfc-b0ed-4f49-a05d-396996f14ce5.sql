-- ========================================
-- MIGRAÇÃO 002: Tabelas de Automação
-- Alertas Inteligentes, Relatórios Agendados, Workflows
-- ========================================

-- TABELA 1: Alertas Automáticos
CREATE TABLE IF NOT EXISTS public.alerta_automatico (
  id_alerta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  severidade VARCHAR(20) NOT NULL CHECK (severidade IN ('INFO', 'WARNING', 'CRITICAL')),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  metadados JSONB DEFAULT '{}'::jsonb,
  acionavel BOOLEAN DEFAULT TRUE,
  id_acao UUID REFERENCES public.acao(id_acao) ON DELETE SET NULL,
  visualizado BOOLEAN DEFAULT FALSE,
  resolvido BOOLEAN DEFAULT FALSE,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para alerta_automatico
CREATE INDEX IF NOT EXISTS idx_alerta_empresa ON public.alerta_automatico(id_empresa);
CREATE INDEX IF NOT EXISTS idx_alerta_tipo ON public.alerta_automatico(tipo);
CREATE INDEX IF NOT EXISTS idx_alerta_severidade ON public.alerta_automatico(severidade) WHERE NOT resolvido;
CREATE INDEX IF NOT EXISTS idx_alerta_pendente ON public.alerta_automatico(id_empresa, created_at DESC) WHERE NOT resolvido;
CREATE INDEX IF NOT EXISTS idx_alerta_nao_visualizado ON public.alerta_automatico(id_empresa, created_at DESC) WHERE NOT visualizado;

COMMENT ON TABLE public.alerta_automatico IS 'Alertas gerados automaticamente pelo sistema (ex: CPL alto, lead quente, deal parado)';
COMMENT ON COLUMN public.alerta_automatico.tipo IS 'Tipo: CPL_ALTO, FREQUENCY_ALTA, LEAD_QUENTE, DEAL_PARADO, etc';
COMMENT ON COLUMN public.alerta_automatico.severidade IS 'INFO: informativo, WARNING: atenção necessária, CRITICAL: ação urgente';

-- TABELA 2: Relatórios Agendados
CREATE TABLE IF NOT EXISTS public.relatorio_agendado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('DIARIO', 'SEMANAL', 'MENSAL', 'CUSTOM')),
  id_empresa UUID REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  cron_expression VARCHAR(50) NOT NULL,
  destinatarios TEXT[] NOT NULL,
  formato VARCHAR(20) DEFAULT 'PDF' CHECK (formato IN ('PDF', 'EXCEL', 'JSON', 'HTML')),
  query_template JSONB NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_envio TIMESTAMPTZ,
  proximo_envio TIMESTAMPTZ,
  total_envios INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relatorio_empresa ON public.relatorio_agendado(id_empresa);
CREATE INDEX IF NOT EXISTS idx_relatorio_proximo_envio ON public.relatorio_agendado(proximo_envio) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_relatorio_tipo ON public.relatorio_agendado(tipo);

COMMENT ON TABLE public.relatorio_agendado IS 'Relatórios gerados e enviados automaticamente via email';
COMMENT ON COLUMN public.relatorio_agendado.cron_expression IS 'Expressão cron (ex: "0 8 * * *" = todo dia às 08:00)';

-- TABELA 3: Automações (Workflows If-Then)
CREATE TABLE IF NOT EXISTS public.automacao_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  condicoes JSONB NOT NULL,
  acoes JSONB NOT NULL,
  id_empresa UUID REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  ultima_execucao TIMESTAMPTZ,
  total_execucoes INT DEFAULT 0,
  total_sucessos INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automacao_empresa ON public.automacao_workflow(id_empresa);
CREATE INDEX IF NOT EXISTS idx_automacao_trigger ON public.automacao_workflow(trigger_type) WHERE ativo = TRUE;

COMMENT ON TABLE public.automacao_workflow IS 'Automações if-then (ex: SE lead.score > 50 ENTÃO criar_alerta)';
COMMENT ON COLUMN public.automacao_workflow.trigger_type IS 'Tipo: SCORE_ALTO, DEAL_PARADO, CPL_ALTO, etc';

-- TABELA 4: Log de Execuções de Automação
CREATE TABLE IF NOT EXISTS public.automacao_execucao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_automacao UUID NOT NULL REFERENCES public.automacao_workflow(id) ON DELETE CASCADE,
  sucesso BOOLEAN NOT NULL,
  condicoes_atendidas JSONB,
  acoes_executadas JSONB,
  erro TEXT,
  duracao_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automacao_log_automacao ON public.automacao_execucao_log(id_automacao, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automacao_log_sucesso ON public.automacao_execucao_log(sucesso, created_at DESC);

COMMENT ON TABLE public.automacao_execucao_log IS 'Log de execuções de automações (para debug e auditoria)';

-- TABELA 5: Histórico de Envios de Relatórios
CREATE TABLE IF NOT EXISTS public.relatorio_envio_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_relatorio UUID NOT NULL REFERENCES public.relatorio_agendado(id) ON DELETE CASCADE,
  sucesso BOOLEAN NOT NULL,
  erro TEXT,
  destinatarios_enviados TEXT[],
  tamanho_arquivo_bytes INT,
  url_arquivo TEXT,
  duracao_geracao_ms INT,
  duracao_envio_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relatorio_envio_log_relatorio ON public.relatorio_envio_log(id_relatorio, created_at DESC);

COMMENT ON TABLE public.relatorio_envio_log IS 'Log de envios de relatórios agendados';

-- TRIGGERS: updated_at
CREATE TRIGGER update_alerta_automatico_updated_at
  BEFORE UPDATE ON public.alerta_automatico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_relatorio_agendado_updated_at
  BEFORE UPDATE ON public.relatorio_agendado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automacao_workflow_updated_at
  BEFORE UPDATE ON public.automacao_workflow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Habilitar em todas as tabelas
ALTER TABLE public.alerta_automatico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_agendado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacao_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacao_execucao_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_envio_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies para alerta_automatico
CREATE POLICY alerta_select_policy ON public.alerta_automatico FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()));

CREATE POLICY alerta_insert_policy ON public.alerta_automatico FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()));

CREATE POLICY alerta_update_policy ON public.alerta_automatico FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()));

CREATE POLICY alerta_delete_policy ON public.alerta_automatico FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para relatorio_agendado (só admin pode gerenciar)
CREATE POLICY relatorio_select_policy ON public.relatorio_agendado FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()) OR id_empresa IS NULL);

CREATE POLICY relatorio_modify_policy ON public.relatorio_agendado FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para automacao_workflow (só admin pode gerenciar)
CREATE POLICY automacao_select_policy ON public.automacao_workflow FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()) OR id_empresa IS NULL);

CREATE POLICY automacao_modify_policy ON public.automacao_workflow FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para logs (só admin ou usuário da empresa)
CREATE POLICY automacao_log_select_policy ON public.automacao_execucao_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.automacao_workflow aw
    INNER JOIN public.user_empresa ue ON aw.id_empresa = ue.id_empresa
    WHERE aw.id = id_automacao AND ue.user_id = auth.uid()
  ));

CREATE POLICY relatorio_log_select_policy ON public.relatorio_envio_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.relatorio_agendado ra
    INNER JOIN public.user_empresa ue ON ra.id_empresa = ue.id_empresa
    WHERE ra.id = id_relatorio AND ue.user_id = auth.uid()
  ));