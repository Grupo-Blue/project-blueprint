import { GlassCard } from "@/components/ui/GlassCard";

interface FunnelStage {
  label: string;
  value: number;
}

interface LiquidFunnelProps {
  stages?: FunnelStage[];
}

const defaultStages: FunnelStage[] = [
  { label: "Impressões", value: 125000 },
  { label: "Cliques", value: 8500 },
  { label: "Leads", value: 420 },
  { label: "Vendas", value: 38 },
];

export const LiquidFunnel = ({ stages = defaultStages }: LiquidFunnelProps) => {
  const maxValue = stages[0]?.value || 1;

  // Create SVG path for river-like funnel
  const svgWidth = 280;
  const stageHeight = 72;
  const totalHeight = stages.length * stageHeight;
  const minWidth = 50;
  const maxWidth = 220;

  const getWidth = (value: number) => {
    const ratio = value / maxValue;
    return minWidth + (maxWidth - minWidth) * Math.sqrt(ratio); // sqrt for smoother falloff
  };

  const buildPath = () => {
    const points: Array<{ x1: number; x2: number; y: number }> = stages.map((stage, i) => {
      const w = getWidth(stage.value);
      const cx = svgWidth / 2;
      return { x1: cx - w / 2, x2: cx + w / 2, y: i * stageHeight + stageHeight / 2 };
    });

    if (points.length < 2) return "";

    // Left side (top to bottom)
    let leftPath = `M ${points[0].x1} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const midY = (points[i - 1].y + points[i].y) / 2;
      leftPath += ` C ${points[i - 1].x1} ${midY}, ${points[i].x1} ${midY}, ${points[i].x1} ${points[i].y}`;
    }

    // Right side (bottom to top)
    let rightPath = `L ${points[points.length - 1].x2} ${points[points.length - 1].y}`;
    for (let i = points.length - 2; i >= 0; i--) {
      const midY = (points[i + 1].y + points[i].y) / 2;
      rightPath += ` C ${points[i + 1].x2} ${midY}, ${points[i].x2} ${midY}, ${points[i].x2} ${points[i].y}`;
    }

    return leftPath + rightPath + " Z";
  };

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">Funil de Conversão</h3>
      <p className="text-[11px] text-muted-foreground mb-4">Fluxo de tráfego até vendas</p>

      <div className="flex items-start gap-4">
        <svg viewBox={`0 0 ${svgWidth} ${totalHeight}`} className="w-full max-w-[240px] mx-auto flex-shrink-0">
          <defs>
            <linearGradient id="funnelGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(192, 91%, 52%)" stopOpacity={0.7} />
              <stop offset="50%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(28, 92%, 58%)" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <path d={buildPath()} fill="url(#funnelGradient)" stroke="none" />
          {stages.map((stage, i) => (
            <text
              key={stage.label}
              x={svgWidth / 2}
              y={i * stageHeight + stageHeight / 2 + 4}
              textAnchor="middle"
              fill="white"
              fontSize="13"
              fontWeight="700"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
            >
              {formatNumber(stage.value)}
            </text>
          ))}
        </svg>

        {/* Labels */}
        <div className="flex flex-col justify-around" style={{ height: totalHeight }}>
          {stages.map((stage, i) => {
            const rate = i > 0 ? ((stage.value / stages[i - 1].value) * 100).toFixed(1) : null;
            return (
              <div key={stage.label} className="flex flex-col" style={{ height: stageHeight, justifyContent: "center" }}>
                <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                {rate && (
                  <p className="text-[10px] text-muted-foreground">{rate}% conv.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};
