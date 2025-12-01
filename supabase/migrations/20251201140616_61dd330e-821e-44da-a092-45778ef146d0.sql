-- Criar tabela para histórico de execução de cronjobs
CREATE TABLE IF NOT EXISTS public.cronjob_execucao (
  id_execucao UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_cronjob TEXT NOT NULL,
  data_execucao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL, -- 'success', 'error', 'running'
  duracao_ms INTEGER,
  mensagem_erro TEXT,
  detalhes_execucao JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cronjob_execucao_nome ON public.cronjob_execucao(nome_cronjob);
CREATE INDEX IF NOT EXISTS idx_cronjob_execucao_data ON public.cronjob_execucao(data_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_cronjob_execucao_status ON public.cronjob_execucao(status);

-- Habilitar RLS
ALTER TABLE public.cronjob_execucao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: apenas admins podem ver e inserir
CREATE POLICY "Admins podem ver histórico de cronjobs"
  ON public.cronjob_execucao
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

CREATE POLICY "Sistema pode inserir histórico de cronjobs"
  ON public.cronjob_execucao
  FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.cronjob_execucao IS 'Histórico de execuções de cronjobs automatizados';
COMMENT ON COLUMN public.cronjob_execucao.nome_cronjob IS 'Nome identificador do cronjob (ex: coletar-criativos-meta)';
COMMENT ON COLUMN public.cronjob_execucao.status IS 'Status da execução: success, error, running';
COMMENT ON COLUMN public.cronjob_execucao.duracao_ms IS 'Duração da execução em milissegundos';
COMMENT ON COLUMN public.cronjob_execucao.detalhes_execucao IS 'Detalhes adicionais da execução em formato JSON';