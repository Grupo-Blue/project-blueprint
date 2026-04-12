

## Diagnóstico do Erro

Dois problemas foram identificados nos logs:

### Bug 1: Coluna `origem` não existe na tabela `lead`
O código tenta inserir `origem: 'IRPF'` ao criar um lead automaticamente (linha 808), mas a tabela `lead` não possui essa coluna -- só possui `origem_tipo`. Isso causa o erro `PGRST204: Could not find the 'origem' column`.

### Bug 2: IA retorna JSON com markdown (parcialmente tratado)
A IA às vezes retorna o JSON envolvido em ` ```json ``` `. O regex de limpeza já existe (linha 322), mas o erro indica que falhou neste caso específico -- provavelmente porque a resposta tem formatação ligeiramente diferente do esperado.

---

## Plano de Correção

### 1. Remover campo `origem` do insert de lead
Na função `processar-irpf/index.ts`, remover a linha `origem: 'IRPF'` do objeto `novoLead` (linha 808), mantendo apenas `origem_tipo: 'IRPF_IMPORTACAO'` que é a coluna válida.

### 2. Melhorar o parsing de JSON da IA
Tornar o regex de extração de JSON mais robusto para lidar com variações de formatação:
- Tentar primeiro o regex existente
- Se falhar, tentar encontrar o primeiro `{` e último `}` no conteúdo
- Adicionar trim mais agressivo antes do parse

### Arquivos alterados
- `supabase/functions/processar-irpf/index.ts` (duas correções)

