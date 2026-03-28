import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint, Users, Layers, Link2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface Props {
  empresaId: string;
}

export function IdentityGraphWidget({ empresaId }: Props) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["identity-graph-stats", empresaId],
    queryFn: async () => {
      // Total identities mapped
      const { count: totalIdentidades } = await supabase
        .from("identity_graph")
        .select("*", { count: "exact", head: true })
        .eq("id_empresa", empresaId);

      // Identities with resolved lead
      const { count: resolvidas } = await supabase
        .from("identity_graph")
        .select("*", { count: "exact", head: true })
        .eq("id_empresa", empresaId)
        .not("id_lead", "is", null);

      // Anonymous (no lead)
      const { count: anonimas } = await supabase
        .from("identity_graph")
        .select("*", { count: "exact", head: true })
        .eq("id_empresa", empresaId)
        .is("id_lead", null);

      // Segment counts
      const { data: segmentos } = await supabase
        .from("lead_segmento")
        .select(`
          id, nome,
          lead_segmento_membro!inner(id)
        `)
        .eq("id_empresa", empresaId)
        .eq("ativo", true);

      const segmentosComContagem = (segmentos || []).map((s: any) => ({
        nome: s.nome,
        count: Array.isArray(s.lead_segmento_membro) ? s.lead_segmento_membro.length : 0,
      })).sort((a: any, b: any) => b.count - a.count);

      return {
        totalIdentidades: totalIdentidades || 0,
        resolvidas: resolvidas || 0,
        anonimas: anonimas || 0,
        taxaResolucao: totalIdentidades ? Math.round(((resolvidas || 0) / totalIdentidades) * 100) : 0,
        segmentos: segmentosComContagem,
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-40" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </GlassCard>
    );
  }

  if (!stats) return null;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">Identity Graph</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<Link2 className="h-4 w-4 text-cyan-400" />}
          label="Identidades"
          value={stats.totalIdentidades}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-emerald-400" />}
          label="Resolvidas"
          value={stats.resolvidas}
        />
        <StatCard
          icon={<Layers className="h-4 w-4 text-amber-400" />}
          label="Anônimas"
          value={stats.anonimas}
        />
        <StatCard
          icon={<Fingerprint className="h-4 w-4 text-primary" />}
          label="Taxa Resolução"
          value={`${stats.taxaResolucao}%`}
        />
      </div>

      {stats.segmentos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Segmentos Dinâmicos
          </p>
          <div className="space-y-1.5">
            {stats.segmentos.slice(0, 5).map((seg: any) => (
              <div key={seg.nome} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{seg.nome}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {seg.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
