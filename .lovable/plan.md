

# Filtrar Contatos Anonimos do Mautic

## Problema
O webhook do Mautic cria leads mesmo quando o contato nao tem email nem telefone (contatos anonimos). Isso polui a base do SGT.

## Solucao
Manter a logica atual de criar/enriquecer leads, mas garantir que contatos sem email E sem telefone sejam ignorados. Na pratica, esse filtro ja existe no codigo atual (linhas 169-175), mas vamos reforcar a mensagem de log para deixar claro que foi um contato anonimo ignorado.

### Resumo da logica:
- **Tem email e/ou telefone** -> Cria lead novo OU atualiza lead existente (comportamento atual mantido)
- **Nao tem email NEM telefone** -> Ignora e retorna sucesso sem criar nada

A unica mudanca necessaria e melhorar o log e a resposta para diferenciar "contato anonimo ignorado" de outros cenarios, tornando o monitoramento mais claro.

## Detalhes tecnicos

No arquivo `supabase/functions/mautic-webhook/index.ts`, o bloco que ja faz essa checagem (linhas 169-175) sera ajustado para retornar `ignored: true` e uma mensagem mais descritiva:

```
if (!email && !telefone) {
  console.log('[Mautic Webhook] Contato anonimo ignorado (sem email/telefone)');
  return Response com { success: true, ignored: true, reason: 'contato_anonimo' }
}
```

Nenhuma mudanca de banco de dados. Apenas ajuste cosmético na edge function.

## Sobre o lead de teste

O lead criado durante os testes anteriores (ID `86ff3976-cc3c-4ae8-a03c-d887ccb078b2`) pode ser removido se desejado.

