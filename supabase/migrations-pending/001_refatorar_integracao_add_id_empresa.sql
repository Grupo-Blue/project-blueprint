-- ========================================
-- MIGRAÇÃO 001: Refatorar tabela integracao
-- Extrair id_empresa de config_json para coluna dedicada
-- 
-- PROBLEMA: id_empresa armazenado em JSONB impede:
--   - Filtros eficientes por empresa
--   - Foreign keys e integridade referencial
--   - Row Level Security (RLS)
--   - Índices otimizados
-- 
-- SOLUÇÃO: Adicionar coluna id_empresa com FK para empresa
-- ========================================

BEGIN;

-- ========================================
-- PASSO 1: Adicionar coluna id_empresa
-- ========================================
ALTER TABLE public.integracao 
  ADD COLUMN id_empresa UUID;

COMMENT ON COLUMN public.integracao.id_empresa IS 
  'ID da empresa dona desta integração (extraído de config_json em migração)';

-- ========================================
-- PASSO 2: Preencher id_empresa de todas as integrações existentes
-- ========================================
UPDATE public.integracao 
SET id_empresa = (config_json->>'id_empresa')::UUID
WHERE config_json->>'id_empresa' IS NOT NULL;

-- Verificar se existem integrações sem id_empresa
DO $$
DECLARE
  missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.integracao
  WHERE id_empresa IS NULL;
  
  IF missing_count > 0 THEN
    RAISE WARNING 'ATENÇÃO: % integrações sem id_empresa no config_json. Corrigir manualmente antes de continuar.', missing_count;
  ELSE
    RAISE NOTICE '✓ Todas as % integrações têm id_empresa preenchido', (SELECT COUNT(*) FROM public.integracao);
  END IF;
END $$;

-- ========================================
-- PASSO 3: Adicionar constraints
-- ========================================

-- NOT NULL (todas integrações DEVEM ter empresa)
ALTER TABLE public.integracao 
  ALTER COLUMN id_empresa SET NOT NULL;

-- Foreign Key (garante integridade referencial)
ALTER TABLE public.integracao 
  ADD CONSTRAINT fk_integracao_empresa 
  FOREIGN KEY (id_empresa) 
  REFERENCES public.empresa(id_empresa) 
  ON DELETE CASCADE;  -- Se empresa for deletada, suas integrações também serão

COMMENT ON CONSTRAINT fk_integracao_empresa ON public.integracao IS 
  'Garante que toda integração pertence a uma empresa válida. Cascade delete para limpeza automática.';

-- ========================================
-- PASSO 4: Criar índices para performance
-- ========================================

-- Índice simples (queries por empresa)
CREATE INDEX idx_integracao_empresa 
  ON public.integracao(id_empresa);

-- Índice composto (queries por empresa + tipo, filtradas por ativo)
CREATE INDEX idx_integracao_empresa_tipo_ativo 
  ON public.integracao(id_empresa, tipo) 
  WHERE ativo = TRUE;

COMMENT ON INDEX idx_integracao_empresa IS 
  'Otimiza queries que buscam integrações de uma empresa específica';

COMMENT ON INDEX idx_integracao_empresa_tipo_ativo IS 
  'Otimiza queries que buscam integrações ativas de um tipo específico (ex: META_ADS)';

-- ========================================
-- PASSO 5: Limpar config_json (remover id_empresa duplicado)
-- ========================================
UPDATE public.integracao 
SET config_json = config_json - 'id_empresa';

RAISE NOTICE '✓ id_empresa removido de config_json para evitar redundância';

-- ========================================
-- PASSO 6: Habilitar Row Level Security (RLS)
-- ========================================
ALTER TABLE public.integracao ENABLE ROW LEVEL SECURITY;

RAISE NOTICE '✓ RLS habilitado na tabela integracao';

-- ========================================
-- PASSO 7: Criar políticas RLS
-- ========================================

