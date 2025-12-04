-- Criar tabela de vínculo usuário-empresa
CREATE TABLE public.user_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, id_empresa)
);

-- Habilitar RLS
ALTER TABLE public.user_empresa ENABLE ROW LEVEL SECURITY;

-- RLS: Admin gerencia todos os vínculos
CREATE POLICY "Admin gerencia user_empresa" ON public.user_empresa
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Usuário vê apenas próprios vínculos
CREATE POLICY "Usuario ve proprios vinculos" ON public.user_empresa
FOR SELECT USING (user_id = auth.uid());

-- Índices para performance
CREATE INDEX idx_user_empresa_user ON public.user_empresa(user_id);
CREATE INDEX idx_user_empresa_empresa ON public.user_empresa(id_empresa);