import { NotaSaude, getCorNotaClasse } from "@/lib/campanha-scoring";
import { cn } from "@/lib/utils";

interface NotaSaudeCampanhaProps {
  nota: NotaSaude;
  pontuacao: number;
  tamanho?: 'sm' | 'md' | 'lg';
}

export function NotaSaudeCampanha({ nota, pontuacao, tamanho = 'md' }: NotaSaudeCampanhaProps) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-3xl',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "rounded-lg font-black flex items-center justify-center shadow-md",
        getCorNotaClasse(nota),
        sizes[tamanho]
      )}>
        {nota}
      </div>
      {tamanho !== 'sm' && (
        <span className="text-[10px] text-muted-foreground font-medium">{pontuacao}pts</span>
      )}
    </div>
  );
}
