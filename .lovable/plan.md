
# Integração Apify para o SGT

## Contexto

O SGT gerencia 4 empresas do ecossistema cripto/digital:
- **Blue Consult**: Imposto de renda para cripto
- **Tokeniza**: Investimentos tokenizados
- **Axia**: Software house cripto
- **M.Puppe**: Escritório de advocacia digital

### Dores Atuais
1. Criativos sem preview (~15-20% dos registros têm `url_preview` nulo)
2. Zero visibilidade sobre concorrentes
3. Sem dados do LinkedIn para qualificação de leads B2B
4. Enriquecimento de leads limitado às fontes atuais (Mautic, GA4, Pipedrive)

---

## Módulos Propostos

### 1. Fallback de Previews via Meta Ads Library

**Problema**: A API oficial do Meta nem sempre retorna `preview_shareable_link`

**Solução**: Usar `curious_coder/facebook-ads-library-scraper` como fallback

```text
┌─────────────────────────────────────────────────────────┐
│  Fluxo: Recuperação de Previews                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Cronjob detecta criativos sem url_preview           │
│                         ↓                               │
│  2. Busca página do Facebook da empresa                 │
│                         ↓                               │
│  3. Chama Apify Actor: facebook-ads-library-scraper     │
│        Input: page_name, date_range                     │
│                         ↓                               │
│  4. Match por texto/imagem com criativo existente       │
│                         ↓                               │
│  5. Atualiza url_preview e url_midia no banco           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Edge Function**: `recuperar-previews-apify`

**Benefício**: Preencher 100% dos previews de criativos

---

### 2. Monitoramento de Concorrentes

**Problema**: Zero inteligência competitiva

**Solução**: Dashboard com anúncios de concorrentes coletados via Apify

#### Concorrentes Sugeridos por Empresa:

| Empresa | Concorrentes para Monitorar |
|---------|----------------------------|
| **Blue** | Declare Cripto, Cointimes IR, Cripto Fácil, Foxbit IR |
| **Tokeniza** | Bloxs, Vórtx, CVM exchanges, Hurst Capital |
| **Axia** | Chainlink Labs BR, Polygon Studios, Ethereum Brasil |
| **M.Puppe** | PCPD Advogados, TozziniFreire Tech, Pinheiro Neto Digital |

#### Dados Coletados:

```text
┌────────────────────────────────────────────────────────────┐
│  Tabela: concorrente_anuncio                               │
├────────────────────────────────────────────────────────────┤
│  - id_empresa (qual empresa está monitorando)              │
│  - concorrente_nome                                        │
│  - plataforma (META, GOOGLE, LINKEDIN)                     │
│  - ad_id_externo                                           │
│  - titulo                                                  │
│  - texto_corpo                                             │
│  - url_destino                                             │
│  - url_midia (imagem/video)                                │
│  - data_inicio_veiculo                                     │
│  - data_detectado                                          │
│  - status (ATIVO, PAUSADO)                                 │
│  - impressoes_estimadas (quando disponível)                │
└────────────────────────────────────────────────────────────┘
```

**Actors Utilizados**:
- `curious_coder/facebook-ads-library-scraper` - Meta Ads
- `silva95gustavo/linkedin-ad-library-scraper` - LinkedIn Ads
- `silva95gustavo/google-ads-scraper` - Google Ads

**Edge Function**: `monitorar-concorrentes-apify`

**UI**: Nova página `/analise-competitiva` com:
- Cards de anúncios por concorrente
- Timeline de novos anúncios detectados
- Alertas quando concorrente lança campanha nova
- Análise de copy e CTAs mais usados

---

### 3. Enriquecimento LinkedIn para Leads B2B

**Problema**: Leads chegam com email mas sem contexto profissional

**Solução**: Enriquecer com dados do LinkedIn

#### Fluxo de Enriquecimento:

```text
┌──────────────────────────────────────────────────────────────┐
│  Trigger: Lead criado com email corporativo                  │
│                           ↓                                  │
│  1. Verificar se é email pessoal (gmail, hotmail) → Skip     │
│                           ↓                                  │
│  2. Chamar: enrichmentlabs/linkedin-data-enrichment-api      │
│        Input: email                                          │
│                           ↓                                  │
│  3. Receber:                                                 │
│     - Nome completo                                          │
│     - Cargo atual                                            │
│     - Empresa atual                                          │
│     - URL do perfil LinkedIn                                 │
│     - Histórico de empresas                                  │
│     - Skills                                                 │
│                           ↓                                  │
│  4. Atualizar lead com novos campos                          │
│                           ↓                                  │
│  5. Recalcular score de temperatura                          │
└──────────────────────────────────────────────────────────────┘
```

#### Novos Campos na Tabela Lead:

```sql
ALTER TABLE lead ADD COLUMN linkedin_url TEXT;
ALTER TABLE lead ADD COLUMN linkedin_cargo TEXT;
ALTER TABLE lead ADD COLUMN linkedin_empresa TEXT;
ALTER TABLE lead ADD COLUMN linkedin_setor TEXT;
ALTER TABLE lead ADD COLUMN linkedin_senioridade TEXT; -- Junior, Pleno, Senior, C-Level
ALTER TABLE lead ADD COLUMN linkedin_conexoes INT;
ALTER TABLE lead ADD COLUMN linkedin_ultima_atualizacao TIMESTAMP;
```

**Edge Function**: `enriquecer-lead-linkedin`

**Benefício para cada empresa**:
- **Blue**: Identificar CFOs e controllers de empresas com cripto
- **Tokeniza**: Detectar investidores institucionais
- **Axia**: Identificar CTOs e tech leads
- **M.Puppe**: Detectar juridicos e compliance officers

---

### 4. Monitoramento de Tendências Cripto

**Problema**: Falta visibilidade sobre temas quentes no mercado

**Solução**: Scraping de notícias e regulamentações

#### Fontes para Monitorar:

| Fonte | Tipo | Relevância |
|-------|------|------------|
| Portal do Bitcoin | Notícias | Blue, Tokeniza |
| CVM | Regulamentação | Tokeniza, M.Puppe |
| Banco Central | Regulamentação | Todas |
| CoinDesk BR | Tendências | Blue, Axia |
| Livecoins | Mercado | Blue, Tokeniza |

**Dados Coletados**:

```text
┌────────────────────────────────────────────────────────────┐
│  Tabela: tendencia_mercado                                 │
├────────────────────────────────────────────────────────────┤
│  - fonte                                                   │
│  - titulo                                                  │
│  - resumo                                                  │
│  - url                                                     │
│  - data_publicacao                                         │
│  - categorias[] (regulamentacao, tributacao, mercado)      │
│  - relevancia_score                                        │
│  - empresas_relacionadas[] (Blue, Tokeniza, etc)           │
└────────────────────────────────────────────────────────────┘
```

**Actor**: `apify/web-scraper` configurado para cada fonte

**Edge Function**: `coletar-tendencias-cripto`

**UI**: Widget no dashboard executivo com últimas notícias relevantes

---

## Arquitetura de Integração

```text
┌─────────────────────────────────────────────────────────────────┐
│                        SGT Backend                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │  Cronjobs    │    │  Webhooks    │    │  Manual UI   │     │
│   │  (Scheduled) │    │  (Triggers)  │    │  (On-demand) │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              ↓                                  │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │              Edge Functions Layer                         │ │
│   ├──────────────────────────────────────────────────────────┤ │
│   │  • recuperar-previews-apify                              │ │
│   │  • monitorar-concorrentes-apify                          │ │
│   │  • enriquecer-lead-linkedin                              │ │
│   │  • coletar-tendencias-cripto                             │ │
│   └──────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ↓                                  │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │              Apify API Client                             │ │
│   │              (APIFY_API_TOKEN em secrets)                │ │
│   └──────────────────────────────────────────────────────────┘ │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│                      Apify Platform                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ Facebook Ads   │  │ LinkedIn Ads   │  │ LinkedIn       │     │
│  │ Library        │  │ Library        │  │ Enrichment     │     │
│  │ Scraper        │  │ Scraper        │  │ API            │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐                         │
│  │ Google Ads     │  │ Web Scraper    │                         │
│  │ Scraper        │  │ (Tendências)   │                         │
│  └────────────────┘  └────────────────┘                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Custos Estimados (Apify)

