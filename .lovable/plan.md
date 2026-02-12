

# Remover Cron Jobs Duplicados

## Analise Detalhada

Apos comparar todos os cron jobs antigos (IDs baixos) com os novos (IDs 20+), identifiquei quais sao realmente duplicados e quais sao **unicos** (remover causaria problemas).

### Duplicados Confirmados (SEGUROS para remover)

| ID Antigo | Nome | Horario | ID Novo (substituto) | Horario Novo |
|-----------|------|---------|---------------------|-------------|
| 1 | coletar-metricas-meta-diario | 02:00 | 22 (invoke-coletar-metricas-meta) | 04:30 |
| 5 | sincronizar-tokeniza-diario | 04:30 | 27 (invoke-sincronizar-tokeniza) | 05:45 |
| 7 | coletar-criativos-meta-diario | 02:15 | 24 (invoke-coletar-criativos-meta) | 05:00 |
| 9 | importar-campanhas-meta-diario | 01:45 | 20 (invoke-importar-campanhas-meta) | 04:00 |
| 45 | detectar-alertas-automaticos-0h | 00:00 | 43 (detectar-alertas-automaticos-00h) | 00:00 |

Tambem o **ID 3** (`calcular-metricas-semanais-diario`) chama a funcao `calcular-metricas-semanais` que **nao existe mais** como edge function (foi substituida por `calcular-metricas-diarias`, que roda no ID 34). Este cron falha silenciosamente.

### NAO sao duplicados (NÃO remover!)

| ID | Nome | Funcao | Motivo |
|----|------|--------|--------|
| 2 | coletar-metricas-google-diario | coletar-metricas-google | Unico cron para metricas Google Ads |
| 6 | analise-inteligencia-diaria | analise-inteligencia | Unico cron para analise IA |
| 8 | coletar-criativos-google-diario | coletar-criativos-google | Unico cron para criativos Google Ads |
| 10 | importar-campanhas-google-diario | importar-campanhas-google | Unico cron para importar campanhas Google |

Estes 4 crons (2, 6, 8, 10) sao os **unicos** agendamentos para essas funcoes. Remove-los desativaria a coleta do Google Ads e a analise de inteligencia.

## Plano de Execucao

Executar 6 chamadas `cron.unschedule` para remover apenas os duplicados confirmados:

```sql
SELECT cron.unschedule(1);   -- coletar-metricas-meta (duplicado do ID 22)
SELECT cron.unschedule(3);   -- calcular-metricas-semanais (funcao inexistente)
SELECT cron.unschedule(5);   -- sincronizar-tokeniza (duplicado do ID 27)
SELECT cron.unschedule(7);   -- coletar-criativos-meta (duplicado do ID 24)
SELECT cron.unschedule(9);   -- importar-campanhas-meta (duplicado do ID 20)
SELECT cron.unschedule(45);  -- detectar-alertas-0h (duplicado do ID 43)
```

### Resultado Final

- 6 crons removidos (duplicados/obsoletos)
- 4 crons antigos preservados (2, 6, 8, 10) por serem unicos
- Zero impacto nas coletas ativas

### Observacao para o futuro

Os IDs 2, 6, 8 e 10 usam o padrao antigo (`net.http_post` com horarios diferentes). Futuramente, pode-se criar versoes novas com horarios normalizados e entao remover estes tambem.