-- Política de SELECT: Usuário só vê integrações de suas empresas
CREATE POLICY integracao_select_policy 
  ON public.integracao 
  FOR SELECT 
  USING (
    -- Admin vê todas as integrações
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
    OR
    -- Outros usuários só veem integrações de empresas que têm acesso
    id_empresa IN (
      SELECT id_empresa 
      FROM public.user_empresa 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY integracao_select_policy ON public.integracao IS 
  'Usuários veem apenas integrações de empresas que têm acesso. Admins veem tudo.';

-- Política de INSERT: Só pode criar integração para empresas que tem acesso
CREATE POLICY integracao_insert_policy 
  ON public.integracao 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
    OR
    id_empresa IN (
      SELECT id_empresa 
      FROM public.user_empresa 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY integracao_insert_policy ON public.integracao IS 
  'Usuários só podem criar integrações para empresas que têm acesso.';

-- Política de UPDATE: Só pode atualizar integrações de suas empresas
CREATE POLICY integracao_update_policy 
  ON public.integracao 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
    OR
    id_empresa IN (
      SELECT id_empresa 
      FROM public.user_empresa 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY integracao_update_policy ON public.integracao IS 
  'Usuários só podem atualizar integrações de empresas que têm acesso.';

-- Política de DELETE: Só pode deletar integrações de suas empresas
CREATE POLICY integracao_delete_policy 
  ON public.integracao 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
    OR
    id_empresa IN (
      SELECT id_empresa 
      FROM public.user_empresa 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY integracao_delete_policy ON public.integracao IS 
  'Usuários só podem deletar integrações de empresas que têm acesso.';

-- ========================================
-- PASSO 8: Atualizar trigger de updated_at (se não existir)
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'update_integracao_updated_at'
  ) THEN
    CREATE TRIGGER update_integracao_updated_at
    BEFORE UPDATE ON public.integracao
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
    
    RAISE NOTICE '✓ Trigger update_integracao_updated_at criado';
  ELSE
    RAISE NOTICE '✓ Trigger update_integracao_updated_at já existe';
  END IF;
END $$;

-- ========================================
-- PASSO 9: Análise final
-- ========================================
DO $$
DECLARE
  total_integracoes INT;
  integracoes_por_empresa RECORD;
BEGIN
  -- Contar total
  SELECT COUNT(*) INTO total_integracoes FROM public.integracao;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de integrações migradas: %', total_integracoes;
  RAISE NOTICE '';
  RAISE NOTICE 'Distribuição por empresa:';
  
  -- Listar integrações por empresa
  FOR integracoes_por_empresa IN
    SELECT 
      e.nome AS empresa_nome,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE i.ativo) AS ativas,
      COUNT(*) FILTER (WHERE NOT i.ativo) AS inativas
    FROM public.integracao i
    INNER JOIN public.empresa e ON i.id_empresa = e.id_empresa
    GROUP BY e.nome
    ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  • %: % integrações (% ativas, % inativas)', 
      integracoes_por_empresa.empresa_nome,
      integracoes_por_empresa.total,
      integracoes_por_empresa.ativas,
      integracoes_por_empresa.inativas;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS habilitado com 4 políticas';
  RAISE NOTICE '✓ 2 índices criados para performance';
  RAISE NOTICE '✓ Foreign key para empresa adicionada';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '  1. Atualizar queries no frontend (adicionar .eq("id_empresa", empresaSelecionada))';
  RAISE NOTICE '  2. Atualizar edge functions que acessam integracao';
  RAISE NOTICE '  3. Testar RLS com usuário não-admin';
  RAISE NOTICE '  4. Monitorar performance das queries';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ========================================
-- ROLLBACK (se necessário)
-- ========================================
-- Para reverter esta migração, execute:
-- 
-- BEGIN;
-- DROP POLICY IF EXISTS integracao_delete_policy ON public.integracao;
-- DROP POLICY IF EXISTS integracao_update_policy ON public.integracao;
-- DROP POLICY IF EXISTS integracao_insert_policy ON public.integracao;
-- DROP POLICY IF EXISTS integracao_select_policy ON public.integracao;
-- ALTER TABLE public.integracao DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_integracao_empresa_tipo_ativo;
-- DROP INDEX IF EXISTS idx_integracao_empresa;
-- ALTER TABLE public.integracao DROP CONSTRAINT fk_integracao_empresa;
-- 
-- -- Re-adicionar id_empresa ao config_json
-- UPDATE public.integracao 
-- SET config_json = jsonb_set(config_json, '{id_empresa}', to_jsonb(id_empresa::text));
-- 
-- ALTER TABLE public.integracao DROP COLUMN id_empresa;
-- COMMIT;
