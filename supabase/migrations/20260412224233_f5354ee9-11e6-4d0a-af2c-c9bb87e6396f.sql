
-- Tabela de lotes de importação
CREATE TABLE public.irpf_importacao_lote (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  total_arquivos INTEGER NOT NULL DEFAULT 0,
  processados INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.irpf_importacao_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lotes of their empresas"
ON public.irpf_importacao_lote FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can create lotes"
ON public.irpf_importacao_lote FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "System can update lotes"
ON public.irpf_importacao_lote FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

CREATE TRIGGER update_irpf_importacao_lote_updated_at
BEFORE UPDATE ON public.irpf_importacao_lote
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de fila de arquivos
CREATE TABLE public.irpf_importacao_fila (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lote UUID NOT NULL REFERENCES public.irpf_importacao_lote(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'sucesso', 'erro')),
  resultado JSONB,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.irpf_importacao_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fila of their lotes"
ON public.irpf_importacao_fila FOR SELECT TO authenticated
USING (
  id_lote IN (
    SELECT id FROM public.irpf_importacao_lote
    WHERE public.has_role(auth.uid(), 'admin'::app_role)
    OR id_empresa IN (SELECT id_empresa FROM public.user_empresa WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Authenticated users can create fila items"
ON public.irpf_importacao_fila FOR INSERT TO authenticated
WITH CHECK (
  id_lote IN (SELECT id FROM public.irpf_importacao_lote WHERE created_by = auth.uid())
);

CREATE TRIGGER update_irpf_importacao_fila_updated_at
BEFORE UPDATE ON public.irpf_importacao_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket para PDFs temporários
INSERT INTO storage.buckets (id, name, public) VALUES ('irpf-uploads', 'irpf-uploads', false);

CREATE POLICY "Authenticated users can upload IRPF PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'irpf-uploads');

CREATE POLICY "Authenticated users can read IRPF PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'irpf-uploads');

CREATE POLICY "Service role can delete IRPF PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'irpf-uploads' AND public.has_role(auth.uid(), 'admin'::app_role));
