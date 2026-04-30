
-- =========================================================
-- Tabela: utm_link
-- Armazena os links UTM gerados pelo Gerador no Guia UTM.
-- Atribuição de leads é feita por JOIN nas colunas utm_* da tabela lead.
-- =========================================================

CREATE TABLE public.utm_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL,
  nome_interno text NOT NULL,
  url_base text NOT NULL,
  utm_source text NOT NULL,
  utm_medium text NOT NULL,
  utm_campaign text NOT NULL,
  utm_content text,
  utm_term text,
  canal text,
  id_campanha uuid,
  id_criativo uuid,
  tags text[] DEFAULT '{}'::text[],
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX utm_link_unique_combo
  ON public.utm_link (
    id_empresa,
    utm_source,
    utm_medium,
    utm_campaign,
    COALESCE(utm_content, ''),
    COALESCE(utm_term, '')
  );

CREATE INDEX utm_link_id_empresa_idx ON public.utm_link (id_empresa);
CREATE INDEX utm_link_utm_campaign_idx ON public.utm_link (utm_campaign);
CREATE INDEX utm_link_utm_content_idx ON public.utm_link (utm_content);

-- updated_at trigger
CREATE TRIGGER utm_link_set_updated_at
BEFORE UPDATE ON public.utm_link
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.utm_link ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
CREATE POLICY "utm_link admin all"
  ON public.utm_link
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Usuários autenticados leem links das empresas que têm acesso
CREATE POLICY "utm_link select por empresa"
  ON public.utm_link
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.id_empresa = utm_link.id_empresa
    )
  );

-- Insert: precisa ter acesso à empresa e ser o created_by
CREATE POLICY "utm_link insert por empresa"
  ON public.utm_link
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.id_empresa = utm_link.id_empresa
    )
  );

-- Update: criador OU usuário com acesso à empresa pode editar
CREATE POLICY "utm_link update por empresa"
  ON public.utm_link
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.id_empresa = utm_link.id_empresa
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_empresa ue
      WHERE ue.user_id = auth.uid()
        AND ue.id_empresa = utm_link.id_empresa
    )
  );

-- =========================================================
-- Função: utm_link_com_contagem
-- Retorna links salvos da empresa + total de leads atribuídos.
-- Match: id_empresa + utm_campaign (obrigatório). Se utm_content
-- estiver no link, exige bater também.
-- =========================================================
CREATE OR REPLACE FUNCTION public.utm_link_com_contagem(_id_empresa uuid)
RETURNS TABLE(
  id uuid,
  id_empresa uuid,
  nome_interno text,
  url_base text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  canal text,
  id_campanha uuid,
  id_criativo uuid,
  tags text[],
  observacoes text,
  ativo boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_leads bigint,
  ultimo_lead_em timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id, u.id_empresa, u.nome_interno, u.url_base,
    u.utm_source, u.utm_medium, u.utm_campaign, u.utm_content, u.utm_term,
    u.canal, u.id_campanha, u.id_criativo, u.tags, u.observacoes,
    u.ativo, u.created_by, u.created_at, u.updated_at,
    COALESCE(c.total_leads, 0) AS total_leads,
    c.ultimo_lead_em
  FROM public.utm_link u
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS total_leads,
           MAX(l.created_at) AS ultimo_lead_em
    FROM public.lead l
    WHERE l.id_empresa = u.id_empresa
      AND l.utm_campaign = u.utm_campaign
      AND (u.utm_content IS NULL OR l.utm_content = u.utm_content)
      AND (u.utm_source IS NULL OR l.utm_source = u.utm_source)
  ) c ON true
  WHERE u.id_empresa = _id_empresa
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_empresa ue
        WHERE ue.user_id = auth.uid() AND ue.id_empresa = _id_empresa
      )
    )
  ORDER BY u.ativo DESC, u.created_at DESC;
$$;
