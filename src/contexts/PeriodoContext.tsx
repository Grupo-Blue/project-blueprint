import React, { createContext, useContext, useState } from "react";

interface PeriodoContextType {
  mesSelecionado: Date;
  semanaSelecionada: string | null;
  setMesSelecionado: (mes: Date) => void;
  setSemanaSelecionada: (semana: string | null) => void;
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const [mesSelecionado, setMesSelecionado] = useState<Date>(new Date());
  const [semanaSelecionada, setSemanaSelecionada] = useState<string | null>(null);

  return (
    <PeriodoContext.Provider
      value={{
        mesSelecionado,
        semanaSelecionada,
        setMesSelecionado,
        setSemanaSelecionada,
      }}
    >
      {children}
    </PeriodoContext.Provider>
  );
}

export function usePeriodo() {
  const context = useContext(PeriodoContext);
  if (context === undefined) {
    throw new Error("usePeriodo must be used within a PeriodoProvider");
  }
  return context;
}
