

# Corrigir Coleta GA4 - Parada desde Dezembro

## Problema Identificado

A funcao `coletar-metricas-ga4` **nunca teve um cron job agendado**. Diferente do Google Ads (que tinha crons funcionando), o GA4 so foi executado manualmente em 11/dez/2025. Desde entao, ninguem mais disparou a funcao.

- Ultima coleta: 10/dez/2025 (dados na tabela `landingpage_metricas`)
- Ultima execucao registrada: 11/dez/2025 (manual)
- Cron jobs GA4: **zero** (confirmado via `cron.job`)
- Integracoes ativas: 4 (1 Blue Consult + 3 Tokeniza)
- A funcao ja possui logging em `cronjob_execucao` (nao precisa modificar)

## Plano de Correcao

### Passo 1: Criar cron job para coleta diaria

Agendar execucao diaria da funcao `coletar-metricas-ga4` via `pg_cron` + `net.http_post`, seguindo o mesmo padrao das outras funcoes.

Horario sugerido: **06:30 UTC** (03:30 BRT) - fora do horario das outras coletas para evitar concorrencia.

```sql
SELECT cron.schedule(
  'invoke-coletar-metricas-ga4',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-ga4',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{"dias": 7}'::jsonb
  ) AS request_id;
  $$
);
```

### Passo 2: Backfill de dados perdidos (Dez 11 a Fev 12)

Disparar a funcao manualmente com `dias: 65` para recuperar os ~2 meses de dados perdidos para todas as 4 integracoes ativas.

### Passo 3 (opcional): Criar cron para enriquecer-leads-ga4

A funcao `enriquecer-leads-ga4` tambem nao tem cron. Pode ser agendada para rodar apos a coleta (ex: 07:00 UTC) para manter os leads atualizados com dados GA4.

## Nenhuma alteracao de codigo necessaria

A funcao `coletar-metricas-ga4` ja possui:
- Logging em `cronjob_execucao` (sucesso e erro)
- Captura de `startTime` e duracao
- Suporte ao parametro `dias` para backfill

Apenas precisa do agendamento via SQL e da execucao manual para backfill.

