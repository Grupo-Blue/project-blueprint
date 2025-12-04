import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MetricaComInfoProps {
  label: string;
  info: string;
  className?: string;
}

export function MetricaComInfo({ label, info, className }: MetricaComInfoProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span>{label}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[280px] text-sm">
            <p>{info}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
