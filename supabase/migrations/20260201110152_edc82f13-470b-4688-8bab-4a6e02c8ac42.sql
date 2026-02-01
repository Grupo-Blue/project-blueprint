-- ============================================
-- PHASE 2: Pipedrive Activities Infrastructure
-- ============================================

-- Tabela para atividades do Pipedrive (calls, meetings, tasks)
CREATE TABLE public.pipedrive_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  id_activity_externo TEXT NOT NULL,
  id_lead_externo TEXT,
  id_deal_externo TEXT,
  id_person_externo TEXT,
  tipo TEXT NOT NULL, -- call, meeting, task, deadline, email, lunch
  subject TEXT,
  note TEXT,
  done BOOLEAN DEFAULT false,
  due_date DATE,
  due_time TIME,
  duration INTEGER, -- minutos
  add_time TIMESTAMP WITH TIME ZONE,
  marked_as_done_time TIMESTAMP WITH TIME ZONE,
  assigned_to_user_id TEXT,
  assigned_to_user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pipedrive_activity_unique UNIQUE (id_empresa, id_activity_externo)
);

-- Tabela para notas do Pipedrive
CREATE TABLE public.pipedrive_note (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa) ON DELETE CASCADE,
  id_note_externo TEXT NOT NULL,
  id_lead_externo TEXT,
  id_deal_externo TEXT,
  id_person_externo TEXT,
  content TEXT,
  add_time TIMESTAMP WITH TIME ZONE,
  update_time TIMESTAMP WITH TIME ZONE,
  user_id TEXT,
  user_name TEXT,
  pinned_to_deal BOOLEAN DEFAULT false,
  pinned_to_person BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pipedrive_note_unique UNIQUE (id_empresa, id_note_externo)
);

-- Índices para performance
CREATE INDEX idx_pipedrive_activity_empresa ON public.pipedrive_activity(id_empresa);
CREATE INDEX idx_pipedrive_activity_deal ON public.pipedrive_activity(id_deal_externo);
CREATE INDEX idx_pipedrive_activity_lead ON public.pipedrive_activity(id_lead_externo);
CREATE INDEX idx_pipedrive_activity_done ON public.pipedrive_activity(done);
CREATE INDEX idx_pipedrive_activity_due_date ON public.pipedrive_activity(due_date);

CREATE INDEX idx_pipedrive_note_empresa ON public.pipedrive_note(id_empresa);
CREATE INDEX idx_pipedrive_note_deal ON public.pipedrive_note(id_deal_externo);
CREATE INDEX idx_pipedrive_note_lead ON public.pipedrive_note(id_lead_externo);

-- Enable RLS
ALTER TABLE public.pipedrive_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_note ENABLE ROW LEVEL SECURITY;

-- RLS Policies para pipedrive_activity
CREATE POLICY "Admins podem ver todas as atividades Pipedrive"
  ON public.pipedrive_activity FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver atividades de suas empresas"
  ON public.pipedrive_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_empresa ue 
      WHERE ue.user_id = auth.uid() 
      AND ue.id_empresa = pipedrive_activity.id_empresa
    )
  );

CREATE POLICY "Admins podem inserir atividades Pipedrive"
  ON public.pipedrive_activity FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar atividades Pipedrive"
  ON public.pipedrive_activity FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar atividades Pipedrive"
  ON public.pipedrive_activity FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para pipedrive_note
CREATE POLICY "Admins podem ver todas as notas Pipedrive"
  ON public.pipedrive_note FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver notas de suas empresas"
  ON public.pipedrive_note FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_empresa ue 
      WHERE ue.user_id = auth.uid() 
      AND ue.id_empresa = pipedrive_note.id_empresa
    )
  );

CREATE POLICY "Admins podem inserir notas Pipedrive"
  ON public.pipedrive_note FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar notas Pipedrive"
  ON public.pipedrive_note FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar notas Pipedrive"
  ON public.pipedrive_note FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_pipedrive_activity_updated_at
  BEFORE UPDATE ON public.pipedrive_activity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipedrive_note_updated_at
  BEFORE UPDATE ON public.pipedrive_note
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();