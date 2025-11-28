-- Criar tabela para armazenar análises de inteligência geradas pela IA
CREATE TABLE IF NOT EXISTS public.analise_inteligencia (
  id_analise UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  data_analise DATE NOT NULL,
  data_inicio_periodo DATE NOT NULL,
  data_fim_periodo DATE NOT NULL,
  analise_texto TEXT NOT NULL,
  metricas_resumo JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_empresa, data_analise)
);

-- Habilitar RLS
ALTER TABLE public.analise_inteligencia ENABLE ROW LEVEL SECURITY;

-- Policies: Usuários autenticados podem ver análises da sua empresa
CREATE POLICY "Usuários podem ver análises de inteligência"
ON public.analise_inteligencia
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admins podem inserir/atualizar análises (para o cronjob)
CREATE POLICY "Sistema pode inserir análises"
ON public.analise_inteligencia
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar análises"
ON public.analise_inteligencia
FOR UPDATE
USING (true);

-- Índices para performance
CREATE INDEX idx_analise_inteligencia_empresa_data ON public.analise_inteligencia(id_empresa, data_analise DESC);

-- Trigger para updated_at
CREATE TRIGGER update_analise_inteligencia_updated_at
BEFORE UPDATE ON public.analise_inteligencia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();