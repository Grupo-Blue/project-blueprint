import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Empresa {
  id_empresa: string;
  nome: string;
}

interface UseUserEmpresasReturn {
  empresasPermitidas: Empresa[];
  isLoading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
}

export function useUserEmpresas(): UseUserEmpresasReturn {
  // Verificar se é admin
  const { data: isAdmin, isLoading: loadingAdmin } = useQuery({
    queryKey: ["user-is-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      return !!data;
    },
  });

  // Buscar empresas vinculadas ou todas (se admin)
  const { data: empresasPermitidas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["user-empresas-permitidas", isAdmin],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Admin vê todas as empresas
      if (isAdmin) {
        const { data, error } = await supabase
          .from("empresa")
          .select("id_empresa, nome")
          .order("nome");
        
        if (error) throw error;
        return data || [];
      }

      // Outros usuários veem apenas empresas vinculadas
      const { data, error } = await supabase
        .from("user_empresa")
        .select(`
          id_empresa,
          empresa:id_empresa (
            id_empresa,
            nome
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      // Extrair dados das empresas
      return (data || [])
        .map((item: any) => item.empresa)
        .filter((e: any) => e !== null) as Empresa[];
    },
    enabled: isAdmin !== undefined,
  });

  const isLoading = loadingAdmin || loadingEmpresas;
  const hasAccess = isAdmin === true || (empresasPermitidas?.length || 0) > 0;

  return {
    empresasPermitidas: empresasPermitidas || [],
    isLoading,
    isAdmin: isAdmin || false,
    hasAccess,
  };
}
