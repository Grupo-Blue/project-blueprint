import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Empresa {
  id_empresa: string;
  nome: string;
}

interface EmpresaContextType {
  empresaSelecionada: string;
  setEmpresaSelecionada: (id: string) => void;
  empresasPermitidas: Empresa[];
  isAdmin: boolean;
  isLoading: boolean;
  hasAccess: boolean;
  nomeEmpresaSelecionada: string | null;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresaSelecionada, setEmpresaSelecionadaState] = useState<string>(() => {
    return localStorage.getItem("sgt_empresa_selecionada") || "";
  });

  // Verificar se é admin
  const { data: isAdmin, isLoading: loadingAdmin } = useQuery({
    queryKey: ["user-is-admin-context"],
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
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar empresas permitidas
  const { data: empresasPermitidas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["user-empresas-context", isAdmin],
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

      return (data || [])
        .map((item: any) => item.empresa)
        .filter((e: any) => e !== null) as Empresa[];
    },
    enabled: isAdmin !== undefined,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingAdmin || loadingEmpresas;
  const hasAccess = isAdmin === true || (empresasPermitidas?.length || 0) > 0;

  // Auto-selecionar empresa quando carregar
  useEffect(() => {
    if (!empresasPermitidas || empresasPermitidas.length === 0) return;

    const savedEmpresa = localStorage.getItem("sgt_empresa_selecionada");
    
    // Verificar se a empresa salva ainda está nas permitidas
    const empresaSalvaValida = savedEmpresa && empresasPermitidas.some(e => e.id_empresa === savedEmpresa);
    
    if (empresaSalvaValida) {
      setEmpresaSelecionadaState(savedEmpresa);
    } else if (empresasPermitidas.length === 1) {
      // Auto-selecionar se tiver apenas 1 empresa
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    } else if (isAdmin && empresasPermitidas.length > 1) {
      // Admin com múltiplas empresas: selecionar "todas"
      setEmpresaSelecionada("todas");
    } else if (empresasPermitidas.length > 0) {
      // Selecionar a primeira se tiver múltiplas
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas, isAdmin]);

  const setEmpresaSelecionada = (id: string) => {
    setEmpresaSelecionadaState(id);
    localStorage.setItem("sgt_empresa_selecionada", id);
  };

  // Obter nome da empresa selecionada
  const nomeEmpresaSelecionada = empresaSelecionada === "todas" 
    ? "Todas as empresas"
    : empresasPermitidas?.find(e => e.id_empresa === empresaSelecionada)?.nome || null;

  return (
    <EmpresaContext.Provider
      value={{
        empresaSelecionada,
        setEmpresaSelecionada,
        empresasPermitidas: empresasPermitidas || [],
        isAdmin: isAdmin || false,
        isLoading,
        hasAccess,
        nomeEmpresaSelecionada,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (context === undefined) {
    throw new Error("useEmpresa must be used within an EmpresaProvider");
  }
  return context;
}
