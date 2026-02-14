

# Automacao Completa da Integracao Apify

## Objetivo
Tornar todas as 4 funcionalidades Apify totalmente automaticas, executando 2x ao dia (07:00 e 13:00 BRT = 10:00 e 16:00 UTC), sem necessidade de interacao manual.

---

## 1. Correcoes no Banco de Dados

As edge functions usam `upsert` com `onConflict`, mas faltam as constraints UNIQUE necessarias:

| Tabela | Constraint necessaria |
|---|---|
| `concorrente_anuncio` | UNIQUE em `ad_id_externo` |
| `tendencia_mercado` | UNIQUE em `url` |

Sem essas constraints, os upserts falham silenciosamente ou geram duplicatas.

---

## 2. Cronjobs a Criar (pg_cron + pg_net)

Serao criados **8 cronjobs** (4 funcoes x 2 horarios):

| Funcao | 07:00 BRT (10:00 UTC) | 13:00 BRT (16:00 UTC) |
|---|---|---|
| `recuperar-previews-apify` | Sim | Sim |
| `enriquecer-lead-linkedin` | Sim | Sim |
| `monitorar-concorrentes-apify` | Sim | Sim |
| `coletar-tendencias-cripto` | Sim | Sim |

Cada cronjob usa `net.http_post` para invocar a edge function correspondente com os headers de autorizacao.

**Nota sobre concorrentes:** A funcao `monitorar-concorrentes-apify` inicia os actors do Apify de forma assincrona. A funcao `verificar-coleta-concorrentes` precisa ser chamada depois para coletar os resultados. Para resolver isso de forma automatica, sera adicionada logica dentro da propria funcao `monitorar-concorrentes-apify` para, apos iniciar os runs, aguardar e verificar os resultados automaticamente (polling interno), eliminando a necessidade de chamar `verificar-coleta-concorrentes` separadamente no cron.

---

## 3. Ajuste na Edge Function `monitorar-concorrentes-apify`

Atualmente essa funcao apenas **inicia** os actors e retorna os `run_id`s, exigindo uma segunda chamada manual a `verificar-coleta-concorrentes`.

**Alteracao:** Adicionar um parametro opcional `auto_verify: true` (default no cron). Quando ativo, a funcao:
1. Inicia todos os actors
2. Aguarda ate 8 minutos fazendo polling de status
3. Quando cada run termina, coleta os resultados e insere no banco
4. Registra log final na `cronjob_execucao`

Isso torna o fluxo de concorrentes totalmente self-contained.

---

## 4. Sequencia de Implementacao

1. Criar migration com as constraints UNIQUE
2. Atualizar `monitorar-concorrentes-apify` com logica de auto-verify
3. Criar os 8 cronjobs via SQL (insert direto, nao migration)

---

## Secao Tecnica

### Migration SQL (constraints)
```sql
-- Constraint UNIQUE para upserts de concorrentes
ALTER TABLE public.concorrente_anuncio 
  ADD CONSTRAINT concorrente_anuncio_ad_id_externo_key UNIQUE (ad_id_externo);

-- Constraint UNIQUE para upserts de tendencias
ALTER TABLE public.tendencia_mercado 
  ADD CONSTRAINT tendencia_mercado_url_key UNIQUE (url);
```

### Cronjobs SQL (exemplo de 1 dos 8)
```sql
SELECT cron.schedule(
  'recuperar-previews-apify-manha',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/recuperar-previews-apify',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Alteracao em `monitorar-concorrentes-apify`
- Adicionar funcao interna `waitAndCollectResults(runs, supabase, token)` que faz polling dos runs e insere resultados (reutilizando logica de `verificar-coleta-concorrentes`)
- Chamar automaticamente quando invocado sem parametro `skip_verify`

