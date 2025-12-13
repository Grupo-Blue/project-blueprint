import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";

interface Props {
  exercicioFilter: string;
  setExercicioFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  exercicios: number[];
}

export function IRPFFilters({
  exercicioFilter,
  setExercicioFilter,
  statusFilter,
  setStatusFilter,
  searchTerm,
  setSearchTerm,
  exercicios,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={exercicioFilter} onValueChange={setExercicioFilter}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Exercício" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os anos</SelectItem>
          {exercicios.map((ano) => (
            <SelectItem key={ano} value={ano.toString()}>
              {ano}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="concluido">Concluído</SelectItem>
          <SelectItem value="processando">Processando</SelectItem>
          <SelectItem value="erro">Com erro</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
