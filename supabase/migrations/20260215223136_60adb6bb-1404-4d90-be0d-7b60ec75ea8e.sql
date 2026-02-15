
-- Tabela de tarefas agendadas pela IA
CREATE TABLE public.tarefa_agendada_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  id_empresa uuid REFERENCES public.empresa(id_empresa),
  id_conversa uuid REFERENCES public.chat_conversa(id),
  instrucao text NOT NULL,
  data_execucao timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  resultado text,
  enviar_email boolean NOT NULL DEFAULT true,
  email_destino text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

-- RLS
ALTER TABLE public.tarefa_agendada_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem suas proprias tarefas"
  ON public.tarefa_agendada_ia FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios inserem suas proprias tarefas"
  ON public.tarefa_agendada_ia FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam suas proprias tarefas"
  ON public.tarefa_agendada_ia FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios deletam suas proprias tarefas"
  ON public.tarefa_agendada_ia FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role precisa acessar para o executor (sem RLS bypass já é implícito para service_role)
