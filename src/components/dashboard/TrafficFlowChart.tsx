import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";

interface TrafficFlowChartProps {
  data: Array<{ label: string; impressoes: number; cliques: number; leads: number }>;
  title?: string;
}

export const TrafficFlowChart = ({ data, title = "Traffic Flow" }: TrafficFlowChartProps) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Mock data for empty state
      return Array.from({ length: 14 }, (_, i) => ({
        label: `Dia ${i + 1}`,
        impressoes: Math.floor(Math.random() * 5000 + 2000),
        cliques: Math.floor(Math.random() * 800 + 200),
        leads: Math.floor(Math.random() * 50 + 10),
      }));
    }
    return data;
  }, [data]);

  return (
    <GlassCard variant="lg" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">Volume de tráfego no período</p>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(192, 91%, 52%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(192, 91%, 52%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(28, 92%, 58%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(28, 92%, 58%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientMint" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(160, 60%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(160, 60%, 50%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "16px",
                fontSize: "12px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              }}
            />
            <Area type="natural" dataKey="impressoes" stroke="hsl(192, 91%, 52%)" strokeWidth={2.5} fill="url(#gradientCyan)" name="Impressões" />
            <Area type="natural" dataKey="cliques" stroke="hsl(28, 92%, 58%)" strokeWidth={2.5} fill="url(#gradientAmber)" name="Cliques" />
            <Area type="natural" dataKey="leads" stroke="hsl(160, 60%, 50%)" strokeWidth={2.5} fill="url(#gradientMint)" name="Leads" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};
