
CREATE TABLE public.extracao_lead_frio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_extracao text NOT NULL,
  parametros jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDENTE',
  apify_run_id text,
  total_resultados int DEFAULT 0,
  resultados jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extracao_lead_frio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own extractions"
  ON public.extracao_lead_frio FOR SELECT TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create own extractions"
  ON public.extracao_lead_frio FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users update own extractions"
  ON public.extracao_lead_frio FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_extracao_lead_frio_updated_at
  BEFORE UPDATE ON public.extracao_lead_frio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
