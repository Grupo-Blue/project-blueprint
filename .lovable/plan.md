

# Agendar Cronjobs: Enriquecer Leads Stape + CAPI Venda Batch

## O que será feito

1. **Cronjob `enriquecer-leads-stape`** — a cada 2 horas (minutos 15, para não colidir com outros jobs)
2. **Cronjob `disparar-meta-capi-venda`** — 1x por dia às 09:00 UTC (06:00 BRT), modo batch

## Implementação

Executar dois comandos SQL via `cron.schedule` usando `net.http_post` para invocar as Edge Functions, seguindo o padrão já existente no projeto.

```text
-- Job 1: Enriquecer leads Stape a cada 2h
cron.schedule(
  'enriquecer-leads-stape-periodico',
  '15 */2 * * *',
  net.http_post → /functions/v1/enriquecer-leads-stape
)

-- Job 2: CAPI Venda batch diário
cron.schedule(
  'disparar-meta-capi-venda-diario',
  '0 9 * * *',
  net.http_post → /functions/v1/disparar-meta-capi-venda
)
```

Ambos os jobs usam a anon key existente e registram execução na tabela `cronjob_execucao` (já implementado nas funções).

Nenhuma alteração de código é necessária — apenas inserção dos agendamentos no banco.

