
-- Adicionar colunas de tracking na tabela lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS fbp text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS fbc text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS gclid text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS gbraid text;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS lp_prefix text;

-- Criar tabela de mapeamento pipeline -> empresa
CREATE TABLE IF NOT EXISTS public.pipeline_empresa_mapa (
  pipeline_id text PRIMARY KEY,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: leitura pública (usado por edge functions com service role)
ALTER TABLE public.pipeline_empresa_mapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.pipeline_empresa_mapa
  FOR ALL USING (true);

-- Inserir mapeamentos iniciais
INSERT INTO public.pipeline_empresa_mapa (pipeline_id, id_empresa) VALUES
  ('5', '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db'),
  ('9', '61b5ffeb-fbbc-47c1-8ced-152bb647ed20')
ON CONFLICT (pipeline_id) DO NOTHING;
