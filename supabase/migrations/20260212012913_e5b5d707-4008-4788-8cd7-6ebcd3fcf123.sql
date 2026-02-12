
CREATE TABLE public.mautic_segmento_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
  segmento_mautic_id INTEGER NOT NULL,
  segmento_mautic_nome VARCHAR(255) NOT NULL,
  threshold_score INTEGER DEFAULT 50,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segmento_mautic_id)
);

ALTER TABLE public.mautic_segmento_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler mapeamentos"
  ON public.mautic_segmento_empresa FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins podem gerenciar mapeamentos"
  ON public.mautic_segmento_empresa FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'));

INSERT INTO public.mautic_segmento_empresa
  (id_empresa, segmento_mautic_id, segmento_mautic_nome, threshold_score)
VALUES
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 1, '(BLUE) Leads - Quiz Risco Fiscal', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 2, '(BLUE) Leads - LP ir-no-prazo', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 3, '(BLUE) Leads - LP regularizacao-cripto', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 4, '(BLUE) Leads - LP apuracao-darf', 50),
  ('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', 15, 'Tokeniza - Usuarios sem KYC', 50);
