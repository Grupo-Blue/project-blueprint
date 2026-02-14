import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface BubbleData {
  label: string;
  count: number;
  category: "hot" | "warm" | "cold";
}

interface LeadQualityBubblesProps {
  data?: BubbleData[];
}

const defaultData: BubbleData[] = [
  { label: "Hot", count: 42, category: "hot" },
  { label: "Warm", count: 128, category: "warm" },
  { label: "Cold", count: 89, category: "cold" },
];

export const LeadQualityBubbles = ({ data = defaultData }: LeadQualityBubblesProps) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(...data.map(d => d.count));

  const categoryStyles = {
    hot: { bg: "bg-liquid-amber/20", border: "border-liquid-amber/40", text: "text-liquid-amber", shadow: "shadow-[0_0_30px_-5px] shadow-liquid-amber/30" },
    warm: { bg: "bg-liquid-cyan/20", border: "border-liquid-cyan/40", text: "text-liquid-cyan", shadow: "shadow-[0_0_30px_-5px] shadow-liquid-cyan/30" },
    cold: { bg: "bg-muted/40", border: "border-border", text: "text-muted-foreground", shadow: "" },
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">Qualidade dos Leads</h3>
      <p className="text-[11px] text-muted-foreground mb-6">Distribuição por temperatura</p>

      <div className="flex items-end justify-center gap-6 md:gap-10 py-4">
        {data.map((item) => {
          const style = categoryStyles[item.category];
          const sizePct = 60 + (item.count / maxCount) * 40; // 60-100% range
          const sizePx = Math.round((sizePct / 100) * 120);

          return (
            <div key={item.category} className="flex flex-col items-center gap-3 group">
              <div
                className={cn(
                  "rounded-full border-2 flex items-center justify-center transition-all duration-500 cursor-default",
                  style.bg, style.border, style.shadow,
                  "group-hover:scale-110"
                )}
                style={{ width: sizePx, height: sizePx }}
              >
                <div className="text-center">
                  <p className={cn("text-xl font-extrabold", style.text)}>{item.count}</p>
                </div>
              </div>
              <div className="text-center">
                <p className={cn("text-xs font-semibold", style.text)}>{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{((item.count / total) * 100).toFixed(0)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};
