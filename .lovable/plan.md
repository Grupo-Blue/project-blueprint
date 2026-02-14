

# Corrigir URL de validacao do Metricool

## Problema

A URL usada na funcao `validar-integracao` para testar credenciais do Metricool esta no formato errado:

```
ERRADO: /api/{user_id}/blog/{blog_id}/stats/timeline?...
CORRETO: /api/stats/timeline/{metrica}?blogId={blog_id}&userId={user_id}&start=...&end=...
```

Todas as outras funcoes que chamam o Metricool com sucesso (`sincronizar-metricool`, `coletar-conteudo-metricool`, `enriquecer-campanhas-metricool`) usam query parameters `blogId` e `userId`, nao path segments.

## Correcao

Alterar a URL em `supabase/functions/validar-integracao/index.ts` (linha 267) de:

```
https://app.metricool.com/api/${user_id}/blog/${blog_id}/stats/timeline?startDate=...
```

Para:

```
https://app.metricool.com/api/stats/timeline/igFollowers?blogId=${blog_id}&userId=${user_id}&start=20250101&end=20250102
```

Tambem ajustar os nomes dos parametros de data para `start`/`end` (sem "Date") e o formato para `YYYYMMDD`, conforme usado nas funcoes que ja funcionam.

## Arquivo modificado

- `supabase/functions/validar-integracao/index.ts` -- corrigir URL na funcao `validarMetricool`

