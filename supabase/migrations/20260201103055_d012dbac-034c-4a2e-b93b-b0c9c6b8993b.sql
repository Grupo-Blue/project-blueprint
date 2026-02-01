-- ========================================
-- MIGRAÇÃO 001: Refatorar tabela integracao
-- Extrair id_empresa de config_json para coluna dedicada
-- ADAPTADA para usar has_role() existente no projeto
-- ========================================

-- PASSO 1: Adicionar coluna id_empresa (nullable primeiro)
ALTER TABLE public.integracao
  ADD COLUMN IF NOT EXISTS id_empresa UUID;

COMMENT ON COLUMN public.integracao.id_empresa IS
  'ID da empresa dona desta integração (extraído de config_json em migração)';

-- PASSO 2: Preencher id_empresa de integrações existentes
-- Caso normal: id_empresa diretamente no config_json
UPDATE public.integracao
SET id_empresa = (config_json->>'id_empresa')::UUID
WHERE config_json->>'id_empresa' IS NOT NULL
  AND id_empresa IS NULL;

-- Caso especial: CHATWOOT multi-empresa (usar primeira empresa do array)
UPDATE public.integracao
SET id_empresa = ((config_json->'empresas'->0->>'id_empresa')::UUID)
WHERE tipo = 'CHATWOOT'
  AND config_json->>'id_empresa' IS NULL
  AND config_json->'empresas' IS NOT NULL
  AND id_empresa IS NULL;

-- PASSO 3: Adicionar NOT NULL constraint
ALTER TABLE public.integracao
  ALTER COLUMN id_empresa SET NOT NULL;

-- PASSO 4: Adicionar Foreign Key
ALTER TABLE public.integracao
  ADD CONSTRAINT fk_integracao_empresa
  FOREIGN KEY (id_empresa)
  REFERENCES public.empresa(id_empresa)
  ON DELETE CASCADE;

-- PASSO 5: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_integracao_empresa
  ON public.integracao(id_empresa);

CREATE INDEX IF NOT EXISTS idx_integracao_empresa_tipo_ativo
  ON public.integracao(id_empresa, tipo)
  WHERE ativo = TRUE;

-- PASSO 6: Limpar config_json (remover id_empresa duplicado)
UPDATE public.integracao
SET config_json = config_json - 'id_empresa'
WHERE config_json ? 'id_empresa';

-- PASSO 7: Habilitar Row Level Security (RLS)
ALTER TABLE public.integracao ENABLE ROW LEVEL SECURITY;

-- PASSO 8: Criar políticas RLS usando has_role() existente
-- Política SELECT
CREATE POLICY integracao_select_policy
  ON public.integracao
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id_empresa IN (
      SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );

-- Política INSERT
CREATE POLICY integracao_insert_policy
  ON public.integracao
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR id_empresa IN (
      SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );

-- Política UPDATE
CREATE POLICY integracao_update_policy
  ON public.integracao
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id_empresa IN (
      SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );

-- Política DELETE
CREATE POLICY integracao_delete_policy
  ON public.integracao
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- PASSO 9: Trigger de updated_at (se não existir)
DROP TRIGGER IF EXISTS update_integracao_updated_at ON public.integracao;
CREATE TRIGGER update_integracao_updated_at
  BEFORE UPDATE ON public.integracao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();