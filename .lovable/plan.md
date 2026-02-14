

# Redesign "Liquid" do SGT -- UI Premium e Fluida

## Visao Geral

Transformar a interface do SGT de um layout tradicional com header horizontal + navegacao inline para um design moderno com estetica "liquid": glassmorphism, gradientes organicos, formas arredondadas, sombras coloridas e animacoes suaves. O layout passara a usar uma sidebar vertical minimal + Bento Grid no conteudo principal.

---

## O Que Muda (Antes vs Depois)

**Antes:** Header horizontal com navegacao inline, cards com cantos de 8px, fundo branco plano, sombras cinzas, layout em grid simples.

**Depois:** Sidebar flutuante semi-transparente a esquerda, background com gradientes mesh animados, cards glassmorphism com cantos de 20-32px, sombras coloridas difusas (glows), tipografia Inter com numeros bold, Bento Grid responsivo.

---

## 1. Design System Liquid (Fundacao)

### Paleta de Cores (CSS Variables)

Novas variaveis CSS para os acentos liquid:

- `--liquid-cyan`: Electric Blue/Cyan (traffego/dados)
- `--liquid-amber`: Sunset Orange/Gold (conversao/dinheiro)
- `--liquid-mint`: Soft Mint Green (sucesso)
- `--liquid-glass`: rgba branco com opacidade para glassmorphism
- `--liquid-glow-*`: sombras coloridas difusas

### Classes Utilitarias

Novas classes Tailwind customizadas:

- `.glass-card`: backdrop-blur + bg semi-transparente + borda sutil + border-radius 20-24px
- `.glass-card-lg`: versao com blur maior e radius 28-32px para widgets destaque
- `.glow-cyan`, `.glow-amber`, `.glow-mint`: sombras coloridas (box-shadow com cor)
- `.liquid-bg`: background mesh gradient animado com blobs
- `.bento-grid`: CSS Grid com areas nomeadas para layout masonry

### Animacoes

- `@keyframes mesh-flow`: gradiente de fundo que se move lentamente (60s cycle)
- `@keyframes blob-float`: blobs de cor que flutuam suavemente
- `@keyframes fade-up`: entrada suave dos cards (translate Y + opacity)
- `@keyframes ring-fill`: preenchimento circular para ROAS progress ring
- Transicoes suaves em hover nos cards (scale 1.02, glow aumenta)

---

## 2. Layout -- Sidebar Vertical + Bento Grid

### Sidebar (Novo Componente)

Substituir a navegacao horizontal no header por uma sidebar vertical flutuante:

- Largura: 72px colapsada (somente icones) / 240px expandida
- Fundo: glassmorphism (backdrop-blur + semi-transparente)
- Icones: arredondados, preenchidos quando ativos (filled icons)
- Agrupamento: Dashboards, Operacional, Analise, Admin
- Logo SGT no topo
- Avatar + logout no rodape
- Toggle de expand/collapse com animacao suave
- Mobile: drawer lateral (mantendo bottom nav para acesso rapido)

### Header Simplificado

O header atual sera simplificado para conter apenas:

- Saudacao: "Bem-vindo, {nome}" com data/hora
- Filtros globais (empresa + periodo) com estilo pill/rounded
- Indicador de status dos dados

### Bento Grid (Dashboard)

O conteudo principal usara um grid estilo Bento:

- Desktop: grid com 4 colunas, widgets ocupando 1x1, 2x1, 2x2 etc.
- Tablet: 2 colunas
- Mobile: 1 coluna (stack vertical)
- Gap entre cards: 16-20px
- Cards com tamanhos variados conforme importancia

---

## 3. Componentes Redesenhados

### KPI Cards (Topo do Dashboard)

Cards grandes com glassmorphism para as metricas principais:

- Investimento Total: glow amber, icone DollarSign
- CPA: glow cyan, icone Target
- ROAS: glow mint, com progress ring SVG animado (circular)
- Leads: glow cyan, icone Users

Cada card tera:
- border-radius: 24px
- Backdrop blur
- Numero grande (font-size 2.5rem, font-weight 800)
- Variacao percentual com seta animada
- Micro-sparkline no fundo (opcional)

### Grafico "Traffic Flow" (Spline Area Chart)

Widget grande (2x2 no bento grid) com:

- Recharts AreaChart com `type="natural"` para curvas suaves (ondas)
- Gradiente fill (cyan -> transparente)
- Linha suave com stroke-width 3
- Fundo glassmorphism
- Animacao de entrada: linha desenhando da esquerda para direita

### Lead Quality Heatmap

Widget com circulos/bolhas organicas:

