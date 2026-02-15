
# Enriquecer /relatorio-criativos com dados do Metricool

## Contexto Atual

A pagina `/relatorio-criativos` exibe campanhas com cards "Super Trunfo" e ranking de criativos. Atualmente:

- **Metricas de campanha** vem de `campanha_metricas_dia` (ja enriquecida pelo Metricool com alcance, CPC, frequencia, conversoes)
- **Metricas de criativos** vem de `criativo_metricas_dia` (populada apenas pelo coletor nativo Meta/Google - sem dados Metricool)
- O Metricool ja fornece dados granulares por **campanha** via `/stats/facebookads/campaigns` e `/stats/adwords/campaigns`
- O Metricool **nao possui endpoint nativo para metricas por anuncio/criativo** - trabalha no nivel campanha

## Oportunidades de Enriquecimento

### 1. Exibir metricas avancadas ja coletadas (sem backend novo)

Os dados de `campanha_metricas_dia` ja possuem campos enriquecidos pelo Metricool que NAO estao sendo exibidos nos cards:

- **Alcance** (30 registros com dados em fevereiro)
- **Frequencia** (4 registros)
- **CPC medio** (35 registros)
- **Conversoes + Valor de conversao** (28 registros)

**Acao**: Adicionar essas metricas aos cards de campanha e ao modal de detalhes.

### 2. Enriquecer criativos com metricas diarias do Metricool (via endpoint de ads)

O Metricool disponibiliza endpoints `/stats/facebookads/ads` e `/stats/adwords/ads` que retornam metricas no nivel de anuncio individual (nao apenas campanha). Isso permitiria popular `criativo_metricas_dia` com dados mais completos.

**Acao**: Criar uma nova edge function `coletar-criativos-metricool` que busca metricas por anuncio e faz matching com os criativos locais.

### 3. Adicionar video_views aos criativos de video

A tabela `criativo_metricas_dia` ja tem o campo `video_views` mas atualmente esta zerado para todos os registros. A coleta nativa nao busca essa metrica, mas o Meta Graph API tem `video_30_sec_watched_actions` e `video_p75_watched_actions` disponiveis.

**Acao**: Atualizar `coletar-criativos-meta` para buscar campos de video views.

## Plano de Implementacao

### Passo 1 - Exibir metricas avancadas nos cards (UI)

Atualizar `CampanhaSuperTrunfo.tsx` para mostrar:
- Alcance e Frequencia (no modal de detalhes)
- CPC medio (ja calculado, mas exibir via dados Metricool quando disponivel)
- ROAS real com valor de conversao do Metricool

Atualizar `CampanhaCard` interface e `RelatorioCreativos.tsx` para passar os novos campos.

### Passo 2 - Edge Function: coletar metricas por anuncio via Metricool

Criar `supabase/functions/coletar-criativos-metricool/index.ts`:
- Buscar `/stats/facebookads/ads` e `/stats/adwords/ads` (endpoints por anuncio)
- Fazer matching com criativos locais via `id_anuncio_externo` ou `id_criativo_externo`
- Salvar em `criativo_metricas_dia` com dados diarios granulares
- Incluir no pipeline do `orquestrador-coleta` como fase adicional

### Passo 3 - Atualizar coletor nativo para video_views

Atualizar `coletar-criativos-meta/index.ts` para incluir `video_30_sec_watched_actions` nos campos solicitados ao Meta Graph API, e salvar em `criativo_metricas_dia.video_views`.

### Passo 4 - Exibir video_views no card de criativo

Atualizar `CriativoRankingCard.tsx` para mostrar video_views quando o criativo e do tipo VIDEO e tem dados > 0.

### Passo 5 - Adicionar alcance e frequencia ao CriativoRankingCard

Quando disponivel (via Metricool ou Meta API), exibir alcance e frequencia por criativo no mini-funil ou como badges adicionais.

## Detalhes Tecnicos

### Novos campos na interface CriativoRankingData
```typescript
// Adicionar ao CriativoRankingData
alcance?: number;
frequencia?: number;
video_views?: number;
```

### Novos campos na interface CampanhaCard
```typescript
// Adicionar ao CampanhaCard
alcance: number;
frequencia: number;
cpc_medio: number;
conversoes: number;
valor_conversao: number;
```

### Edge Function coletar-criativos-metricool
- Endpoint Meta: `/stats/facebookads/ads?blogId=X&userId=Y&start=YYYYMMDD&end=YYYYMMDD`
- Endpoint Google: `/stats/adwords/ads?blogId=X&userId=Y&start=YYYYMMDD&end=YYYYMMDD`
- Matching: por `id_anuncio_externo` (campo `id` ou `adId` do Metricool)
- Upsert em `criativo_metricas_dia` com `onConflict: 'id_criativo,data'`

### Sequencia no orquestrador-coleta
Adicionar como fase 7 apos o calculo de metricas diarias:
```
Fase 1: Metricas Meta/Google
Fase 2: Criativos Meta em lote
Fase 3: Ativos Google
Fase 4: Previews Apify
Fase 5: Metricool Ads (campanhas)
Fase 6: Calculo metricas diarias
Fase 7: Metricool Ads (criativos) ← NOVO
```

### Riscos e Mitigacoes
- **Metricool pode nao ter endpoint /ads**: Se nao existir, fallback para distribuir metricas da campanha proporcionalmente entre criativos com base em impressoes
- **Rate limiting**: Usar batch de 5 dias por vez com delay de 2s entre chamadas
- **Timeout**: Processar apenas ultimos 7 dias por execucao (vs 30 dias das campanhas)
