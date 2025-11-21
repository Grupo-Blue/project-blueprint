# Edge Functions - Jobs Diários de Coleta

Este diretório contém as Edge Functions para coleta automática de métricas de Meta Ads, Google Ads e sincronização com Pipedrive.

## Funções Disponíveis

### 1. coletar-metricas-meta
Coleta métricas diárias do Meta Ads (Facebook/Instagram) para todas as empresas com integrações ativas.

### 2. coletar-metricas-google
Coleta métricas diárias do Google Ads para todas as empresas com integrações ativas.

### 3. calcular-metricas-semanais
Processa e agrega métricas semanais por campanha e empresa.

### 4. sincronizar-pipedrive
Sincroniza leads e eventos de vendas do Pipedrive CRM para todas as empresas com integrações ativas.

## Como Configurar Jobs Diários (Cron)

Para executar essas funções automaticamente todos os dias, você precisa configurar cron jobs no Supabase.

### Passo 1: Ativar Extensões

Execute no SQL Editor do Supabase:

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Passo 2: Configurar Cron Jobs

Execute no SQL Editor (substitua YOUR_ANON_KEY pela chave real):

```sql
-- Job para Meta Ads (executa todo dia às 2h da manhã)
SELECT cron.schedule(
  'coletar-metricas-meta-diario',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Job para Google Ads (executa todo dia às 2h30 da manhã)
SELECT cron.schedule(
  'coletar-metricas-google-diario',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Job para calcular métricas semanais (executa todo dia às 3h da manhã)
SELECT cron.schedule(
  'calcular-metricas-semanais-diario',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/calcular-metricas-semanais',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Job para sincronizar Pipedrive (executa todo dia às 4h da manhã)
SELECT cron.schedule(
  'sincronizar-pipedrive-diario',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/sincronizar-pipedrive',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Passo 3: Verificar Jobs Configurados

```sql
-- Ver todos os jobs agendados
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Passo 4: Gerenciar Jobs

```sql
-- Desabilitar um job temporariamente
SELECT cron.unschedule('coletar-metricas-meta-diario');

-- Remover um job permanentemente
SELECT cron.unschedule('coletar-metricas-meta-diario');
```

## Teste Manual

Você pode testar as funções manualmente chamando-as via HTTP:

```bash
# Meta Ads
curl -X POST https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-meta \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Google Ads
curl -X POST https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-google \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Métricas Semanais
curl -X POST https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/calcular-metricas-semanais \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Logs e Monitoramento

Os logs das execuções podem ser visualizados:
1. No painel do Supabase em Edge Functions > Logs
2. Nos logs do cron job via query SQL acima

## Notas Importantes

- As credenciais de API são armazenadas na tabela `integracao` com criptografia
- Apenas integrações com `ativo = true` são processadas
- As métricas são inseridas na tabela `campanha_metricas_dia`
- Em caso de erro em uma empresa, o processo continua para as próximas
- O horário dos jobs pode ser ajustado conforme necessário (timezone UTC)
