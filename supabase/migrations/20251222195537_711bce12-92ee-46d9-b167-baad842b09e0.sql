-- Tabela para configuração Stape por empresa
CREATE TABLE public.empresa_stape_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  meta_pixel_id text,
  meta_capi_token text,
  stape_container_id text,
  stape_container_url text,
  stape_region text DEFAULT 'global',
  stape_api_key text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(id_empresa)
);

-- Enable RLS
ALTER TABLE public.empresa_stape_config ENABLE ROW LEVEL SECURITY;

-- Admin e Tráfego podem gerenciar
CREATE POLICY "Admin e Tráfego podem gerenciar stape config"
ON public.empresa_stape_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trafego'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_empresa_stape_config_updated_at
BEFORE UPDATE ON public.empresa_stape_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();