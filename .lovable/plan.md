

# Correção: Coleta de Anúncios de Concorrentes

## Problemas Identificados

### 1. Input incorreto para o Actor do Apify
A resposta da API retorna:
```
"Input is not valid: Field input.urls is required"
```
O actor `curious_coder~facebook-ads-library-scraper` exige um campo `urls` contendo URLs da Facebook Ads Library. O codigo atual envia `searchQuery`, que nao e aceito.

### 2. Timeout da Edge Function
A funcao `runApifyActorAndWait` faz polling sincrono por ate 10 minutos. Edge Functions tem timeout maximo de ~150-400 segundos. Mesmo corrigindo o input, a funcao ira expirar antes do Apify concluir.

---

## Solucao Proposta

Dividir o processo em **duas etapas** usando arquitetura assíncrona:

### Etapa 1: Edge Function "Start" (resposta imediata)
- Inicia o run no Apify com o input correto (campo `urls`)
- Salva o `run_id` na tabela `cronjob_execucao` com status "em_andamento"
- Retorna imediatamente ao frontend com o `run_id`

### Etapa 2: Edge Function "Check" (polling do frontend)
- Nova funcao `verificar-coleta-concorrentes` que recebe um `run_id`
- Consulta o status do run no Apify
- Se concluido: busca os resultados e salva no banco
- Se ainda rodando: retorna status "em_andamento"
- O frontend faz polling a cada 15 segundos ate concluir

```text
Frontend                    Edge Function (Start)           Apify
   |                              |                           |
   |--- POST /monitorar --------->|                           |
   |                              |--- Start Actor ---------->|
   |                              |<-- run_id ----------------|
   |<-- { run_id, status } -------|                           |
   |                              |                           |
   |--- GET /verificar?run=X ---->|                           |
   |                              |--- Check status --------->|
   |<-- { status: "running" } ----|<-- RUNNING ---------------|
   |                              |                           |
   |  (15s later)                 |                           |
   |--- GET /verificar?run=X ---->|                           |
   |                              |--- Check status --------->|
   |                              |<-- SUCCEEDED + dataset ---|
   |                              |--- Save to DB             |
   |<-- { status: "done", N } ----|                           |
```

---

## Alteracoes Tecnicas

### 1. Edge Function `monitorar-concorrentes-apify` (reescrever)
- Remover `runApifyActorAndWait` (polling sincrono)
- Apenas iniciar os runs do Apify e retornar os `run_id`s
- Input correto para Meta:
  ```typescript
  {
    urls: [`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(config.facebook_page_name)}&search_type=keyword_unordered`],
    maxItems: 50,
  }
  ```

### 2. Nova Edge Function `verificar-coleta-concorrentes`
- Recebe `run_ids` (array)
- Para cada run, consulta status no Apify
- Se SUCCEEDED: busca dados do dataset e faz upsert no banco
- Retorna status consolidado

### 3. Frontend `AnaliseCompetitiva.tsx`
- Botao "Coletar Anuncios" inicia a coleta e recebe os `run_id`s
- Ativa polling automatico (a cada 15s) chamando `verificar-coleta-concorrentes`
- Mostra progresso: "Coletando... (aguardando Apify)"
- Para o polling quando todos os runs terminarem
- Atualiza a lista de anuncios automaticamente

### 4. Config `supabase/config.toml`
- Adicionar entrada para `verificar-coleta-concorrentes` com `verify_jwt = false`

---

## Resumo dos Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/monitorar-concorrentes-apify/index.ts` | Reescrever (apenas inicia runs) |
| `supabase/functions/verificar-coleta-concorrentes/index.ts` | Criar (verifica status e salva) |
| `src/pages/AnaliseCompetitiva.tsx` | Atualizar (polling no frontend) |
| `supabase/config.toml` | Adicionar nova funcao |

