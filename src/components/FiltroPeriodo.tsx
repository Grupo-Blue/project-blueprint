import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePeriodo, TipoFiltroPeriodo } from "@/contexts/PeriodoContext";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function FiltroPeriodo() {
  const { tipoFiltro, dataEspecifica, setTipoFiltro, setDataEspecifica, getDataReferencia } = usePeriodo();

  const dataReferencia = getDataReferencia();

  const handleTipoChange = (value: string) => {
    const novoTipo = value as TipoFiltroPeriodo;
    setTipoFiltro(novoTipo);
    
    if (novoTipo !== "data_especifica") {
      setDataEspecifica(null);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      
      <Select value={tipoFiltro} onValueChange={handleTipoChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="mes_atual">Mês Atual</SelectItem>
          <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
          <SelectItem value="data_especifica">Mês Específico</SelectItem>
        </SelectContent>
      </Select>

      {tipoFiltro === "data_especifica" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !dataEspecifica && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataEspecifica ? format(dataEspecifica, "MMMM yyyy", { locale: ptBR }) : "Selecione o mês"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
            <Calendar
              mode="single"
              selected={dataEspecifica || undefined}
              onSelect={(date) => {
                setDataEspecifica(date || null);
              }}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}

      <span className="text-sm text-muted-foreground">
        {format(dataReferencia, "MMMM yyyy", { locale: ptBR })}
      </span>
    </div>
  );
}
