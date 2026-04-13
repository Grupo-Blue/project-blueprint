

## Plano de Correção — Importação IRPF

### Problema
12 arquivos falharam com "Falha ao interpretar resposta da IA como JSON". A IA retorna JSON truncado ou com texto extra, e o erro gravado no lote é genérico.

### Correções

#### 1. Aumentar max_tokens (`processar-irpf`)
- Alterar `max_tokens` de **16000 para 32000** na chamada à API Gemini (linha 301)

#### 2. Retry com IA rápida para normalizar JSON (`processar-irpf`)
No bloco `catch` do parsing JSON (linhas 338-342), ao invés de falhar direto:
- Enviar o `content` recebido para **gemini-2.5-flash-lite** com um prompt simples: "O texto abaixo contém um JSON de declaração IRPF com possível texto extra antes/depois ou truncamento. Extraia e retorne APENAS o JSON válido, sem nenhum texto adicional."
- Usar `max_tokens: 32000` e sem imagem (só texto), tornando a chamada muito rápida
- Se o retorno da segunda IA for JSON válido, usar normalmente
- Se falhar novamente, aí sim lançar o erro

#### 3. Capturar erro real no lote (`processar-irpf-lote`)
- Substituir `supabase.functions.invoke()` (linha 126) por `fetch()` direto com URL completa e service role key
- Ler o body da resposta para capturar a mensagem de erro real e gravar em `erro_mensagem`

### Arquivos alterados
- `supabase/functions/processar-irpf/index.ts` — max_tokens 32000 + retry com IA rápida
- `supabase/functions/processar-irpf-lote/index.ts` — fetch direto + captura de erro real

