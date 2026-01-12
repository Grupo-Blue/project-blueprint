import { useDataStatus } from '@/hooks/useDataStatus';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function DataStatusIndicator({ className, showLabel = true }: DataStatusIndicatorProps) {
  const { tempoRelativo, status, isLoading } = useDataStatus();

  const statusConfig = {
    fresh: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      label: 'Atualizado',
    },
    stale: {
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      label: 'Desatualizado',
    },
    old: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      label: 'Antigo',
    },
  };

  const config = statusConfig[status];
  const Icon = isLoading ? RefreshCw : config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'gap-1.5 font-normal cursor-default transition-colors',
              config.bgColor,
              config.borderColor,
              className
            )}
          >
            <Icon 
              className={cn(
                'h-3 w-3',
                config.color,
                isLoading && 'animate-spin'
              )} 
            />
            {showLabel && (
              <span className={cn('text-xs', config.color)}>
                {tempoRelativo}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            Última sincronização: {tempoRelativo}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Os dados são atualizados automaticamente
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
