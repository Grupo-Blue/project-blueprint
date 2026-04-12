

## Diagnóstico

### Problema 1: Uploads falham com "Invalid key"
O Supabase Storage **não aceita espaços** nos caminhos de arquivo. Nomes como `1 - Cópia da última declaração entregue.pdf` e `01 DECLARAÇÃO IRPF ANO 2019 EXERCICIO 2020.pdf` geram erro `Invalid key`. São 4 dos 12 arquivos.

**Correção**: Sanitizar o nome do arquivo antes do upload, substituindo espaços e caracteres especiais por underscores/hifens.

### Problema 2: Processamento travou após 1 arquivo
Três causas combinadas:

1. **RPC inexistente**: O código chama `supabase.rpc('increment_lote_counters')` mas essa função **não existe** no banco. O `.catch()` silencia o erro, então os contadores nunca são atualizados durante o processamento.

2. **Timeout + re-invocação falhando**: Cada chamada ao `processar-irpf` (que usa IA) leva dezenas de segundos. Com o limite de 55s, a função só consegue processar ~1 arquivo por execução. A re-invocação (`supabase.functions.invoke` de si mesma) aparentemente não está funcionando — não há logs da função sendo executada novamente.

3. **Contadores zerados**: O lote mostra `processados: 0` apesar de 1 arquivo ter sido processado com sucesso, porque o RPC falhou silenciosamente e a lógica de fallback não foi implementada.

---

## Plano de Correção

### 1. Sanitizar nomes de arquivos no upload (Frontend)
Em `src/pages/IRPFImportacoes.tsx`, criar função que substitui espaços e caracteres acentuados/especiais por equivalentes seguros antes de montar o `storagePath`:
```
"01 DECLARAÇÃO IRPF.pdf" → "01_DECLARACAO_IRPF.pdf"
```

### 2. Remover RPC inexistente e atualizar contadores diretamente (Edge Function)
Em `processar-irpf-lote/index.ts`:
- Remover a chamada ao `supabase.rpc('increment_lote_counters')`
- Atualizar os contadores do lote diretamente via `.update()` após **cada arquivo** processado (não apenas no final)

### 3. Corrigir re-invocação para continuar processamento
A re-invocação precisa usar a URL completa da função com `fetch()` e o service role key, porque `supabase.functions.invoke()` de dentro de uma Edge Function pode não funcionar corretamente. Usar `fetch` direto com o header `Authorization: Bearer <service_role_key>`.

### Arquivos alterados
- `src/pages/IRPFImportacoes.tsx` — sanitização de nomes de arquivo
- `supabase/functions/processar-irpf-lote/index.ts` — contadores diretos + re-invocação via fetch

