
# Melhorias Completas na Integracao Stape

## Resumo

Implementar 4 melhorias na integracao Stape: cross-match via FBP, inferencia automatica de empresa nos eventos, disparo automatico de Meta CAPI em vendas, e correcao das metricas agregadas no enriquecimento.

---

## 1. Cross-match Stape via FBP (Facebook Browser ID)

**Problema**: O `enriquecer-leads-stape` so faz match por email no `custom_data`. Muitos eventos Stape nao tem email, mas tem `fbp`. Leads que chegam pelo `lp-lead-webhook` ja salvam o `fbp` na tabela `lead`.

**Solucao**: Adicionar uma estrategia de match por `fbp` no `enriquecer-leads-stape`:
1. Alem de buscar eventos por email no `custom_data`, buscar eventos cujo `fbp` corresponda ao `fbp` do lead
2. Tambem no `stape-webhook`, alem de buscar lead por email/telefone e por `client_id`, adicionar busca por `fbp`

**Arquivos alterados**:
- `supabase/functions/enriquecer-leads-stape/index.ts` - Adicionar match por `fbp`
- `supabase/functions/stape-webhook/index.ts` - Adicionar busca de lead por `fbp`

**Migracao**: Criar indice na coluna `fbp` da tabela `stape_evento` para performance:
```text
CREATE INDEX IF NOT EXISTS idx_stape_evento_fbp ON public.stape_evento(fbp);
CREATE INDEX IF NOT EXISTS idx_lead_fbp ON public.lead(fbp);
```

---

## 2. Inferir empresa nos eventos Stape

**Problema**: Eventos chegam com `id_empresa = NULL` no `stape-webhook` quando o GTM Server nao envia esse campo.

**Solucao**: Quando `id_empresa` nao vier no payload, inferir pela `stape_container_url` cadastrada na `empresa_stape_config`:
1. Extrair o dominio do `page_location` do evento
2. Comparar com os dominios das `stape_container_url` cadastradas
3. Fallback: usar mapeamento hardcoded dos dominios conhecidos (Blue = blueconsult.com.br, Tokeniza = tokeniza.com.br)

**Arquivo alterado**:
- `supabase/functions/stape-webhook/index.ts` - Adicionar logica de inferencia de empresa

---

## 3. Auto-disparar Meta CAPI em vendas

**Problema**: O `stape-meta-capi` existe mas nunca e chamado automaticamente. Quando um lead tem venda confirmada (`venda_realizada = true`), deveriamos enviar um evento `Purchase` para o Meta.

**Solucao**: Criar uma nova Edge Function `disparar-meta-capi-venda` que:
1. Busca leads com `venda_realizada = true` que ainda nao tiveram o evento CAPI enviado (nova coluna `meta_capi_purchase_enviado`)
2. Para cada lead com `fbp` ou `fbc` ou email, monta o payload e chama o `stape-meta-capi`
3. Marca o lead como enviado

Tambem integrar no `pipedrive-webhook`: quando um deal e marcado como won, disparar o CAPI de forma fire-and-forget.

**Arquivos**:
- Nova Edge Function: `supabase/functions/disparar-meta-capi-venda/index.ts`
- `supabase/functions/pipedrive-webhook/index.ts` - Adicionar disparo fire-and-forget quando `venda_realizada = true`

**Migracao**:
```text
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS meta_capi_purchase_enviado BOOLEAN DEFAULT false;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS meta_capi_purchase_at TIMESTAMPTZ;
```

**Config**:
```text
[functions.disparar-meta-capi-venda]
verify_jwt = false
```

---

## 4. Corrigir metricas agregadas no enriquecimento

**Problema**: O calculo de `stape_tempo_total_segundos` esta invertido (usa `firstEvent` e `lastEvent` da array filtrada por email, nao da array completa por `client_id`).

**Solucao**: Corrigir a logica para usar `todosEventos[0]` como primeiro e `todosEventos[todosEventos.length - 1]` como ultimo (ja que a query ordena por `ascending: true`). Tambem atualizar a busca de leads na fase 2 para recalcular metricas mesmo quando `stape_tempo_total_segundos` ja tem valor (atualizar periodicamente).

**Arquivo alterado**:
- `supabase/functions/enriquecer-leads-stape/index.ts` - Corrigir calculo de timestamps

---

## Resumo tecnico de alteracoes

| Arquivo | Acao |
|---|---|
| `supabase/functions/stape-webhook/index.ts` | Adicionar inferencia de empresa + match por FBP |
| `supabase/functions/enriquecer-leads-stape/index.ts` | Adicionar match FBP + corrigir metricas |
| `supabase/functions/disparar-meta-capi-venda/index.ts` | Novo - disparo automatico Purchase |
| `supabase/functions/pipedrive-webhook/index.ts` | Adicionar trigger CAPI em venda |
| `supabase/config.toml` | Adicionar config da nova funcao |
| Migracao SQL | Indices FBP + coluna `meta_capi_purchase_enviado` |

## Fluxo apos melhorias

```text
Evento Stape chega
  |
  +-- Inferir id_empresa pelo dominio (se nao veio no payload)
  +-- Inserir evento
  +-- Match lead por: email/telefone -> client_id -> FBP (novo!)
  +-- Atualizar lead com dados Stape

Lead chega pelo LP webhook
  |
  +-- Salvar com fbp, fbc, gclid
  +-- Enriquecer-leads-stape depois faz cross-match via FBP

Venda confirmada no Pipedrive
  |
  +-- pipedrive-webhook atualiza venda_realizada = true
  +-- Fire-and-forget: disparar-meta-capi-venda
  +-- Envia Purchase event para Meta CAPI com fbp/fbc/email
  +-- Marca meta_capi_purchase_enviado = true
```
