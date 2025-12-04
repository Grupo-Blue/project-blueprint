-- Criar tabela para armazenar emails ignorados no merge
CREATE TABLE public.merge_ignorado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  motivo text,
  ignorado_por uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(email, id_empresa)
);

-- Habilitar RLS
ALTER TABLE public.merge_ignorado ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver merge_ignorado" 
ON public.merge_ignorado 
FOR SELECT 
USING (true);

CREATE POLICY "Roles autorizados podem inserir merge_ignorado" 
ON public.merge_ignorado 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role) OR 
  has_role(auth.uid(), 'sdr'::app_role)
);

CREATE POLICY "Roles autorizados podem deletar merge_ignorado" 
ON public.merge_ignorado 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'direcao'::app_role) OR 
  has_role(auth.uid(), 'sdr'::app_role)
);

-- Índice para busca por email
CREATE INDEX idx_merge_ignorado_email ON public.merge_ignorado(email);
CREATE INDEX idx_merge_ignorado_empresa ON public.merge_ignorado(id_empresa);