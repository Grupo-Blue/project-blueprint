-- Remove the broad ALL policy
DROP POLICY IF EXISTS "Admin pode gerenciar integrações" ON public.integracao;

-- Create separate granular policies for each operation
CREATE POLICY "Admin pode visualizar integrações"
ON public.integracao
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode inserir integrações"
ON public.integracao
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode atualizar integrações"
ON public.integracao
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin pode deletar integrações"
ON public.integracao
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));