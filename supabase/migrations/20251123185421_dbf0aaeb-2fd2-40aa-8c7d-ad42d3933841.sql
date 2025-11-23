-- Remove a política que mistura acesso de usuário e admin
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON public.profiles;

-- Cria política separada para usuários verem APENAS seu próprio perfil
CREATE POLICY "Usuários podem ver apenas próprio perfil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- A política de admin já existe separadamente: "Admin pode ver todos perfis"