| Actor | Uso Estimado/Mês | Custo Aproximado |
|-------|------------------|------------------|
| Facebook Ads Library | 500 runs | $15-25 |
| LinkedIn Ads Library | 200 runs | $10-15 |
| LinkedIn Enrichment | 300 leads | $30-50 |
| Web Scraper (Tendências) | 1000 páginas | $5-10 |
| **Total Estimado** | | **$60-100/mês** |

---

## Priorização Recomendada

### Fase 1 (Impacto Imediato)
1. **Fallback de Previews** - Resolve dor existente
2. **Enriquecimento LinkedIn** - Melhora qualificação B2B

### Fase 2 (Inteligência Competitiva)
3. **Monitoramento Concorrentes Meta** - Maior volume de ads
4. **Monitoramento LinkedIn Ads** - Relevante para B2B

### Fase 3 (Contextual)
5. **Tendências e Notícias** - Nice to have

---

## Implementação Técnica

### Secret Necessário
```
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxx
```

### Exemplo de Chamada Apify (Edge Function)

```typescript
const APIFY_BASE_URL = "https://api.apify.com/v2";

async function runApifyActor(actorId: string, input: object) {
  const token = Deno.env.get("APIFY_API_TOKEN");
  
  const response = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  
  const { data } = await response.json();
  return data.id; // run ID para polling
}
```

---

## Próximos Passos

1. **Criar conta Apify** e obter API token
2. **Implementar Fase 1**: Previews + LinkedIn
3. **Configurar concorrentes** por empresa
4. **Criar UI** de análise competitiva
5. **Agendar cronjobs** para coletas periódicas

---

## Resumo de Valor

| Dor | Solução Apify | Impacto |
|-----|---------------|---------|
| Previews faltando | Fallback via Ads Library | 100% cobertura |
| Sem visão competitiva | Monitor concorrentes | Decisões estratégicas |
| Leads sem contexto B2B | LinkedIn enrichment | +40% conversão estimada |
| Sem awareness mercado | Scraping tendências | Timing de campanhas |
