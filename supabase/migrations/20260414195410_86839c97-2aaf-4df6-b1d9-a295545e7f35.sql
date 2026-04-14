
-- Tabela de perfis ICP
CREATE TABLE public.icp_perfil (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  regras JSONB NOT NULL DEFAULT '{}',
  auto_gerado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.icp_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ICPs of their companies"
ON public.icp_perfil FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert ICPs for their companies"
ON public.icp_perfil FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update ICPs of their companies"
ON public.icp_perfil FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete ICPs of their companies"
ON public.icp_perfil FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

CREATE TRIGGER update_icp_perfil_updated_at
BEFORE UPDATE ON public.icp_perfil
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de match lead×ICP
CREATE TABLE public.icp_match (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lead UUID NOT NULL REFERENCES public.lead(id_lead) ON DELETE CASCADE,
  id_icp UUID NOT NULL REFERENCES public.icp_perfil(id) ON DELETE CASCADE,
  score_match SMALLINT NOT NULL DEFAULT 0,
  campos_match JSONB DEFAULT '[]',
  campos_faltantes JSONB DEFAULT '[]',
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_lead, id_icp)
);

CREATE INDEX idx_icp_match_ranking ON public.icp_match(id_icp, score_match DESC);
CREATE INDEX idx_icp_match_lead ON public.icp_match(id_lead);

ALTER TABLE public.icp_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view matches of their companies"
ON public.icp_match FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_icp IN (
    SELECT id FROM public.icp_perfil
    WHERE id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Service role can manage matches"
ON public.icp_match FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Adicionar id_icp a lead_segmento
ALTER TABLE public.lead_segmento ADD COLUMN IF NOT EXISTS id_icp UUID REFERENCES public.icp_perfil(id) ON DELETE SET NULL;
