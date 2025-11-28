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

  const dataReferencia = getDataReferencia();
  const inicioMes = startOfMonth(dataReferencia);
  const fimMes = endOfMonth(dataReferencia);

  // Buscar semanas disponíveis (últimos 6 meses)
  const { data: semanas } = useQuery({
    queryKey: ["semanas-disponiveis"],
    queryFn: async () => {
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .gte("data_inicio", seisMesesAtras.toISOString())
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
    
    // Resetar valores ao mudar tipo
    if (novoTipo !== "data_especifica") {
      setDataEspecifica(null);
    }
    if (novoTipo !== "semana_especifica") {
      setSemanaSelecionada(null);
    } else if (novoTipo === "semana_especifica" && semanaAtual) {
      setSemanaSelecionada(semanaAtual);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      
      {/* Seletor de tipo de período */}
      <Select value={tipoFiltro} onValueChange={handleTipoChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="mes_atual">Mês Atual</SelectItem>
          <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
          <SelectItem value="data_especifica">Mês Específico</SelectItem>
          <SelectItem value="semana_especifica">Semana Específica</SelectItem>
        </SelectContent>
      </Select>

      {/* Calendário para data específica */}
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

      {/* Seletor de semanas */}
      {tipoFiltro === "semana_especifica" && semanas && (
        <Select
          value={semanaSelecionada || undefined}
          onValueChange={setSemanaSelecionada}
        >
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Selecione a semana" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50 max-h-[300px]">
            {semanas.map((semana) => (
              <SelectItem key={semana.id_semana} value={semana.id_semana}>
                Semana {semana.numero_semana}/{semana.ano} ({format(new Date(semana.data_inicio), "dd/MMM", { locale: ptBR })} - {format(new Date(semana.data_fim), "dd/MMM", { locale: ptBR })})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
