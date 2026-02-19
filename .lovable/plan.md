

# Enviar historico detalhado de investimentos Tokeniza para a Amelia CRM

## Problema atual

O webhook hoje envia apenas dados **agregados** da Tokeniza:
- `valor_investido` (total)
- `qtd_investimentos` (total)
- `projetos` (array de UUIDs, sem nomes)
- `carrinho_abandonado`

Falta o **detalhamento por oferta**: qual oferta o cliente investiu, quanto e quando.

## Solucao

Alterar a Edge Function `disparar-webhook-leads` para, quando o lead for da Tokeniza, buscar os investimentos individuais do cliente nas tabelas `tokeniza_investimento` e `tokeniza_venda`, cruzar com `tokeniza_projeto` para obter o nome da oferta, e enviar um array `investimentos` dentro de `dados_tokeniza`.

## Novo formato do payload `dados_tokeniza`

```text
dados_tokeniza: {
  // Dados agregados (continuam vindo como hoje)
  valor_investido: 15000,
  qtd_investimentos: 3,
  qtd_projetos: 2,
  ultimo_investimento_em: "2025-11-20T...",
  carrinho_abandonado: false,
  valor_carrinho: 0,

  // NOVO: detalhamento por investimento
  investimentos: [
    {
      oferta_nome: "Token Solar Fazenda MG",
      oferta_id: "uuid-do-projeto",
      valor: 5000,
      data: "2025-06-15T...",
      status: "FINISHED",
      tipo: "crowdfunding"
    },
    {
      oferta_nome: "Token Agro SP",
      oferta_id: "uuid-do-projeto-2",
      valor: 10000,
      data: "2025-11-20T...",
      status: "PAID",
      tipo: "crowdfunding"
    }
  ]
}
```

## Detalhes tecnicos

### Arquivo alterado: `supabase/functions/disparar-webhook-leads/index.ts`

1. **Atualizar a interface `SDRPayload`** para incluir o campo `investimentos` dentro de `dados_tokeniza`:
   - Cada item tera: `oferta_nome`, `oferta_id`, `valor`, `data`, `status`, `tipo` ("crowdfunding" ou "venda")

2. **Buscar investimentos detalhados** dentro do loop de leads Tokeniza:
   - Usar o `tokeniza_user_id` do lead para consultar `tokeniza_investimento` (crowdfunding) filtrado por status pago (`FINISHED`, `PAID`, ou `was_paid=true`)
   - Tambem consultar `tokeniza_venda` com `was_paid=true`
   - Buscar o mapa de nomes de projetos da tabela `tokeniza_projeto` (uma unica query antes do loop)

3. **Montar o array `investimentos`** combinando crowdfunding + vendas, ordenado por data

4. **Manter todos os dados agregados existentes** para nao quebrar nada na Amelia CRM -- os novos dados vem como campo adicional

### Performance

- Uma query extra por lead Tokeniza para buscar investimentos (filtrada por `user_id_tokeniza`)
- Uma query extra por lead Tokeniza para buscar vendas
- Uma unica query no inicio para o mapa de nomes de projetos (`tokeniza_projeto`)
- Como o webhook processa no maximo 50 leads por execucao, o impacto e minimo

