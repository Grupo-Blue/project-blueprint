import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePeriodo, TipoFiltroPeriodo } from "@/contexts/PeriodoContext";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function FiltroPeriodo() {
  const { tipoFiltro, dataEspecifica, semanaSelecionada, setTipoFiltro, setDataEspecifica, setSemanaSelecionada, getDataReferencia } = usePeriodo();
  const [mostrarCalendario, setMostrarCalendario] = React.useState(false);
  const [mostrarSemanas, setMostrarSemanas] = React.useState(false);

  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  // Buscar semanas disponíveis (últimos 3 meses)
  const { data: semanas } = useQuery({
    queryKey: ["semanas-disponiveis"],
    queryFn: async () => {
      const treseMesesAtras = new Date();
      treseMesesAtras.setMonth(treseMesesAtras.getMonth() - 3);
      
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .gte("data_inicio", treseMesesAtras.toISOString())
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Buscar a semana mais recente com métricas
  const { data: semanaAtual } = useQuery({
    queryKey: ["semana-atual-filtro"],
    queryFn: async () => {
      const { data: metricasComSemana, error } = await supabase
        .from("empresa_semana_metricas")
        .select("id_semana")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return metricasComSemana?.id_semana;
    },
  });

  // Definir semana atual automaticamente apenas se tipo for semana_especifica
  React.useEffect(() => {
    if (tipoFiltro === "semana_especifica" && !semanaSelecionada && semanaAtual) {
      setSemanaSelecionada(semanaAtual);
    }
  }, [semanaAtual, semanaSelecionada, setSemanaSelecionada, tipoFiltro]);

  const handleTipoChange = (value: string) => {
    const novoTipo = value as TipoFiltroPeriodo;
    setTipoFiltro(novoTipo);
    
    if (novoTipo === "data_especifica") {
      setMostrarCalendario(true);
      setMostrarSemanas(false);
      setSemanaSelecionada(null);
    } else if (novoTipo === "semana_especifica") {
      setMostrarSemanas(true);
      setMostrarCalendario(false);
      setDataEspecifica(null);
      if (semanaAtual) {
        setSemanaSelecionada(semanaAtual);
      }
    } else {
      setMostrarCalendario(false);
      setMostrarSemanas(false);
      setDataEspecifica(null);
      setSemanaSelecionada(null);
    }
  };

  const getValorAtual = () => {
    if (tipoFiltro === "semana_especifica" && semanaSelecionada && semanas) {
      const semana = semanas.find(s => s.id_semana === semanaSelecionada);
      if (semana) {
        return `Semana ${semana.numero_semana}/${semana.ano} (${format(new Date(semana.data_inicio), "dd/MMM", { locale: ptBR })} - ${format(new Date(semana.data_fim), "dd/MMM", { locale: ptBR })})`;
      }
    }
    
    if (tipoFiltro === "data_especifica" && dataEspecifica) {
      return format(dataEspecifica, "MMMM yyyy", { locale: ptBR });
    }
    
    switch (tipoFiltro) {
      case "mes_atual":
        return "Mês Atual";
      case "mes_anterior":
        return "Mês Anterior";
      case "data_especifica":
        return "Data Específica";
      case "semana_especifica":
        return "Semana Específica";
      default:
        return "Selecione o período";
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      
      <Popover open={mostrarCalendario || mostrarSemanas} onOpenChange={(open) => {
        if (!open) {
          setMostrarCalendario(false);
          setMostrarSemanas(false);
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-[280px] justify-start text-left font-normal",
              !tipoFiltro && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getValorAtual()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-2">
            <Select value={tipoFiltro} onValueChange={handleTipoChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o tipo de período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="data_especifica">Data Específica</SelectItem>
                <SelectItem value="semana_especifica">Semana Específica</SelectItem>
              </SelectContent>
            </Select>

            {tipoFiltro === "data_especifica" && (
              <Calendar
                mode="single"
                selected={dataEspecifica || undefined}
                onSelect={(date) => {
                  setDataEspecifica(date || null);
                  setMostrarCalendario(false);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            )}

            {tipoFiltro === "semana_especifica" && semanas && (
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {semanas.map((semana) => (
                  <Button
                    key={semana.id_semana}
                    variant={semanaSelecionada === semana.id_semana ? "default" : "ghost"}
                    className="w-full justify-start text-left font-normal"
                    onClick={() => {
                      setSemanaSelecionada(semana.id_semana);
                      setMostrarSemanas(false);
                    }}
                  >
                    Semana {semana.numero_semana}/{semana.ano} ({format(new Date(semana.data_inicio), "dd/MMM", { locale: ptBR })} - {format(new Date(semana.data_fim), "dd/MMM", { locale: ptBR })})
                  </Button>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
