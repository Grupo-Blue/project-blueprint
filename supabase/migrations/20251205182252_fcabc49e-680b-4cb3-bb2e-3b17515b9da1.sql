-- Fix PUBLIC_DATA_EXPOSURE: Remove permissive lead SELECT policy and create restrictive one
-- Drop the permissive policy that allows anyone to read all leads
DROP POLICY IF EXISTS "Todos podem ver leads" ON public.lead;

-- Create restrictive policy: only authenticated users with appropriate roles can view leads
-- Users can view leads from companies they're linked to, or if they have admin/trafego/sdr roles
CREATE POLICY "Usuarios autenticados podem ver leads de suas empresas" ON public.lead
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'trafego'::app_role) OR
    has_role(auth.uid(), 'sdr'::app_role) OR
    has_role(auth.uid(), 'direcao'::app_role) OR
    EXISTS (SELECT 1 FROM user_empresa WHERE user_id = auth.uid() AND id_empresa = lead.id_empresa)
  )
);