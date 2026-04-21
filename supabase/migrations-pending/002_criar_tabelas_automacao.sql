-- ========================================
-- MIGRAÇÃO 002: Tabelas de Automação
-- Alertas Inteligentes, Relatórios Agendados, Workflows
-- 
-- OBJETIVO: Criar infraestrutura para automações:
--   - Alertas automáticos (CPL alto, lead quente, deal parado)
--   - Relatórios agendados (diários, semanais, mensais)
--   - Workflows (if-then rules)
-- ========================================

BEGIN;

-- ========================================
-- TABELA 1: Alertas Automáticos
-- ========================================
CREATE TABLE IF NOT EXISTS public.alerta_automatico (
  id_alerta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de alerta (para filtros e priorização)
  tipo VARCHAR(50) NOT NULL,
  
  -- Severidade
  severidade VARCHAR(20) NOT NULL 
    CHECK (severidade IN ('INFO', 'WARNING', 'CRITICAL')),
  
  -- Empresa afetada
  id_empresa UUID NOT NULL 
    REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  
  -- Conteúdo
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  -- Dados estruturados (ex: CPL atual vs anterior, ID da campanha)
  metadados JSONB DEFAULT '{}'::jsonb,
  
  -- Se o alerta pode virar uma ação
  acionavel BOOLEAN DEFAULT TRUE,
  
  -- Ação criada a partir deste alerta
  id_acao UUID 
    REFERENCES public.acao(id_acao) ON DELETE SET NULL,
  
  -- Status
  visualizado BOOLEAN DEFAULT FALSE,
  resolvido BOOLEAN DEFAULT FALSE,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID 
    REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries comuns
CREATE INDEX idx_alerta_empresa 
  ON public.alerta_automatico(id_empresa);

CREATE INDEX idx_alerta_tipo 
  ON public.alerta_automatico(tipo);

CREATE INDEX idx_alerta_severidade 
  ON public.alerta_automatico(severidade) 
  WHERE NOT resolvido;

-- Índice para dashboard (alertas não resolvidos, ordenados por data)
CREATE INDEX idx_alerta_pendente 
  ON public.alerta_automatico(id_empresa, created_at DESC) 
  WHERE NOT resolvido;

-- Índice para notificações (alertas não visualizados)
CREATE INDEX idx_alerta_nao_visualizado 
  ON public.alerta_automatico(id_empresa, created_at DESC) 
  WHERE NOT visualizado;

-- Comentários
COMMENT ON TABLE public.alerta_automatico IS 
  'Alertas gerados automaticamente pelo sistema (ex: CPL alto, lead quente, deal parado)';

COMMENT ON COLUMN public.alerta_automatico.tipo IS 
  'Tipo de alerta: CPL_ALTO, FREQUENCY_ALTA, LEAD_QUENTE, DEAL_PARADO, etc';

COMMENT ON COLUMN public.alerta_automatico.severidade IS 
  'INFO: informativo, WARNING: atenção necessária, CRITICAL: ação urgente';

COMMENT ON COLUMN public.alerta_automatico.acionavel IS 
  'Se TRUE, alerta pode ser convertido em ação na tabela "acao"';

-- ========================================
-- TABELA 2: Relatórios Agendados
-- ========================================
CREATE TABLE IF NOT EXISTS public.relatorio_agendado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  -- Tipo de relatório
  tipo VARCHAR(50) NOT NULL 
    CHECK (tipo IN ('DIARIO', 'SEMANAL', 'MENSAL', 'CUSTOM')),
  
  -- Empresa (NULL = relatório global)
  id_empresa UUID 
    REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  
  -- Agendamento (expressão cron)
  cron_expression VARCHAR(50) NOT NULL,
  
  -- Destinatários (emails)
  destinatarios TEXT[] NOT NULL,
  
  -- Formato de saída
  formato VARCHAR(20) DEFAULT 'PDF' 
    CHECK (formato IN ('PDF', 'EXCEL', 'JSON', 'HTML')),
  
  -- Template da query (filtros, colunas, período)
  query_template JSONB NOT NULL,
  
  -- Status
  ativo BOOLEAN DEFAULT TRUE,
  
  -- Histórico de execução
  ultimo_envio TIMESTAMPTZ,
  proximo_envio TIMESTAMPTZ,
  total_envios INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_relatorio_empresa 
  ON public.relatorio_agendado(id_empresa);

CREATE INDEX idx_relatorio_proximo_envio 
  ON public.relatorio_agendado(proximo_envio) 
  WHERE ativo = TRUE;

CREATE INDEX idx_relatorio_tipo 
  ON public.relatorio_agendado(tipo);

-- Comentários
COMMENT ON TABLE public.relatorio_agendado IS 
  'Relatórios gerados e enviados automaticamente via email (diários, semanais, mensais)';

COMMENT ON COLUMN public.relatorio_agendado.cron_expression IS 
  'Expressão cron (ex: "0 8 * * *" = todo dia às 08:00, "0 9 * * 1" = toda segunda às 09:00)';

COMMENT ON COLUMN public.relatorio_agendado.query_template IS 
  'Template JSON da query: { "filtros": {...}, "colunas": [...], "periodo": "ultimo_mes" }';

-- ========================================
-- TABELA 3: Automações (Workflows If-Then)
-- ========================================
CREATE TABLE IF NOT EXISTS public.automacao_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  -- Tipo de trigger
  trigger_type VARCHAR(50) NOT NULL,
  
  -- Condições (IF)
  condicoes JSONB NOT NULL,
  
  -- Ações (THEN)
  acoes JSONB NOT NULL,
  
  -- Empresa (NULL = automação global)
  id_empresa UUID 
    REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  
  -- Status
  ativo BOOLEAN DEFAULT TRUE,
  
  -- Estatísticas de execução
  ultima_execucao TIMESTAMPTZ,
  total_execucoes INT DEFAULT 0,
  total_sucessos INT DEFAULT 0,
  total_erros INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_automacao_empresa 
  ON public.automacao_workflow(id_empresa);

CREATE INDEX idx_automacao_trigger 
  ON public.automacao_workflow(trigger_type) 
  WHERE ativo = TRUE;

-- Comentários
COMMENT ON TABLE public.automacao_workflow IS 
  'Automações if-then (ex: SE lead.score > 50 ENTÃO criar_alerta("Lead quente"))';

COMMENT ON COLUMN public.automacao_workflow.trigger_type IS 
  'Tipo de trigger: SCORE_ALTO, DEAL_PARADO, CLIENTE_RISCO, CPL_ALTO, etc';

COMMENT ON COLUMN public.automacao_workflow.condicoes IS 
  'Condições em JSON: { "lead.mautic_score": { "gte": 50 }, "lead.is_mql": false }';

COMMENT ON COLUMN public.automacao_workflow.acoes IS 
  'Ações em JSON: [{ "type": "criar_alerta", "params": {...} }, { "type": "enviar_email", ... }]';

-- ========================================
-- TABELA 4: Log de Execuções de Automação
-- ========================================
CREATE TABLE IF NOT EXISTS public.automacao_execucao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Automação executada
  id_automacao UUID NOT NULL 
    REFERENCES public.automacao_workflow(id) ON DELETE CASCADE,
  
  -- Resultado
  sucesso BOOLEAN NOT NULL,
  
  -- Dados da execução
  condicoes_atendidas JSONB,
  acoes_executadas JSONB,
  erro TEXT,
  
  -- Performance
  duracao_ms INT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_automacao_log_automacao 
  ON public.automacao_execucao_log(id_automacao, created_at DESC);

CREATE INDEX idx_automacao_log_sucesso 
  ON public.automacao_execucao_log(sucesso, created_at DESC);

-- Comentários
COMMENT ON TABLE public.automacao_execucao_log IS 
  'Log de execuções de automações (para debug e auditoria)';

-- ========================================
-- TABELA 5: Histórico de Envios de Relatórios
-- ========================================
CREATE TABLE IF NOT EXISTS public.relatorio_envio_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relatório enviado
  id_relatorio UUID NOT NULL 
    REFERENCES public.relatorio_agendado(id) ON DELETE CASCADE,
  
  -- Resultado
  sucesso BOOLEAN NOT NULL,
  erro TEXT,
  
  -- Dados do envio
  destinatarios_enviados TEXT[],
  tamanho_arquivo_bytes INT,
  url_arquivo TEXT,  -- S3/Storage URL se aplicável
  
  -- Performance
  duracao_geracao_ms INT,
  duracao_envio_ms INT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_relatorio_envio_log_relatorio 
  ON public.relatorio_envio_log(id_relatorio, created_at DESC);

-- Comentários
COMMENT ON TABLE public.relatorio_envio_log IS 
  'Log de envios de relatórios agendados (para auditoria e debug)';

-- ========================================
-- TRIGGERS: updated_at
-- ========================================

-- Trigger para alerta_automatico
CREATE TRIGGER update_alerta_automatico_updated_at
  BEFORE UPDATE ON public.alerta_automatico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para relatorio_agendado
CREATE TRIGGER update_relatorio_agendado_updated_at
  BEFORE UPDATE ON public.relatorio_agendado
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para automacao_workflow
CREATE TRIGGER update_automacao_workflow_updated_at
  BEFORE UPDATE ON public.automacao_workflow
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.alerta_automatico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_agendado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacao_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacao_execucao_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_envio_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para alerta_automatico
CREATE POLICY alerta_select_policy 
  ON public.alerta_automatico 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

CREATE POLICY alerta_insert_policy 
  ON public.alerta_automatico 
  FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

CREATE POLICY alerta_update_policy 
  ON public.alerta_automatico 
  FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  );

