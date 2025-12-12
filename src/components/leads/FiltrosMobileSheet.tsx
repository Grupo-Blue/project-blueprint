import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter, Search, X, Check } from "lucide-react";
import { useState } from "react";

interface FiltrosMobileSheetProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  origemFilter: string;
  setOrigemFilter: (value: string) => void;
  investidorFilter: string;
  setInvestidorFilter: (value: string) => void;
  stageFilter: string[];
  setStageFilter: (value: string[]) => void;
  availableStages: string[];
}

export function FiltrosMobileSheet({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  origemFilter,
  setOrigemFilter,
  investidorFilter,
  setInvestidorFilter,
  stageFilter,
  setStageFilter,
  availableStages,
}: FiltrosMobileSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count active filters
  const activeFiltersCount = [
    statusFilter !== "all",
    origemFilter !== "all",
    investidorFilter !== "all",
    stageFilter.length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setOrigemFilter("all");
    setInvestidorFilter("all");
    setStageFilter([]);
  };

  return (
    <div className="space-y-3">
      {/* Search always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Status: {statusFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
            </Badge>
          )}
          {origemFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Origem: {origemFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setOrigemFilter("all")} />
            </Badge>
          )}
          {investidorFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Investidor: {investidorFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setInvestidorFilter("all")} />
            </Badge>
          )}
          {stageFilter.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {stageFilter.length} stages
              <X className="h-3 w-3 cursor-pointer" onClick={() => setStageFilter([])} />
            </Badge>
          )}
        </div>
      )}

      {/* Filter button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle>Filtros</SheetTitle>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Limpar tudo
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="space-y-5">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="nao_vendido">Não Vendido</SelectItem>
                  <SelectItem value="mql">MQLs</SelectItem>
                  <SelectItem value="levantou">Engajados</SelectItem>
                  <SelectItem value="reuniao">Com Reunião</SelectItem>
                  <SelectItem value="venda">Vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origem Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Origem</label>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="organico">Orgânico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Investidor Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Investidor</label>
              <Select value={investidorFilter} onValueChange={setInvestidorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Investidor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="investidor">Investidores</SelectItem>
                  <SelectItem value="carrinho">Carrinho Abandonado</SelectItem>
                  <SelectItem value="nao_investidor">Não Investidor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stage Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Stage do Funil</label>
                {stageFilter.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStageFilter([])}>
                    Limpar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {availableStages.map((stage) => (
                  <div
                    key={stage}
                    className="flex items-center space-x-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setStageFilter(
                        stageFilter.includes(stage)
                          ? stageFilter.filter((s) => s !== stage)
                          : [...stageFilter, stage]
                      );
                    }}
                  >
                    <Checkbox checked={stageFilter.includes(stage)} className="pointer-events-none" />
                    <span className="text-sm flex-1 truncate">{stage}</span>
                    {stageFilter.includes(stage) && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Apply button */}
            <Button className="w-full" onClick={() => setIsOpen(false)}>
              Aplicar Filtros
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
