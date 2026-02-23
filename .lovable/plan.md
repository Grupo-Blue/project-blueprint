
# Webhook para receber disparos do sistema de WhatsApp Business

## O que vai ser feito

Criar uma nova edge function `whatsapp-disparo-webhook` que recebe o payload do sistema de mensageria quando uma campanha de WhatsApp e concluida. A function vai:

1. Receber o payload com `event`, `company`, `campaignName`, `contacts[]`, etc.
2. Mapear o campo `company` (nome da empresa) para o `id_empresa` correspondente no banco
3. Para cada contato: buscar lead por telefone -- se existir, atualizar nome; se nao existir, criar lead novo
4. Criar um registro em `disparo_whatsapp` ja marcado como enviado
5. Vincular todos os leads processados na tabela `disparo_whatsapp_lead`

## Autenticacao

A function vai validar um Bearer token via header `Authorization`. O secret `SGT_WEBHOOK_SECRET` (que ja existe no projeto) sera reutilizado para isso.

## Mapeamento de empresa

O campo `company` do payload e um nome de empresa. A function faz um `SELECT` na tabela `empresa` com `ilike` no campo `nome` para encontrar o `id_empresa`. Se nao encontrar, retorna erro 400.

## Processamento de leads (em lote)

Para milhares de contatos, o processamento sera feito em batches de 500:

1. Normalizar todos os telefones para formato E.164 (+55...)
2. Buscar leads existentes por telefone (batch query)
3. Leads existentes: atualizar `nome_lead` se o nome vier no payload e o lead nao tiver nome
4. Leads novos: inserir com `origem_tipo: WEBHOOK`, `origem_canal: WHATSAPP`, `stage_atual: WhatsApp Disparo`
5. Coletar todos os `id_lead` (novos + existentes)

## Criacao do disparo

Inserir em `disparo_whatsapp`:
- `nome`: campo `campaignName` do payload
- `id_empresa`: mapeado pelo campo `company`
- `qtd_leads`: total de contatos processados
- `preset_usado`: "webhook-externo"
- `enviado`: true
- `data_envio`: campo `dispatchedAt` do payload

## Vinculacao

Inserir em `disparo_whatsapp_lead` todos os pares `id_disparo` + `id_lead` em batches de 500.

## Resposta

Retorna JSON com resumo: leads criados, atualizados, total, e id do disparo.

---

## Detalhes tecnicos

### Arquivo novo

`supabase/functions/whatsapp-disparo-webhook/index.ts`

### Config

Adicionar ao `supabase/config.toml`:
```
[functions.whatsapp-disparo-webhook]
verify_jwt = false
```

### Fluxo resumido

```text
POST /whatsapp-disparo-webhook
  |
  +-- Validar Authorization Bearer token (SGT_WEBHOOK_SECRET)
  +-- Validar event == "campaign.dispatched"
  +-- Mapear company name -> id_empresa
  +-- Para cada batch de 500 contatos:
  |     +-- Normalizar telefones
  |     +-- Buscar leads existentes por telefone
  |     +-- Inserir leads novos
  |     +-- Coletar IDs
  +-- Criar disparo_whatsapp
  +-- Inserir disparo_whatsapp_lead (batches)
  +-- Retornar resumo
```

### Nenhuma migracao de banco necessaria

As tabelas `disparo_whatsapp`, `disparo_whatsapp_lead` e `lead` ja possuem todas as colunas necessarias. O service role key contorna RLS.
