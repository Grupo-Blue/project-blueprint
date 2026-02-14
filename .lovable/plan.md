

# Enriquecer Leads com Dados de Ads do Metricool

## Diagnostico

O sistema `enriquecer-campanhas-metricool` existe mas **nao esta populando dados de Ads** (0 registros com `fonte_conversoes` preenchido). Antes de enriquecer leads, precisamos garantir que os dados de Ads estejam chegando.

## Fase 1 -- Diagnosticar e corrigir coleta de Ads

### 1.1 Executar a funcao e capturar logs detalhados

Disparar `enriquecer-campanhas-metricool` manualmente e analisar os logs para entender:
- Os endpoints de Ads estao retornando dados ou 404/vazio?
- Se retornam dados, o matching de campanhas esta falhando?

### 1.2 Adicionar fallback robusto

Se os endpoints especificos de Ads (`/ads/google/campaigns`) nao funcionam no plano atual do Metricool, usar as metricas timeline que ja funcionam:
- `googleAdsConversions`, `googleAdsConversionValue`, `googleAdsSpent`
- `facebookAdsConversions`, `facebookAdsConversionValue`, `facebookAdsSpent`

Estes endpoints timeline ja estao implementados como fallback na funcao, mas talvez nao estejam sendo salvos corretamente.

## Fase 2 -- Enriquecer Leads com dados cruzados

### 2.1 Novas colunas na tabela `lead`

Adicionar campos para dados vindos do cruzamento com Metricool:

```text
metricool_conversao_valor    NUMERIC    -- valor de conversao reportado pelo Metricool para a campanha do lead
metricool_roas_campanha      NUMERIC    -- ROAS da campanha que gerou o lead (via Metricool)
metricool_cpc_campanha       NUMERIC    -- CPC da campanha que gerou o lead
metricool_ctr_campanha       NUMERIC    -- CTR da campanha que gerou o lead
metricool_fonte              TEXT       -- 'GOOGLE' ou 'META' (confirmado pelo Metricool)
```

### 2.2 Logica de enriquecimento

Quando um lead tem `id_campanha_vinculada`, buscar os dados de Ads do Metricool para aquela campanha e preencher as colunas acima. Isso da ao comercial uma visao de "quanto custou trazer esse lead" mais fidedigna.

### 2.3 Integrar no score de temperatura

Adicionar no `lead-scoring.ts`:
- Leads de campanhas com ROAS alto (> 3x): bonus de +10 pontos (campanha performando bem = lead mais qualificado)
- Leads com CPC muito alto (> 2x media): flag de alerta para otimizacao

## Fase 3 -- Cruzar organico com leads

### 3.1 Vincular leads a posts organicos

Se o lead tem `utm_source=instagram` e `utm_medium=organic`, tentar cruzar com `social_posts` pela data de criacao do lead para identificar qual post organico gerou o lead.

### 3.2 Nova coluna

```text
id_post_organico_vinculado   UUID REFERENCES social_posts(id)
```

## Fase 4 -- Usar demografia para qualificacao

### 4.1 Contexto demografico

Quando `social_audiencia_demografica` tiver dados, usar para contextualizar leads:
- Se a audiencia e 70% masculina 25-34 e o lead se encaixa nesse perfil, bonus no score
- Se o lead esta fora do perfil principal, pode indicar lead de menor qualidade

---

## Detalhes tecnicos

### Arquivos a modificar

- `supabase/functions/enriquecer-campanhas-metricool/index.ts` -- corrigir salvamento de metricas timeline e adicionar logs de diagnostico
- Nova migration SQL -- adicionar colunas `metricool_*` na tabela `lead` e `id_post_organico_vinculado`
- `src/lib/lead-scoring.ts` -- adicionar bonus/penalidade baseado em ROAS/CPC do Metricool
- `supabase/functions/monitorar-enriquecimento-leads/index.ts` -- adicionar etapa de enriquecimento Metricool no loop de leads

### Novo fluxo de dados

```text
Metricool API
    |
    v
enriquecer-campanhas-metricool
    |
    v
campanha_metricas_dia (com fonte_conversoes = METRICOOL_*)
    |
    v
monitorar-enriquecimento-leads (loop existente)
    |
    +--> Para cada lead com id_campanha_vinculada:
    |      Buscar metricas Metricool da campanha
    |      Preencher metricool_roas, metricool_cpc, etc.
    |      Recalcular score_temperatura
    |
    v
lead (enriquecido com dados de Ads)
```

### Ordem de implementacao

1. Disparar `enriquecer-campanhas-metricool` e analisar logs (diagnostico)
2. Corrigir funcao se necessario
3. Criar migration com novas colunas
4. Atualizar `monitorar-enriquecimento-leads` com etapa Metricool
5. Atualizar `lead-scoring.ts` com bonus ROAS/CPC
6. Testar fluxo completo

### RLS

As novas colunas na tabela `lead` herdam as politicas RLS ja existentes -- nenhuma alteracao necessaria.

