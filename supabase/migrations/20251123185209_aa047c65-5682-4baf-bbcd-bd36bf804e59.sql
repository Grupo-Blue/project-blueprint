-- Remove a política que permite acesso público
DROP POLICY IF EXISTS "Todos podem ver empresas" ON public.empresa;

-- Cria política restrita para usuários autenticados apenas
CREATE POLICY "Usuários autenticados podem ver empresas"
ON public.empresa
FOR SELECT
TO authenticated
USING (true);