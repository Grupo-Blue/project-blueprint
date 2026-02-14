

# Corrigir Coleta de Dados de Ads do Metricool

## Problema Raiz

Analisei a documentacao oficial (Swagger) do Metricool e encontrei o problema: a funcao `enriquecer-campanhas-metricool` esta usando **URLs que nao existem na API**.

URLs que estamos tentando (ERRADAS):
- `/ads/google/campaigns` -- NAO EXISTE
- `/ads/facebook/campaigns` -- NAO EXISTE
- `/ads/campaigns?network=google` -- NAO EXISTE

URLs corretas (da documentacao oficial):
- `/stats/adwords/campaigns` -- Google Ads (retorna `AdCampaign[]`)
- `/stats/facebookads/campaigns` -- Facebook/Meta Ads (retorna `AdCampaign[]`)
- `/stats/tiktokads/campaigns` -- TikTok Ads (retorna `AdCampaign[]`)

## Endpoints de Ads Disponiveis na API

Com base no Swagger oficial (`app.metricool.com/api/swagger.json`):

| Endpoint | Descricao | Parametros |
|---|---|---|
| `/stats/facebookads/campaigns` | Lista campanhas Facebook Ads com metricas | `start`, `end`, `sortcolumn` (name, impressions, reach, conversions, clicks, cpm, cpc, ctr, spent) |
| `/stats/adwords/campaigns` | Lista campanhas Google Ads com metricas | `start`, `end`, `sortcolumn` (impressions, cpm, cpc, ctr, cost) |
| `/stats/tiktokads/campaigns` | Lista campanhas TikTok Ads com metricas | `start`, `end`, `sortcolumn` |
| `/stats/adwords/keywords` | Keywords do Google Ads | `start`, `end`, `sortcolumn`, `CAMPAIGN` (filtro) |
| `/stats/aggregations/fbAdsPerformance` | Metricas agregadas Facebook Ads | `start`, `end`, `campaignid` (opcional) |
| `/stats/aggregations/adwordsPerformance` | Metricas agregadas Google Ads | `start`, `end`, `campaignid` (opcional) |
| `/stats/facebookads/metricvalue` | Valor de metrica especifica FB Ads | `metric`, `start`, `end`, `idCampaign` |

Todos usam `blogId` e `userId` como query params + `X-Mc-Auth` no header.

## Plano de Correcao

### 1. Corrigir URLs na funcao `enriquecer-campanhas-metricool`

Substituir os endpoints errados pelos corretos:

```text
ANTES (errado):
  /ads/google/campaigns?blogId=...
  /ads/facebook/campaigns?blogId=...
  /ads/campaigns?network=google&blogId=...

DEPOIS (correto):
  /stats/adwords/campaigns?blogId=...&userId=...&start=...&end=...
  /stats/facebookads/campaigns?blogId=...&userId=...&start=...&end=...
  /stats/tiktokads/campaigns?blogId=...&userId=...&start=...&end=...
```

### 2. Adicionar endpoint de agregacoes como complemento

Usar `/stats/aggregations/fbAdsPerformance` e `/stats/aggregations/adwordsPerformance` para obter totais agregados por periodo, que podem servir como validacao e fallback.

### 3. Processar resposta corretamente

O modelo `AdCampaign` do Metricool retorna os dados diretamente no array (nao aninhados em `stats` ou `daily`). Campos chave:
- `name`, `impressions`, `reach`, `conversions`, `clicks`, `cpm`, `cpc`, `ctr`, `spent`/`cost`

### 4. Adicionar TikTok Ads

Endpoint disponivel mas nao implementado. Aproveitar para incluir.

## Arquivo a Modificar

- `supabase/functions/enriquecer-campanhas-metricool/index.ts`
  - Funcao `fetchAdsPlatformData`: trocar URLs dos endpoints
  - Funcao `fetchAdsCreativeData`: trocar URLs dos endpoints
  - Adicionar chamada ao endpoint de agregacoes como complemento
  - Adicionar suporte a TikTok Ads

## Resultado Esperado

Apos a correcao, ao disparar `enriquecer-campanhas-metricool`:
- Os endpoints corretos serao chamados
- Dados reais de campanhas de Ads (impressoes, cliques, conversoes, CPC, CTR, ROAS, verba) serao salvos em `campanha_metricas_dia`
- Os leads vinculados a essas campanhas poderao ser enriquecidos com `metricool_roas_campanha`, `metricool_cpc_campanha`, etc.

