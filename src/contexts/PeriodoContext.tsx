import React, { createContext, useContext, useState } from "react";

export type TipoFiltroPeriodo = "mes_atual" | "mes_anterior" | "data_especifica" | "semana_especifica";

interface PeriodoContextType {
  tipoFiltro: TipoFiltroPeriodo;
  dataEspecifica: Date | null;
  semanaSelecionada: string | null;
  setTipoFiltro: (tipo: TipoFiltroPeriodo) => void;
  setDataEspecifica: (data: Date | null) => void;
  setSemanaSelecionada: (semana: string | null) => void;
  getDataReferencia: () => Date;
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltroPeriodo>("mes_atual");
  const [dataEspecifica, setDataEspecifica] = useState<Date | null>(null);
  const [semanaSelecionada, setSemanaSelecionada] = useState<string | null>(null);

  const getDataReferencia = () => {
    const hoje = new Date();
    
    switch (tipoFiltro) {
      case "mes_atual":
        return hoje;
      case "mes_anterior":
        const mesAnterior = new Date(hoje);
        mesAnterior.setMonth(mesAnterior.getMonth() - 1);
        return mesAnterior;
      case "data_especifica":
        return dataEspecifica || hoje;
      default:
        return hoje;
    }
  };

  return (
    <PeriodoContext.Provider
      value={{
        tipoFiltro,
        dataEspecifica,
        semanaSelecionada,
        setTipoFiltro,
        setDataEspecifica,
        setSemanaSelecionada,
        getDataReferencia,
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