CREATE POLICY alerta_delete_policy 
  ON public.alerta_automatico 
  FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Políticas RLS para relatorio_agendado
CREATE POLICY relatorio_select_policy 
  ON public.relatorio_agendado 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    OR id_empresa IS NULL  -- Relatórios globais são visíveis para todos
  );

CREATE POLICY relatorio_modify_policy 
  ON public.relatorio_agendado 
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Políticas RLS para automacao_workflow
CREATE POLICY automacao_select_policy 
  ON public.automacao_workflow 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
    OR id_empresa IS NULL
  );

CREATE POLICY automacao_modify_policy 
  ON public.automacao_workflow 
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Políticas RLS para logs (só admin vê)
CREATE POLICY automacao_log_select_policy 
  ON public.automacao_execucao_log 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.automacao_workflow aw
      INNER JOIN public.user_empresa ue ON aw.id_empresa = ue.id_empresa
      WHERE aw.id = id_automacao AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY relatorio_log_select_policy 
  ON public.relatorio_envio_log 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.relatorio_agendado ra
      INNER JOIN public.user_empresa ue ON ra.id_empresa = ue.id_empresa
      WHERE ra.id = id_relatorio AND ue.user_id = auth.uid()
    )
  );

-- ========================================
-- SEED DATA: Exemplos de Alertas
-- ========================================

