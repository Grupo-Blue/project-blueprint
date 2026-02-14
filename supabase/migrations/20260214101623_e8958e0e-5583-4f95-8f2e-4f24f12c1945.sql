
-- Tabela de conversas do chat IA
CREATE TABLE public.chat_conversa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  id_empresa UUID REFERENCES public.empresa(id_empresa),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens do chat IA
CREATE TABLE public.chat_mensagem (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_conversa UUID NOT NULL REFERENCES public.chat_conversa(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_chat_conversa_user ON public.chat_conversa(user_id);
CREATE INDEX idx_chat_mensagem_conversa ON public.chat_mensagem(id_conversa);

-- RLS
ALTER TABLE public.chat_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagem ENABLE ROW LEVEL SECURITY;

-- Políticas chat_conversa
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversa FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.chat_conversa FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.chat_conversa FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversa FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas chat_mensagem (via join com conversa)
CREATE POLICY "Users can view messages of own conversations"
  ON public.chat_mensagem FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversa c
    WHERE c.id = id_conversa AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.chat_mensagem FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_conversa c
    WHERE c.id = id_conversa AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages of own conversations"
  ON public.chat_mensagem FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversa c
    WHERE c.id = id_conversa AND c.user_id = auth.uid()
  ));

-- Trigger updated_at
CREATE TRIGGER update_chat_conversa_updated_at
  BEFORE UPDATE ON public.chat_conversa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
