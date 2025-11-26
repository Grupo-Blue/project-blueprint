import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FiltroPeriodo() {
  const { semanaSelecionada, setSemanaSelecionada } = usePeriodo();

  const { data: semanas } = useQuery({
    queryKey: ["semanas-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(12);
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
    <div className="flex items-center gap-3">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select
        value={semanaAtiva || undefined}
        onValueChange={setSemanaSelecionada}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Selecione o período" />
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