-- Inserir tipos de alertas comuns (se não existirem)
-- Nota: Empresa será definida dinamicamente ao criar alertas

-- ========================================
-- ANÁLISE FINAL
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO 002 CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  ✓ alerta_automatico (% índices)', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'alerta_automatico');
  RAISE NOTICE '  ✓ relatorio_agendado (% índices)', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'relatorio_agendado');
  RAISE NOTICE '  ✓ automacao_workflow (% índices)', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'automacao_workflow');
  RAISE NOTICE '  ✓ automacao_execucao_log (% índices)', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'automacao_execucao_log');
  RAISE NOTICE '  ✓ relatorio_envio_log (% índices)', 
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'relatorio_envio_log');
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS habilitado em todas as tabelas';
  RAISE NOTICE '✓ Políticas de segurança aplicadas';
  RAISE NOTICE '✓ Triggers de updated_at criados';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Criar edge function: verificar-alertas-automaticos';
  RAISE NOTICE '  2. Criar edge function: executar-relatorios-agendados';
  RAISE NOTICE '  3. Criar edge function: executar-automacoes-workflow';
  RAISE NOTICE '  4. Criar componentes frontend: AlertasCentral.tsx, RelatoriosAgendados.tsx';
  RAISE NOTICE '  5. Configurar cronjobs externos (cron-job.org ou similar)';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ========================================
-- EXEMPLOS DE USO
-- ========================================

-- Exemplo 1: Criar alerta de CPL alto
/*
INSERT INTO public.alerta_automatico (
  tipo, severidade, id_empresa, titulo, descricao, metadados
) VALUES (
  'CPL_ALTO',
  'WARNING',
  'uuid-da-empresa',
  'CPL da campanha X subiu 40%',
  'O CPL subiu de R$ 50 para R$ 70 nos últimos 3 dias. Investigar criativo ou audiência.',
  '{"campanha_id": "abc123", "cpl_anterior": 50, "cpl_atual": 70, "variacao_percentual": 40}'::jsonb
);
*/

-- Exemplo 2: Criar relatório semanal
/*
INSERT INTO public.relatorio_agendado (
  nome, tipo, id_empresa, cron_expression, destinatarios, formato, query_template
) VALUES (
  'Relatório Semanal de Performance',
  'SEMANAL',
  'uuid-da-empresa',
  '0 9 * * 1',  -- Segunda-feira às 09:00
  ARRAY['diretor@empresa.com', 'gerente@empresa.com'],
  'PDF',
  '{
    "filtros": {
      "periodo": "ultima_semana",
      "metricas": ["cpl", "cac", "roi", "vendas"]
    },
    "agrupamento": "por_campanha",
    "ordenacao": "roi_desc"
  }'::jsonb
);
*/

-- Exemplo 3: Criar automação de lead quente
/*
INSERT INTO public.automacao_workflow (
  nome, trigger_type, condicoes, acoes, id_empresa
) VALUES (
  'Alertar sobre lead quente',
  'SCORE_ALTO',
  '{
    "lead.mautic_score": {"gte": 50},
    "lead.is_mql": false,
    "lead.stage_atual": null
  }'::jsonb,
  '[
    {
      "type": "criar_alerta",
      "params": {
        "tipo": "LEAD_QUENTE",
        "severidade": "WARNING",
        "titulo": "Lead qualificado detectado",
        "descricao": "Lead {{lead.nome_lead}} atingiu score 50+ e ainda não foi contatado"
      }
    },
    {
      "type": "atribuir_lead_sdr",
      "params": {
        "metodo": "round_robin"
      }
    }
  ]'::jsonb,
  'uuid-da-empresa'
);
*/
