-- Create enum for plataforma if not exists
DO $$ BEGIN
    CREATE TYPE plataforma_otimizacao AS ENUM ('META', 'GOOGLE', 'AMBAS', 'GERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create table for optimization records
CREATE TABLE public.registro_otimizacao (
    id_registro UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    id_empresa UUID REFERENCES public.empresa(id_empresa),
    id_usuario UUID NOT NULL,
    semana_referencia TEXT NOT NULL,
    plataforma plataforma_otimizacao NOT NULL DEFAULT 'GERAL',
    tipo_otimizacao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    impacto_resultado TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registro_otimizacao ENABLE ROW LEVEL SECURITY;

-- Policy: TRAFEGO and DIRECAO can view all records
CREATE POLICY "Users can view optimization records"
ON public.registro_otimizacao
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.perfil IN ('ADMIN', 'DIRECAO', 'TRAFEGO')
    )
);

-- Policy: Any authenticated user can create
CREATE POLICY "Authenticated users can create optimization records"
ON public.registro_otimizacao
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Creator or DIRECAO/ADMIN can update
CREATE POLICY "Creator or admins can update optimization records"
ON public.registro_otimizacao
FOR UPDATE
USING (
    id_usuario = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.perfil IN ('ADMIN', 'DIRECAO')
    )
);

-- Policy: Creator or DIRECAO/ADMIN can delete
CREATE POLICY "Creator or admins can delete optimization records"
ON public.registro_otimizacao
FOR DELETE
USING (
    id_usuario = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.perfil IN ('ADMIN', 'DIRECAO')
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_registro_otimizacao_updated_at
BEFORE UPDATE ON public.registro_otimizacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();