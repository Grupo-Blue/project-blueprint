import React, { createContext, useContext, useState } from "react";

export type TipoFiltroPeriodo = "mes_atual" | "mes_anterior" | "data_especifica";

interface PeriodoContextType {
  tipoFiltro: TipoFiltroPeriodo;
  dataEspecifica: Date | null;
  setTipoFiltro: (tipo: TipoFiltroPeriodo) => void;
  setDataEspecifica: (data: Date | null) => void;
  getDataReferencia: () => Date;
  getInicioFim: () => { inicio: Date; fim: Date };
  labelPeriodo: string;
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const [tipoFiltro, setTipoFiltroState] = useState<TipoFiltroPeriodo>(() => {
    const saved = localStorage.getItem("sgt_tipo_filtro_periodo");
    return (saved as TipoFiltroPeriodo) || "mes_atual";
  });

  const [dataEspecifica, setDataEspecificaState] = useState<Date | null>(() => {
    const saved = localStorage.getItem("sgt_data_especifica");
    return saved ? new Date(saved) : null;
  });

  const setTipoFiltro = (tipo: TipoFiltroPeriodo) => {
    setTipoFiltroState(tipo);
    localStorage.setItem("sgt_tipo_filtro_periodo", tipo);
  };

  const setDataEspecifica = (data: Date | null) => {
    setDataEspecificaState(data);
    if (data) {
      localStorage.setItem("sgt_data_especifica", data.toISOString());
    } else {
      localStorage.removeItem("sgt_data_especifica");
    }
  };

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

  // Label do período para exibição
  const getLabelPeriodo = () => {
    const dataRef = getDataReferencia();
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    
    switch (tipoFiltro) {
      case "mes_atual":
        return "Mês Atual";
      case "mes_anterior":
        return "Mês Anterior";
      case "data_especifica":
        return `${meses[dataRef.getMonth()]} ${dataRef.getFullYear()}`;
      default:
        return "Período";
    }
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
        labelPeriodo: getLabelPeriodo(),
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
