

## Plano de Correção — Importação IRPF (Revisado)

### O que muda vs plano anterior
- **Modelo mantido**: `gemini-2.5-pro` continua como modelo principal (sem alteração)
- **Timeout aumentado**: `MAX_EXECUTION_MS` de 50s para **550s** (safety margin para 600s)

### Correções

#### 1. Aumentar timeout do lote (`processar-irpf-lote`)
- `MAX_EXECUTION_MS` de `50000` para `550000` (550s, margem para o limite de 600s)
- Adicionar `AbortSignal.timeout(300000)` no fetch para `processar-irpf` (5 min por arquivo)

#### 2. Retry com IA rápida para normalizar JSON (`processar-irpf`)
- No `catch` do parsing JSON, enviar o conteúdo para `gemini-2.5-flash-lite` para normalizar/reparar o JSON
- Se funcionar, usar o resultado; se falhar, aí sim lançar o erro

#### 3. Capturar erro real no lote (`processar-irpf-lote`)
- Verificar `response.ok` antes de parsear JSON
- Gravar mensagem de erro real (incluindo 504) em `erro_mensagem`

### Arquivos alterados
- `supabase/functions/processar-irpf/index.ts` — retry com IA rápida para JSON
- `supabase/functions/processar-irpf-lote/index.ts` — timeout 550s + AbortSignal + captura de erro

