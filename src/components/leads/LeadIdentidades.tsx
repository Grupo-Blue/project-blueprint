import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Fingerprint } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  email: "📧 Email",
  phone: "📱 Telefone",
  cookie_id: "🍪 Cookie",
  session_id: "🔗 Session",
  fbp: "📘 FBP",
  fbc: "📘 FBC",
  gclid: "🔍 GCLID",
  gbraid: "🔍 GBraid",
  mautic_id: "📬 Mautic",
  pipedrive_id: "💼 Pipedrive",
  tokeniza_id: "🪙 Tokeniza",
  cpf: "🆔 CPF",
  linkedin_url: "💼 LinkedIn",
  device_id: "📱 Device",
};

interface Props {
  leadId: string;
}

export function LeadIdentidades({ leadId }: Props) {
  const { data: identidades, isLoading } = useQuery({
    queryKey: ["lead-identidades", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_graph")
        .select("identifier_type, identifier_value, confidence, source, first_seen_at, last_seen_at")
        .eq("id_lead", leadId)
        .order("identifier_type");
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  return (
    <div className="space-y-2">
      <h4 className="font-semibold flex items-center gap-2 text-foreground">
        <Fingerprint className="h-4 w-4" /> Identidades
      </h4>
      {isLoading ? (
        <div className="animate-pulse space-y-1">
          {[1, 2].map(i => <div key={i} className="h-4 bg-muted rounded w-full" />)}
        </div>
      ) : identidades && identidades.length > 0 ? (
        <div className="space-y-1 text-xs">
          {identidades.slice(0, 8).map((id, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {TYPE_LABELS[id.identifier_type] || id.identifier_type}
              </span>
              <span className="truncate max-w-[110px] text-right font-mono text-[10px]">
                {id.identifier_value}
              </span>
            </div>
          ))}
          {identidades.length > 8 && (
            <p className="text-[10px] text-muted-foreground">+{identidades.length - 8} mais</p>
          )}
          <div className="pt-1 border-t border-border mt-1">
            <Badge variant="outline" className="text-[9px]">
              {identidades.length} IDs mapeados
            </Badge>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sem identidades mapeadas</p>
      )}
    </div>
  );
}
