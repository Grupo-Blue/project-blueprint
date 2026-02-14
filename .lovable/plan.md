

# Análise Profunda de Campanhas -- "Super Trunfo"

## Visao Geral

Substituir a pagina `/relatorio-criativos` por uma interface de analise de campanhas ativas no estilo "carta de Super Trunfo". Cada campanha sera um card rico e visual com uma nota de saude, logo da plataforma (Meta/Google) e metricas-chave que mudam conforme o tipo de campanha (topo ou fundo de funil). Ao clicar, expande para mostrar os criativos em ranking com thumbnails, alertas e mini funil.

---

## Estrutura da Pagina

### 1. Cabecalho e Filtros
- Titulo: "Analise de Campanhas"
- Filtros: Periodo (7d, 30d, mes atual, mes anterior), Plataforma (Todas, Meta, Google), Ordenacao (Nota, CPL, ROAS, Leads, Verba)
- Botao de comparacao lado a lado (selecionar 2-3 campanhas)

### 2. Card "Super Trunfo" de Campanha

Cada campanha ativa aparece como um card com visual distinto:

**Topo do Card:**
- Logo da plataforma (icone Meta azul ou Google colorido) no canto esquerdo
- Nome da campanha
- Badge de tipo: "Topo de Funil" ou "Fundo de Funil" (configuravel por campanha via um toggle/select dentro do card)
- Nota de saude no canto direito (A/B/C/D/F com cor) -- calculada automaticamente

**Corpo do Card (muda conforme o tipo):**

Topo de Funil:
- Impressoes | CTR | Cliques
- Verba investida
- Nota

Fundo de Funil:
- Leads | MQLs | Vendas
- Verba investida
- Nota

**Calculo da Nota:**
- Fundo: Baseada em CPL (vs media), taxa de conversao Lead-to-Sale, ROAS
- Topo: Baseada em CTR (vs benchmark), CPC efetivo, custo por 1000 impressoes
- Escala: A (top 20%), B (acima da media), C (na media), D (abaixo), F (critico)

**Rodape do Card:**
- Quantidade de criativos ativos / total
- Icone de alerta se houver criativos com problema (fadiga, sem leads, etc.)

### 3. Detalhe Expandido (ao clicar no card)

Abre um painel/dialog com:

**Ranking de Criativos** (ordenados pelo melhor ao pior por CPL ou ROAS):
- Card visual de cada criativo com:
  - Thumbnail (imagem/video) a esquerda
  - Metricas ao lado (leads, CPL, CTR, vendas)
  - Mini funil visual: Impressoes -> Cliques -> Leads -> Vendas (barras proporcionais)
  - Badge de posicao no ranking (#1, #2, #3...)
  - Alertas visuais:
    - "Fadiga" (queda de CTR > 30% vs semana anterior)
    - "Sem conversao" (verba > 0, leads = 0)
    - "Estrela" (melhor ROAS/CPL da campanha)

### 4. Comparacao Lado a Lado

- Botao "Comparar" permite selecionar 2-3 campanhas
- Modal/painel com cards lado a lado mostrando as mesmas metricas para comparacao direta
- Destaque visual em verde/vermelho para a metrica vencedora de cada linha

---

## Detalhes Tecnicos

### Arquivos a criar/modificar:

1. **`src/pages/RelatorioCreativos.tsx`** -- Reescrever completamente como a nova pagina "Analise de Campanhas"

2. **`src/components/campanhas/CampanhaSuperTrunfo.tsx`** (novo) -- Componente do card Super Trunfo individual

3. **`src/components/campanhas/CriativoRankingCard.tsx`** (novo) -- Card de criativo com thumbnail, metricas e mini funil

4. **`src/components/campanhas/ComparativoCampanhas.tsx`** (novo) -- Modal de comparacao lado a lado

5. **`src/components/campanhas/NotaSaudeCampanha.tsx`** (novo) -- Componente visual da nota A-F com calculo

6. **`src/lib/campanha-scoring.ts`** (novo) -- Logica de calculo da nota de saude, separada por tipo (topo/fundo)

### Fonte de dados:
- Reutilizar a query existente que busca `criativo` + `criativo_metricas_dia` + `lead` (mesma logica da pagina atual)
- Agrupar resultados por `campanha` ao inves de listar criativos individuais
- O tipo de campanha (topo/fundo) sera armazenado via campo `tipo_funil` na tabela `campanha` (nova coluna)

### Migracao de banco:
- Adicionar coluna `tipo_funil` (TEXT, default 'fundo') na tabela `campanha` com valores: 'topo', 'fundo'
- Isso permite persistir a configuracao por campanha

### Responsividade:
- Desktop: Grid de 2-3 cards por linha
- Mobile: Cards em coluna unica, detalhe expandido inline (collapsible ao inves de dialog)

### Navegacao:
- Manter a rota `/relatorio-criativos` (apenas renomear o titulo no menu lateral para "Analise Campanhas")

---

## Sequencia de Implementacao

1. Criar migracao (campo `tipo_funil` na tabela `campanha`)
2. Criar `campanha-scoring.ts` com logica de calculo de nota
3. Criar componente `NotaSaudeCampanha`
4. Criar componente `CriativoRankingCard` com thumbnail + mini funil + alertas
5. Criar componente `CampanhaSuperTrunfo`
6. Criar componente `ComparativoCampanhas`
7. Reescrever `RelatorioCreativos.tsx` integrando tudo
8. Atualizar nome no menu lateral

