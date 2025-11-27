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

  const { data: semanas } = useQuery({
    queryKey: ["semanas-disponiveis", tipoFiltro, dataEspecifica],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .gte("data_inicio", inicioMes.toISOString())
        .lte("data_fim", fimMes.toISOString())
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Buscar a semana mais recente com métricas se nenhuma estiver selecionada
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

  // Definir semana atual automaticamente
  React.useEffect(() => {
    if (!semanaSelecionada && semanaAtual) {
      setSemanaSelecionada(semanaAtual);
    }
  }, [semanaAtual, semanaSelecionada, setSemanaSelecionada]);

  const semanaAtiva = semanaSelecionada || semanaAtual;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      
      <Select
        value={tipoFiltro}
        onValueChange={(value) => {
          setTipoFiltro(value as TipoFiltroPeriodo);
          setSemanaSelecionada(null);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mes_atual">Mês Atual</SelectItem>
          <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
          <SelectItem value="data_especifica">Data Específica</SelectItem>
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
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataEspecifica || undefined}
              onSelect={(date) => {
                setDataEspecifica(date || null);
                setSemanaSelecionada(null);
              }}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}

      <Select
        value={semanaAtiva || undefined}
        onValueChange={setSemanaSelecionada}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Selecione a semana" />
        </SelectTrigger>
        <SelectContent>
          {semanas?.map((semana) => (
            <SelectItem key={semana.id_semana} value={semana.id_semana}>
              Semana {semana.numero_semana}/{semana.ano} ({format(new Date(semana.data_inicio), "dd/MMM", { locale: ptBR })} - {format(new Date(semana.data_fim), "dd/MMM", { locale: ptBR })})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
