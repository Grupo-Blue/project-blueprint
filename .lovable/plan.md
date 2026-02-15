
# Exibir Keywords no Modal de Campanhas Google Search

## Problema

Ao clicar numa campanha Google Search em `/relatorio-criativos`, o modal mostra "Ranking de Criativos" -- mas campanhas de Search nao tem criativos visuais. A informacao relevante sao as **palavras-chave** e sua performance.

## Solucao

Detectar quando a campanha e Google Search e substituir o bloco de criativos por um **painel de keywords** rico e acionavel.

## O que sera exibido no modal de Keywords

### Resumo no topo
- Total de keywords ativas
- CPC medio ponderado
- CTR medio ponderado
- Total de conversoes

### Tabela de Keywords ordenada por gasto (maior investimento primeiro)
Cada linha mostra:
- **Keyword** (texto) + badge do match type (Broad/Phrase/Exact)
- **Impressoes** | **Cliques** | **CTR%**
- **Gasto** | **CPC**
- **Conversoes** | **Custo por Conversao**
- **Quality Score** (quando disponivel): indicador visual com cor (verde 7-10, amarelo 4-6, vermelho 1-3)

### Indicadores visuais de decisao
- Barra de proporcao de gasto (quanto % do budget total essa keyword consome)
- Badge "Estrela" para keywords com CTR > media E CPC < media
- Badge "Drenar" para keywords com gasto alto e zero conversoes
- Badge "Oportunidade" para keywords com conversoes mas quality score baixo (pode melhorar)

## Implementacao Tecnica

### 1. Novo componente: `KeywordRankingTable.tsx`

Localizado em `src/components/campanhas/KeywordRankingTable.tsx`:
- Recebe `id_campanha` e `id_empresa` como props
- Busca dados de `google_ads_keyword` filtrado pelo periodo selecionado
- Renderiza tabela responsiva com as metricas e badges
- Calcula medias e totais internamente

### 2. Atualizar `CampanhaSuperTrunfo.tsx`

- Receber nova prop `isGoogleSearch: boolean` (ou detectar pela plataforma + nome contendo "SEARCH")
- No dialog/collapsible, renderizar `<KeywordRankingTable>` em vez de `<CriativosDetalhe>` quando for Search
- Manter o card externo identico (mesmas metricas de campanha)

### 3. Atualizar `RelatorioCreativos.tsx`

- Passar a plataforma e o nome da campanha para o `CampanhaSuperTrunfo` (ja passa)
- Detectar campanhas Google Search (plataforma GOOGLE + nome contendo "SEARCH" ou objetivo "SEARCH")
- Passar flag `isGoogleSearch` para o componente

### 4. Interface KeywordData

```text
interface KeywordData {
  id: string
  keyword: string
  match_type: string
  impressions: number
  clicks: number
  spent: number
  conversions: number
  cpc: number
  ctr: number
  quality_score: number | null
}
```

### Dados disponiveis

A tabela `google_ads_keyword` ja tem todos os campos necessarios com dados reais:
- 6 registros vinculados a campanhas
- Campos: keyword, impressions, clicks, spent, conversions, cpc, ctr, quality_score, match_type
- Vinculados por `id_campanha` e `id_empresa`

### Deteccao de campanha Search

Criterios (qualquer um):
1. Nome da campanha contem "SEARCH" (padrao atual de nomenclatura)
2. Campo `objetivo` da campanha = "SEARCH" (quando preenchido pelo coletor Google)
3. Existem keywords vinculadas ao `id_campanha` na tabela `google_ads_keyword`

### Arquivos modificados
- **Novo**: `src/components/campanhas/KeywordRankingTable.tsx`
- **Editar**: `src/components/campanhas/CampanhaSuperTrunfo.tsx` (condicional criativos vs keywords)
- **Editar**: `src/pages/RelatorioCreativos.tsx` (passar flag isGoogleSearch)
