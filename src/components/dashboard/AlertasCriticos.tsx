import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { AlertTriangle, Clock, UserX, PhoneOff, ArrowRight } from "lucide-react";

interface Alerta {
  tipo: string;
  mensagem: string;
  detalhes: string;
  icon: any;
  cor: string;
  leadIds: string[];
}

export const AlertasCriticos = () => {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const { empresaSelecionada } = useEmpresa();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlertas();
  }, [empresaSelecionada]);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      const hoje = new Date().toISOString().split("T")[0];
      const agora = Date.now();

      // Leads sem proprietário (últimos 7 dias)
      let querySemDono = supabase
        .from("lead")
        .select("id_lead, nome_lead, url_pipedrive", { count: "exact" })
        .is("proprietario_nome", null)
        .eq("merged", false)
        .gte("data_criacao", new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        querySemDono = querySemDono.eq("id_empresa", empresaSelecionada);
      }

      const { data: semDono, count: countSemDono } = await querySemDono;

      // Leads recentes sem resposta (criados hoje, sem tempo_primeira_resposta)
      let querySemResposta = supabase
        .from("lead")
        .select("id_lead, nome_lead, data_criacao, url_pipedrive", { count: "exact" })
        .is("tempo_primeira_resposta_seg", null)
        .eq("merged", false)
        .gte("data_criacao", `${hoje}T00:00:00`)
        .limit(50);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        querySemResposta = querySemResposta.eq("id_empresa", empresaSelecionada);
      }

      const { data: semResposta, count: countSemResposta } = await querySemResposta;

      // Leads levantou mão sem reunião (últimos 7 dias)
      let queryLevantadaSemReuniao = supabase
        .from("lead")
        .select("id_lead, nome_lead, url_pipedrive", { count: "exact" })
        .eq("levantou_mao", true)
        .eq("tem_reuniao", false)
        .eq("reuniao_realizada", false)
        .eq("merged", false)
        .gte("data_criacao", new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        queryLevantadaSemReuniao = queryLevantadaSemReuniao.eq("id_empresa", empresaSelecionada);
      }

      const { data: levantadaSemReuniao, count: countLevantada } = await queryLevantadaSemReuniao;

      const novosAlertas: Alerta[] = [];

      if ((countSemResposta || 0) > 0) {
        novosAlertas.push({
          tipo: "sla",
          mensagem: `${countSemResposta} lead(s) sem primeira resposta hoje`,
          detalhes: (semResposta || []).map(l => l.nome_lead).join(", "),
          icon: Clock,
          cor: "text-red-500 bg-red-500/10 border-red-500/20",
          leadIds: (semResposta || []).map(l => l.id_lead),
        });
      }

      if ((countSemDono || 0) > 0) {
        novosAlertas.push({
          tipo: "orfao",
          mensagem: `${countSemDono} lead(s) sem proprietário (últimos 7 dias)`,
          detalhes: (semDono || []).map(l => l.nome_lead).join(", "),
          icon: UserX,
          cor: "text-orange-500 bg-orange-500/10 border-orange-500/20",
          leadIds: (semDono || []).map(l => l.id_lead),
        });
      }

      if ((countLevantada || 0) > 0) {
        novosAlertas.push({
          tipo: "levantada",
          mensagem: `${countLevantada} lead(s) levantaram a mão sem reunião agendada`,
          detalhes: (levantadaSemReuniao || []).map(l => l.nome_lead).join(", "),
          icon: PhoneOff,
          cor: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
          leadIds: (levantadaSemReuniao || []).map(l => l.id_lead),
        });
      }

      setAlertas(novosAlertas);
    } catch (err) {
      console.error("Erro alertas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertaClick = (alerta: Alerta) => {
    if (alerta.leadIds.length === 0) return;
    const params = new URLSearchParams();
    params.set("alerta", alerta.tipo);
    params.set("ids", alerta.leadIds.join(","));
    navigate(`/leads?${params.toString()}`);
  };

  if (loading || alertas.length === 0) return null;

  return (
    <div className="space-y-2">
      {alertas.map((alerta, i) => {
        const Icon = alerta.icon;
        return (
          <div
            key={i}
            onClick={() => handleAlertaClick(alerta)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${alerta.cor}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{alerta.mensagem}</p>
              {alerta.detalhes && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{alerta.detalhes}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        );
      })}
    </div>
  );
};