- 3 categorias: Hot (amber), Warm (cyan), Cold (muted)
- Tamanho dos circulos proporcional ao volume
- Layout organico (nao grid rigido)
- Hover mostra detalhes com tooltip glassmorphism

### Funil de Conversao Fluido

Em vez de triangulo rigido, um "rio" vertical:

- Path SVG curvo de cima para baixo
- Impressoes -> Cliques -> Leads -> Vendas
- Largura diminui suavemente
- Gradiente do cyan (topo) ao amber (fundo/conversao)
- Numeros e taxas ao lado de cada etapa
- Animacao de "fluxo" sutil

---

## 4. Arquivos a Criar/Modificar

### Novos Arquivos

1. **`src/index.css`** -- Adicionar variaveis CSS liquid, classes utilitarias (.glass-card, .liquid-bg, .bento-grid), keyframes de animacao
2. **`src/components/layout/LiquidSidebar.tsx`** -- Nova sidebar vertical glassmorphism com icones, grupos, toggle collapse
3. **`src/components/dashboard/LiquidKPICard.tsx`** -- Card KPI redesenhado com glassmorphism, glow, progress ring
4. **`src/components/dashboard/TrafficFlowChart.tsx`** -- Spline area chart com visual de ondas
5. **`src/components/dashboard/LeadQualityBubbles.tsx`** -- Heatmap com bolhas organicas
6. **`src/components/dashboard/LiquidFunnel.tsx`** -- Funil SVG fluido estilo rio
7. **`src/components/ui/GlassCard.tsx`** -- Wrapper card glassmorphism reutilizavel

### Arquivos Modificados

1. **`src/components/AppLayout.tsx`** -- Substituir header horizontal + nav inline por LiquidSidebar + header simplificado + background liquid
2. **`src/pages/Dashboard.tsx`** -- Reorganizar widgets em Bento Grid, usar novos componentes liquid
3. **`src/pages/DashboardComercial.tsx`** -- Aplicar glassmorphism nos cards e tabs
4. **`src/components/dashboard/CockpitKPIs.tsx`** -- Usar LiquidKPICard com glows e progress rings
5. **`tailwind.config.ts`** -- Adicionar cores liquid, border-radius maiores, keyframes de animacao
6. **`src/components/ui/card.tsx`** -- Atualizar border-radius padrao para 20px

---

## 5. Detalhes Tecnicos

### Glassmorphism (CSS)

```text
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 24px;
}

.dark .glass-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### Mesh Gradient Background

Fundo animado com pseudo-elementos posicionados como blobs:

```text
.liquid-bg {
  position: relative;
  background: linear-gradient(135deg, #f0f4ff 0%, #f8f9fe 50%, #fef9f0 100%);
}

.liquid-bg::before,
.liquid-bg::after {
  content: '';
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: blob-float 20s infinite alternate;
}
```

### Progress Ring SVG (ROAS)

Circulo SVG com stroke-dasharray animado para mostrar percentual de ROAS vs meta:

```text
<svg viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="8"/>
  <circle cx="60" cy="60" r="54" fill="none" stroke="url(#gradient)" 
    stroke-width="8" stroke-linecap="round"
    stroke-dasharray="339.29" stroke-dashoffset={offset}
    style="transition: stroke-dashoffset 1.5s ease-out"/>
</svg>
```

### Bento Grid Layout

```text
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

/* Widgets com spans diferentes */
.bento-2x1 { grid-column: span 2; }
.bento-2x2 { grid-column: span 2; grid-row: span 2; }
.bento-4x1 { grid-column: span 4; }
```

---

## 6. Sequencia de Implementacao

1. **Fundacao**: Atualizar `index.css` e `tailwind.config.ts` com variaveis liquid, classes utilitarias, keyframes
2. **GlassCard**: Criar componente base reutilizavel
3. **LiquidSidebar**: Criar sidebar e integrar no AppLayout (substituindo nav horizontal)
4. **LiquidKPICards**: Criar cards com glassmorphism e progress ring
5. **TrafficFlowChart**: Criar area chart com visual de ondas
6. **LeadQualityBubbles + LiquidFunnel**: Criar visualizacoes organicas
7. **Dashboard**: Reorganizar pagina principal com Bento Grid e novos componentes
8. **DashboardComercial**: Aplicar estetica liquid nos tabs e cockpit
9. **Polimento**: Animacoes de entrada, hover effects, responsividade mobile

---

## 7. Compatibilidade

- Todas as paginas existentes continuam funcionando -- apenas o visual muda
- Os dados e queries permanecem identicos
- O ChatIAFlutuante mantem sua posicao (canto inferior direito)
- Mobile: sidebar vira drawer, bottom nav permanece, cards empilham verticalmente
- Dark mode: glassmorphism adaptado com backgrounds escuros semi-transparentes

