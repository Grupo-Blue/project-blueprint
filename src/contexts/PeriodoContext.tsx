import React, { createContext, useContext, useState } from "react";

export type TipoFiltroPeriodo = "mes_atual" | "mes_anterior" | "data_especifica";

interface PeriodoContextType {
  tipoFiltro: TipoFiltroPeriodo;
  dataEspecifica: Date | null;
  setTipoFiltro: (tipo: TipoFiltroPeriodo) => void;
  setDataEspecifica: (data: Date | null) => void;
  getDataReferencia: () => Date;
  getInicioFim: () => { inicio: Date; fim: Date };
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltroPeriodo>("mes_atual");
  const [dataEspecifica, setDataEspecifica] = useState<Date | null>(null);

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

  const getInicioFim = () => {
    const dataRef = getDataReferencia();
    const inicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
    const fim = new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 0);
    return { inicio, fim };
  };

  return (
    <PeriodoContext.Provider
      value={{
        tipoFiltro,
        dataEspecifica,
        setTipoFiltro,
        setDataEspecifica,
        getDataReferencia,
        getInicioFim,
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
