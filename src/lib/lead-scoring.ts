import { differenceInDays, parseISO } from "date-fns";
import { Flame, Zap, Activity, Snowflake } from "lucide-react";

// Tags que indicam intenção de compra/contato
const TAGS_INTENCAO = [
  "clicou-whatsapp",
  "clicou-agendar",
  "pediu-contato",
  "formulario-contato",
  "solicitou-demo",
];

export const getDiasNoStage = (lead: any): number => {
  const ultimaData = lead.data_reuniao || lead.data_levantou_mao || lead.data_mql || lead.data_criacao;
  if (!ultimaData) return 0;
  return differenceInDays(new Date(), parseISO(ultimaData));
};

export const calcularScoreTemperatura = (lead: any): number => {
  let score = 0;

  // === Engajamento Mautic (max ~90 pts) ===
  score += (lead.mautic_score || 0) * 0.4;
  score += Math.min((lead.mautic_page_hits || 0) * 5, 50);

  // Bônus de recência Mautic
  if (lead.mautic_last_active) {
    const diasInativo = differenceInDays(new Date(), parseISO(lead.mautic_last_active));
    if (diasInativo <= 3) score += 15;
    else if (diasInativo <= 7) score += 8;
    else if (diasInativo > 30) score -= 15; // Penalidade inatividade Mautic
  }

  // Bônus por tags de intenção
  if (lead.mautic_tags) {
    const tags: string[] = Array.isArray(lead.mautic_tags)
      ? lead.mautic_tags
      : typeof lead.mautic_tags === "string"
        ? lead.mautic_tags.split(",").map((t: string) => t.trim().toLowerCase())
        : [];
    const temTagIntencao = tags.some((tag) =>
      TAGS_INTENCAO.some((ti) => tag.toLowerCase().includes(ti))
    );
    if (temTagIntencao) score += 20;
  }

  // === Sinais comerciais (max ~100 pts) ===
  if (lead.levantou_mao) score += 30;
  if (lead.tem_reuniao) score += 50;
  if (lead.is_mql) score += 20;

  // === Dados Tokeniza (max ~70 pts) ===
  if (lead.tokeniza_investidor) score += 40;
  score += Math.min((lead.tokeniza_qtd_investimentos || 0) * 10, 30);
  if (lead.tokeniza_carrinho_abandonado) score += 35;

  // === Atendimento Chatblue (max ~60 pts) ===
  if (lead.chatblue_sla_violado) score += 25;
  if (lead.chatblue_prioridade === "alta" || lead.chatblue_prioridade === "urgente") score += 15;
  if (lead.chatwoot_status_atendimento === "open") score += 30;
  else if (lead.chatwoot_status_atendimento === "resolved") score += 15;
  score += Math.min((lead.chatwoot_conversas_total || 0) * 10, 50);
  if (lead.chatwoot_tempo_resposta_medio && lead.chatwoot_tempo_resposta_medio > 86400) {
    score -= 20;
  }

  // === Qualificação LinkedIn (max ~25 pts) ===
  const senioridade = (lead.linkedin_senioridade || "").toLowerCase();
  if (senioridade.includes("c-level") || senioridade.includes("diretor") || senioridade.includes("ceo") || senioridade.includes("cfo") || senioridade.includes("cto")) {
    score += 25;
  } else if (senioridade.includes("sênior") || senioridade.includes("senior") || senioridade.includes("gerente") || senioridade.includes("head")) {
    score += 15;
  } else if (senioridade.includes("pleno") || senioridade.includes("analista")) {
    score += 8;
  }

  // === Cliente existente (Notion) ===
  if (lead.id_cliente_notion) score += 25;

  // === Penalidades ===
  const dias = getDiasNoStage(lead);
  if (dias > 7 && !["Vendido", "Perdido"].includes(lead.stage_atual || "")) {
    score -= Math.min((dias - 7) * 2, 30);
  }

  return Math.max(0, Math.round(score));
};

export const getPrioridade = (lead: any) => {
  const score = calcularScoreTemperatura(lead);
  const dias = getDiasNoStage(lead);
  const isCarrinhoAbandonado = lead.tokeniza_carrinho_abandonado && !lead.tokeniza_investidor;
  const stagesNegociacao = ["Negociação", "Aguardando pagamento"];
  const isEmNegociacao = stagesNegociacao.includes(lead.stage_atual);
  const isSlaViolado = !!lead.chatblue_sla_violado;

  // URGENTE: score >= 120 OU overrides
  if (score >= 120 || isCarrinhoAbandonado || (dias > 7 && isEmNegociacao) || isSlaViolado) {
    return { nivel: 1, label: "URGENTE", icon: Flame, color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-500", score };
  }
  // QUENTE: score >= 70 OU overrides
  if (score >= 70 || lead.levantou_mao || lead.tem_reuniao) {
    return { nivel: 2, label: "QUENTE", icon: Zap, color: "text-orange-600", bgColor: "bg-orange-100", borderColor: "border-orange-500", score };
  }
  // MORNO: score >= 30 OU MQL
  if (score >= 30 || lead.is_mql) {
    return { nivel: 3, label: "MORNO", icon: Activity, color: "text-yellow-600", bgColor: "bg-yellow-100", borderColor: "border-yellow-500", score };
  }
  // FRIO
  return { nivel: 4, label: "FRIO", icon: Snowflake, color: "text-slate-400", bgColor: "bg-slate-100", borderColor: "border-slate-300", score };
};
