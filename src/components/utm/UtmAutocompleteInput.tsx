import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder || "Selecione ou digite..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
  );
}
