
# Correcao dos nomes de colunas na funcao `buscar_leads` do Chat IA

## Problema

A funcao `buscar_leads` no edge function `chat-ia-assistente` usa nomes de colunas que nao existem na tabela `lead`, causando erro "column does not exist":

| Coluna usada no codigo | Coluna real no banco |
|---|---|
| `canal` | `origem_canal` |
| `venda` | `venda_realizada` |
| `etapa_funil` | `stage_atual` |

Alem do `.select()`, as linhas 398-399 tambem filtram por `venda` em vez de `venda_realizada`.

## Alteracoes

**Arquivo:** `supabase/functions/chat-ia-assistente/index.ts`

1. **Linha 392** - Corrigir o `.select()`:
   - `canal` -> `origem_canal`
   - `venda` -> `venda_realizada`
   - `etapa_funil` -> `stage_atual`
   - Tambem adicionar `stage_atual, proprietario_nome, score_temperatura` para dados mais completos

2. **Linhas 398-399** - Corrigir os filtros de venda:
   - `.eq("venda", true)` -> `.eq("venda_realizada", true)`
   - `.eq("venda", false)` -> `.eq("venda_realizada", false)`

3. **Re-deploy** do edge function `chat-ia-assistente`
