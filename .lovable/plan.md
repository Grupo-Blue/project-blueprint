

# Enriquecimento Completo de Dados de Anuncios

## Diagnostico Atual

### Cobertura de Previews (271 criativos ativos)
| Tipo | Total | Com Midia | Com Preview | Lacuna |
|---|---|---|---|---|
| VIDEO | 142 | 100 (70%) | 80 (56%) | 42 sem midia |
| IMAGEM | 92 | 68 (74%) | 62 (67%) | 24 sem midia |
| CARROSSEL | 15 | 10 (67%) | 15 (100%) | 5 sem midia |
| OUTRO | 22 | 0 (0%) | 0 (0%) | 22 sem nada |

### Metricas Descartadas
As edge functions ja buscam da API dados avancados, mas nao salvam no banco:
- **Meta Ads** (`coletar-metricas-meta`): busca `reach`, `frequency`, `video_play_actions`, `video_avg_time_watched_actions`, `website_ctr`, `inline_link_clicks` -- mas salva apenas impressoes/cliques/verba/leads
- **Google Ads** (`coletar-metricas-google`): busca `average_cpc`, `search_impression_share`, `segments.device`, `segments.ad_network_type` -- mas salva apenas impressoes/cliques/verba/leads

### Schema Limitado
- `campanha_metricas_dia`: apenas `impressoes`, `cliques`, `verba_investida`, `leads`, `conversoes`, `valor_conversao`
- `criativo_metricas_dia`: apenas `impressoes`, `cliques`, `verba_investida`, `leads`
- Faltam: alcance, frequencia, CPC medio, ROAS, tempo de video, parcela de impressao

---

## Plano de Implementacao

### Fase 1: Expandir Schema do Banco

**Tabela `campanha_metricas_dia`** -- adicionar colunas:
- `alcance` (integer) -- reach do Meta
- `frequencia` (numeric) -- frequency do Meta
- `cpc_medio` (numeric) -- average CPC de ambas plataformas
- `parcela_impressao` (numeric) -- search_impression_share do Google
- `video_views` (integer) -- video plays do Meta
- `video_avg_watch_time` (numeric) -- tempo medio de visualizacao
- `inline_link_clicks` (integer) -- cliques no link (diferente de cliques gerais)

**Tabela `criativo_metricas_dia`** -- adicionar colunas:
- `alcance` (integer)
- `frequencia` (numeric)
- `cpc_medio` (numeric)
- `video_views` (integer)
- `conversoes` (integer)
- `valor_conversao` (numeric)

### Fase 2: Atualizar Edge Functions de Coleta

**`coletar-metricas-meta`**: Salvar os campos extras que ja vem da API (reach, frequency, video_play_actions, etc.) nas novas colunas.

**`coletar-metricas-google`**: Salvar average_cpc e search_impression_share. Agregar metricas por device/network ao inves de descartar.

**`coletar-criativos-meta`**: Ja busca `preview_shareable_link` e salva como `url_preview`. Adicionar busca do campo `ad_preview` do Meta para obter thumbnail renderizavel (iframe HTML do anuncio) quando `url_midia` estiver vazio.

**`coletar-criativos-google`**: Adicionar busca de asset URLs para responsive search ads e responsive display ads que atualmente ficam sem preview.

### Fase 3: Melhorar Exibicao de Previews no Frontend

**`CriativoRankingCard.tsx`**: 
- Quando `url_midia` nao existe mas `url_preview` existe (link fb.me), exibir botao "Ver Preview" ao inves de icone vazio
- Adicionar fallback para thumbnail via `url_preview` quando possivel

**`CampanhaSuperTrunfo.tsx` (dialog)**:
- Mostrar metricas extras quando disponiveis: alcance, frequencia, CPC medio
- Destacar ROAS quando `valor_conversao > 0`

**`CriativoDetalhesModal.tsx`**:
- Exibir alcance e frequencia do criativo
- Mostrar ROAS e valor de conversao quando disponiveis

### Fase 4: Enriquecer Metricas de Criativos do Meta

Atualmente, `coletar-criativos-meta` coleta criativos mas **nao busca metricas por criativo** (so salva o criativo em si). As metricas por criativo precisam de uma chamada separada `ad_id/insights`.

Criar logica dentro de `coletar-criativos-meta` para, apos coletar os ads, buscar metricas por ad (`ad_id/insights?fields=impressions,clicks,spend,actions,reach,frequency`) e salvar em `criativo_metricas_dia`. Isso preenchera os cards que hoje mostram 0 em tudo.

---

## Secao Tecnica

### Migration SQL
```sql
-- Expandir campanha_metricas_dia
ALTER TABLE public.campanha_metricas_dia
  ADD COLUMN IF NOT EXISTS alcance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequencia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parcela_impressao numeric,
  ADD COLUMN IF NOT EXISTS video_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_avg_watch_time numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_clicks integer DEFAULT 0;

-- Expandir criativo_metricas_dia
ALTER TABLE public.criativo_metricas_dia
  ADD COLUMN IF NOT EXISTS alcance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequencia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversoes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_conversao numeric DEFAULT 0;
```

### Alteracoes em Edge Functions
- `coletar-metricas-meta`: mapear campos da resposta API para novas colunas no upsert
- `coletar-metricas-google`: agregar metricas por campaign (somando devices) e salvar cpc_medio e parcela_impressao
- `coletar-criativos-meta`: adicionar chamada `insights` por batch de ad IDs para preencher `criativo_metricas_dia`
- `coletar-criativos-google`: ja salva metricas por criativo, apenas adicionar as novas colunas

### Alteracoes no Frontend
- `CriativoRankingCard`: exibir alcance/frequencia quando > 0, melhorar fallback visual de preview
- `CampanhaSuperTrunfo`: adicionar ROAS e alcance no dialog de detalhes
- `RelatorioCreativos.tsx`: consumir novas colunas na query de metricas

