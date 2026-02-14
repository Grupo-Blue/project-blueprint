import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface LiquidKPICardProps {
  label: string;
  value: string;
  variacao?: number;
  icon: React.ElementType;
  glow?: "cyan" | "amber" | "mint";
  invertido?: boolean;
  progressRing?: { value: number; max: number };
  delay?: number;
}

export const LiquidKPICard = ({
  label, value, variacao = 0, icon: Icon, glow = "cyan",
  invertido = false, progressRing, delay = 0
}: LiquidKPICardProps) => {
  const isPositive = invertido ? variacao <= 0 : variacao >= 0;
  const circumference = 2 * Math.PI * 42;
  const progress = progressRing ? Math.min((progressRing.value / progressRing.max) * 100, 100) : 0;
  const offset = circumference - (progress / 100) * circumference;

  const glowColors = {
    cyan: "from-liquid-cyan/10 to-transparent",
    amber: "from-liquid-amber/10 to-transparent",
    mint: "from-liquid-mint/10 to-transparent",
  };

  const iconColors = {
    cyan: "text-liquid-cyan",
    amber: "text-liquid-amber",
    mint: "text-liquid-mint",
  };

  return (
    <div
      className={cn(
        "glass-card p-5 relative overflow-hidden animate-fade-up",
        glow === "cyan" && "glow-cyan",
        glow === "amber" && "glow-amber",
        glow === "mint" && "glow-mint",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient overlay */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none rounded-[20px]", glowColors[glow])} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center bg-background/50", iconColors[glow])}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
          </div>

          <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-1">{value}</p>

          {variacao !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-liquid-mint" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={cn("text-xs font-semibold", isPositive ? "text-liquid-mint" : "text-destructive")}>
                {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
              </span>
              <span className="text-[10px] text-muted-foreground">vs anterior</span>
            </div>
          )}
        </div>

        {/* Progress Ring */}
        {progressRing && (
          <div className="relative h-16 w-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity="0.3" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={glow === "mint" ? "hsl(var(--liquid-mint))" : glow === "amber" ? "hsl(var(--liquid-amber))" : "hsl(var(--liquid-cyan))"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="animate-ring-fill"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
