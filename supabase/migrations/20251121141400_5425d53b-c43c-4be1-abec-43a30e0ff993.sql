-- Adicionar sistema de aprovação de usuários
-- Alterar a tabela profiles para incluir status de aprovação
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT false;

-- Atualizar o trigger handle_new_user para não aprovar automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user BOOLEAN;
  user_email TEXT;
BEGIN
  -- Pegar o email do usuário
  user_email := NEW.email;
  
  -- Verificar se é o primeiro usuário (admin inicial)
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;
  
  -- Inserir perfil com aprovação automática apenas para o admin inicial ou admin específico
  INSERT INTO public.profiles (id, nome, perfil, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'perfil')::perfil_usuario, 'TRAFEGO'::perfil_usuario),
    CASE 
      WHEN is_first_user THEN true
      WHEN user_email = 'mychel@blueconsult.com.br' THEN true
      ELSE false
    END
  );
  
  -- Se for o admin, adicionar role de admin
  IF user_email = 'mychel@blueconsult.com.br' OR is_first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar políticas RLS para considerar aprovação
-- Política para visualizar perfis (só aprovados ou próprio perfil)
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver próprio perfil"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- Política para admin aprovar usuários
CREATE POLICY "Admin pode aprovar usuários"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Aprovar o admin inicial se já existir
UPDATE public.profiles 
SET aprovado = true 
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
);

-- Comentário sobre segurança
COMMENT ON COLUMN public.profiles.aprovado IS 'Indica se o usuário foi aprovado pelo administrador para acessar o sistema';