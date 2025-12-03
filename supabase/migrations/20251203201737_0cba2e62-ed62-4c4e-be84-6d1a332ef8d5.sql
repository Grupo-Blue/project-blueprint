-- Tabela para armazenar usuários Tokeniza (mapeamento ID → email)
CREATE TABLE public.tokeniza_usuario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_tokeniza TEXT NOT NULL UNIQUE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  cpf TEXT,
  cnpj TEXT,
  data_cadastro TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tokeniza_usuario ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Todos podem ver tokeniza_usuario" 
ON public.tokeniza_usuario 
FOR SELECT 
USING (true);

CREATE POLICY "Sistema pode gerenciar tokeniza_usuario" 
ON public.tokeniza_usuario 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index para busca rápida
CREATE INDEX idx_tokeniza_usuario_email ON public.tokeniza_usuario(email);
CREATE INDEX idx_tokeniza_usuario_user_id ON public.tokeniza_usuario(user_id_tokeniza);

-- Adicionar campos de enriquecimento Tokeniza na tabela lead
ALTER TABLE public.lead
ADD COLUMN IF NOT EXISTS tokeniza_user_id TEXT,
ADD COLUMN IF NOT EXISTS tokeniza_investidor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tokeniza_valor_investido NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokeniza_qtd_investimentos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokeniza_primeiro_investimento TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tokeniza_ultimo_investimento TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tokeniza_projetos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tokeniza_carrinho_abandonado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tokeniza_valor_carrinho NUMERIC DEFAULT 0;

-- Index para filtro por investidor
CREATE INDEX IF NOT EXISTS idx_lead_tokeniza_investidor ON public.lead(tokeniza_investidor);
CREATE INDEX IF NOT EXISTS idx_lead_tokeniza_user_id ON public.lead(tokeniza_user_id);