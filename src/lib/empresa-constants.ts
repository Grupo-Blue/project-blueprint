// IDs das empresas do ecossistema
export const EMPRESA_IDS = {
  BLUE_CONSULT: "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db",
  TOKENIZA: "61b5ffeb-fbbc-47c1-8ced-152bb647ed20",
  AXIA: "6edd20a7-47ee-4c48-9719-c537a9869c66",
  MPUPPE: "b1ffd679-0dce-4223-b516-dba7cd283bda",
} as const;

// Slugs para WhatsApp/Chatblue
export const EMPRESA_SLUG_MAP: Record<string, string> = {
  [EMPRESA_IDS.BLUE_CONSULT]: "blue-consult",
  [EMPRESA_IDS.TOKENIZA]: "tokeniza",
  [EMPRESA_IDS.AXIA]: "axia",
  [EMPRESA_IDS.MPUPPE]: "mpuppe",
};

// Empresas que NÃO participam do Dashboard Comercial (vendas/metas)
// Tokeniza é crowdfunding/investimento, não venda comercial tradicional
export const EMPRESAS_EXCLUIDAS_COMERCIAL = [EMPRESA_IDS.TOKENIZA];

// IDs das empresas comerciais (para filtro positivo)
export const EMPRESAS_COMERCIAIS = [
  EMPRESA_IDS.BLUE_CONSULT,
  EMPRESA_IDS.AXIA,
  EMPRESA_IDS.MPUPPE,
];

/**
 * Aplica filtro de exclusão da Tokeniza em queries do dashboard comercial.
 * Usar quando empresaSelecionada === "todas".
 */
export function aplicarFiltroComercial(query: any, empresaSelecionada: string | null) {
  if (empresaSelecionada && empresaSelecionada !== "todas") {
    return query.eq("id_empresa", empresaSelecionada);
  }
  // Quando "todas", excluir Tokeniza
  return query.in("id_empresa", EMPRESAS_COMERCIAIS);
}
