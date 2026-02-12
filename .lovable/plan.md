

# Corrigir Coleta Google Ads

## Problema Identificado

A coleta Google Ads NAO estava parada desde 09/jan. As funcoes executam diariamente via cron (`net.http_post`) com sucesso. Dois problemas mascaram isso:

1. **Cron jobs duplicados com erro**: Existem 3 cron jobs extras (IDs 21, 23, 25) que usam `extensions.http_post` -- funcao que nao existe neste ambiente. Esses jobs falham toda noite, gerando ruido nos logs.
2. **Falta de registro em `cronjob_execucao`**: A funcao `coletar-metricas-google` nao registra execucoes na tabela `cronjob_execucao`, entao parece que nao roda desde 09/jan (quando foi executada manualmente e o codigo manual registrou).

## Plano de Correcao

### Passo 1: Remover cron jobs duplicados com erro

Executar SQL para remover os 3 jobs que usam `extensions.http_post`:
- Job 21: `invoke-importar-campanhas-google` (04:15 UTC)
- Job 23: `invoke-coletar-metricas-google` (04:45 UTC)
- Job 25: `invoke-coletar-criativos-google` (05:15 UTC)

### Passo 2: Adicionar log de execucao nas 3 funcoes

Modificar as edge functions para registrar cada execucao na tabela `cronjob_execucao`, igual as outras funcoes fazem (ex: `coletar-metricas-meta`):

**Arquivos a modificar:**
- `supabase/functions/coletar-metricas-google/index.ts` -- adicionar insert em `cronjob_execucao` no final
- `supabase/functions/coletar-criativos-google/index.ts` -- adicionar insert em `cronjob_execucao` no final
- `supabase/functions/importar-campanhas-google/index.ts` -- adicionar insert em `cronjob_execucao` no final

Para cada funcao, adicionar:
- Captura de `startTime = Date.now()` no inicio
- Insert em `cronjob_execucao` com nome, status, duracao e detalhes no final (sucesso e erro)

### Passo 3: Recoleta historica de metricas perdidas

Embora o cron execute diariamente, ele so coleta metricas do dia atual (`hoje`). Para garantir que nao ha lacunas, disparar a funcao `coletar-metricas-google-historico` para o periodo de 10/jan a 12/fev.

## Detalhes tecnicos

### SQL para remover cron jobs duplicados

```sql
SELECT cron.unschedule(21);
SELECT cron.unschedule(23);
SELECT cron.unschedule(25);
```

### Padrao de log para as edge functions

```typescript
const startTime = Date.now();
// ... logica existente ...

// No final (sucesso):
await supabase.from('cronjob_execucao').insert({
  nome_cronjob: 'coletar-metricas-google',
  status: erros.length > 0 ? 'parcial' : 'sucesso',
  duracao_ms: Date.now() - startTime,
  detalhes_execucao: { resultados }
});

// No catch (erro):
await supabase.from('cronjob_execucao').insert({
  nome_cronjob: 'coletar-metricas-google',
  status: 'erro',
  mensagem_erro: error.message,
  duracao_ms: Date.now() - startTime
});
```

