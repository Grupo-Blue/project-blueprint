

## Diagnóstico

Todos os 10 erros são idênticos: o campo `origem_tipo` na tabela `lead` usa o enum `origem_lead`, que aceita apenas: `PAGO`, `ORGANICO`, `INDICACAO`, `LISTA`, `MANUAL`. O valor `IRPF_IMPORTACAO` não existe nesse enum.

Os erros acontecem apenas quando nenhum lead existente é encontrado (por email, telefone ou CPF), e o sistema tenta criar um novo lead com `origem_tipo: 'IRPF_IMPORTACAO'`.

A declaração IRPF é processada e salva corretamente -- o erro ocorre somente na etapa de criação automática do lead.

---

## Plano de Correção

### 1. Adicionar valor ao enum `origem_lead`
Criar uma migration SQL para adicionar `IRPF` ao enum:
```sql
ALTER TYPE origem_lead ADD VALUE 'IRPF';
```

### 2. Atualizar o código da Edge Function
Em `supabase/functions/processar-irpf/index.ts`, alterar a linha 821 de:
```
origem_tipo: 'IRPF_IMPORTACAO'
```
para:
```
origem_tipo: 'IRPF'
```

### 3. Redeployar a função `processar-irpf`

### Arquivos alterados
- Migration SQL (novo enum value)
- `supabase/functions/processar-irpf/index.ts` (linha 821)

Após a correção, as 10 declarações que deram erro podem ser reimportadas -- os dados fiscais já foram salvos, falta apenas a criação do lead.

