-- Criar tabela webhook_destino para armazenar URLs de destino
CREATE TABLE public.webhook_destino (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  id_empresa UUID REFERENCES public.empresa(id_empresa),
  ativo BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}',
  eventos TEXT[] DEFAULT ARRAY['lead_criado', 'lead_atualizado', 'enriquecimento'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela lead_webhook_log para histórico de envios
CREATE TABLE public.lead_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_lead UUID REFERENCES public.lead(id_lead),
  id_webhook_destino UUID REFERENCES public.webhook_destino(id),
  evento VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL,
  status_code INTEGER,
  resposta TEXT,
  tentativas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar coluna webhook_enviado_em na tabela lead
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS webhook_enviado_em TIMESTAMPTZ;

-- Habilitar RLS
ALTER TABLE public.webhook_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_webhook_log ENABLE ROW LEVEL SECURITY;

-- Políticas para webhook_destino
CREATE POLICY "Admin pode gerenciar webhook_destino"
ON public.webhook_destino
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Direcao pode ver webhook_destino"
ON public.webhook_destino
FOR SELECT
USING (has_role(auth.uid(), 'direcao'::app_role));

-- Políticas para lead_webhook_log
CREATE POLICY "Admin pode ver webhook_log"
ON public.lead_webhook_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir webhook_log"
ON public.lead_webhook_log
FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_webhook_destino_updated_at
BEFORE UPDATE ON public.webhook_destino
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();