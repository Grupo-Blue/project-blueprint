import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}

export function UtmAutocompleteInput({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const filtered = typed
    ? options.filter((o) => o.toLowerCase().includes(typed.toLowerCase()))
    : options;
  const showCreate = typed && !options.some((o) => o.toLowerCase() === typed.toLowerCase());

  return (
    <div className="relative flex gap-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-16"
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange("")}
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              tabIndex={-1}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="end">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar ou digitar novo..."
                value={typed}
                onValueChange={setTyped}
              />
              <CommandList>
                {filtered.length === 0 && !showCreate && <CommandEmpty>Nenhum encontrado.</CommandEmpty>}
                {filtered.length > 0 && (
                  <CommandGroup heading="Já usados nessa empresa">
                    {filtered.map((opt) => (
                      <CommandItem
                        key={opt}
                        value={opt}
                        onSelect={() => {
                          onChange(opt);
                          setTyped("");
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                        {opt}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {showCreate && (
                  <CommandGroup heading="Criar novo">
                    <CommandItem
                      value={typed}
                      onSelect={() => {
                        onChange(typed);
                        setTyped("");
                        setOpen(false);
                      }}
                    >
                      Usar "{typed}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
