export type NotaSaude = 'A' | 'B' | 'C' | 'D' | 'F';
export type TipoFunil = 'topo' | 'fundo';

export interface CampanhaMetricas {
  impressoes: number;
  cliques: number;
  verba_investida: number;
  leads: number;
  mqls: number;
  vendas: number;
  valor_vendas: number;
}

export interface ScoreResult {
  nota: NotaSaude;
  pontuacao: number; // 0-100
  detalhes: { metrica: string; valor: number; benchmark: number; status: 'bom' | 'medio' | 'ruim' }[];
}

// Benchmarks padrão
const BENCHMARKS = {
  topo: {
    ctr: 1.5,       // % CTR bom
    cpc: 3.0,       // R$ CPC aceitável
    cpm: 30.0,      // R$ CPM aceitável
  },
  fundo: {
    cpl: 50.0,      // R$ CPL aceitável (será ajustado pela média)
    taxaConversao: 5, // % Lead→Venda
    roas: 3.0,      // ROAS bom
  },
};

function getStatus(valor: number, benchmark: number, menorMelhor: boolean): 'bom' | 'medio' | 'ruim' {
  if (menorMelhor) {
    if (valor <= benchmark * 0.7) return 'bom';
    if (valor <= benchmark * 1.3) return 'medio';
    return 'ruim';
  }
  if (valor >= benchmark * 1.3) return 'bom';
  if (valor >= benchmark * 0.7) return 'medio';
  return 'ruim';
}

function statusToPontos(s: 'bom' | 'medio' | 'ruim'): number {
  return s === 'bom' ? 100 : s === 'medio' ? 60 : 20;
}

export function calcularNotaTopo(m: CampanhaMetricas): ScoreResult {
  const ctr = m.impressoes > 0 ? (m.cliques / m.impressoes) * 100 : 0;
  const cpc = m.cliques > 0 ? m.verba_investida / m.cliques : 0;
  const cpm = m.impressoes > 0 ? (m.verba_investida / m.impressoes) * 1000 : 0;

  const detalhes = [
    { metrica: 'CTR', valor: ctr, benchmark: BENCHMARKS.topo.ctr, status: getStatus(ctr, BENCHMARKS.topo.ctr, false) as 'bom' | 'medio' | 'ruim' },
    { metrica: 'CPC', valor: cpc, benchmark: BENCHMARKS.topo.cpc, status: getStatus(cpc, BENCHMARKS.topo.cpc, true) as 'bom' | 'medio' | 'ruim' },
    { metrica: 'CPM', valor: cpm, benchmark: BENCHMARKS.topo.cpm, status: getStatus(cpm, BENCHMARKS.topo.cpm, true) as 'bom' | 'medio' | 'ruim' },
  ];

  const pontuacao = Math.round(detalhes.reduce((s, d) => s + statusToPontos(d.status), 0) / detalhes.length);
  return { nota: pontuacaoParaNota(pontuacao), pontuacao, detalhes };
}

export function calcularNotaFundo(m: CampanhaMetricas, cplMedio?: number): ScoreResult {
  const cpl = m.leads > 0 ? m.verba_investida / m.leads : 0;
  const taxaConversao = m.leads > 0 ? (m.vendas / m.leads) * 100 : 0;
  const roas = m.verba_investida > 0 ? m.valor_vendas / m.verba_investida : 0;
  const benchCpl = cplMedio || BENCHMARKS.fundo.cpl;

  const detalhes = [
    { metrica: 'CPL', valor: cpl, benchmark: benchCpl, status: getStatus(cpl, benchCpl, true) as 'bom' | 'medio' | 'ruim' },
    { metrica: 'Taxa Conv.', valor: taxaConversao, benchmark: BENCHMARKS.fundo.taxaConversao, status: getStatus(taxaConversao, BENCHMARKS.fundo.taxaConversao, false) as 'bom' | 'medio' | 'ruim' },
    { metrica: 'ROAS', valor: roas, benchmark: BENCHMARKS.fundo.roas, status: getStatus(roas, BENCHMARKS.fundo.roas, false) as 'bom' | 'medio' | 'ruim' },
  ];

  const pontuacao = Math.round(detalhes.reduce((s, d) => s + statusToPontos(d.status), 0) / detalhes.length);
  return { nota: pontuacaoParaNota(pontuacao), pontuacao, detalhes };
}

function pontuacaoParaNota(p: number): NotaSaude {
  if (p >= 85) return 'A';
  if (p >= 70) return 'B';
  if (p >= 50) return 'C';
  if (p >= 30) return 'D';
  return 'F';
}

export function getCorNota(nota: NotaSaude): string {
  switch (nota) {
    case 'A': return 'hsl(142, 76%, 36%)';
    case 'B': return 'hsl(142, 50%, 50%)';
    case 'C': return 'hsl(48, 96%, 53%)';
    case 'D': return 'hsl(25, 95%, 53%)';
    case 'F': return 'hsl(0, 84%, 60%)';
  }
}

export function getCorNotaClasse(nota: NotaSaude): string {
  switch (nota) {
    case 'A': return 'bg-green-600 text-white';
    case 'B': return 'bg-green-400 text-white';
    case 'C': return 'bg-yellow-400 text-black';
    case 'D': return 'bg-orange-500 text-white';
    case 'F': return 'bg-red-500 text-white';
  }
}
