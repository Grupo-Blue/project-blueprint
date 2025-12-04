-- Criar tabela de mapeamento de projetos Tokeniza
CREATE TABLE public.tokeniza_projeto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tokeniza_projeto ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin pode gerenciar tokeniza_projeto" 
ON public.tokeniza_projeto 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver tokeniza_projeto" 
ON public.tokeniza_projeto 
FOR SELECT 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_tokeniza_projeto_updated_at
BEFORE UPDATE ON public.tokeniza_projeto
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo no lead para nome do projeto
ALTER TABLE public.lead ADD COLUMN tokeniza_projeto_nome text;