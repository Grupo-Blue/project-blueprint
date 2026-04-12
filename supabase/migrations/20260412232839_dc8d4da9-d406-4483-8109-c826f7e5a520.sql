CREATE POLICY "Users can update fila of their lotes"
ON public.irpf_importacao_fila
FOR UPDATE
USING (
  id_lote IN (
    SELECT id FROM public.irpf_importacao_lote
    WHERE has_role(auth.uid(), 'admin'::app_role)
       OR created_by = auth.uid()
  )
);