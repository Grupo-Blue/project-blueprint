

# Adicionar investimentos detalhados na API buscar-lead-api

## Problema

A Edge Function `buscar-lead-api` retorna apenas os campos agregados do lead (`tokeniza_valor_investido`, `tokeniza_qtd_investimentos`, etc.) porque faz um simples `select` na tabela `lead`. Ela nao busca os investimentos individuais nas tabelas `tokeniza_investimento` e `tokeniza_venda`, entao o campo `dados_tokeniza.investimentos[]` nunca aparece na resposta.

## Solucao

Reaproveitar a mesma logica ja implementada no webhook (`disparar-webhook-leads`) para enriquecer a resposta da API com o array de investimentos detalhados quando o lead for da Tokeniza.

## Detalhes tecnicos

### Arquivo alterado: `supabase/functions/buscar-lead-api/index.ts`

1. **Adicionar campos faltantes ao `selectFields`**: incluir `tokeniza_user_id`, `tokeniza_projetos`, `tokeniza_ultimo_investimento`, `tokeniza_carrinho_abandonado`, `tokeniza_valor_carrinho`, `id_empresa` (campos necessarios para a logica)

2. **Criar funcao `buscarMapaProjetos`**: query unica em `tokeniza_projeto` para mapear `project_id` para `nome` (mesma logica do webhook)

3. **Criar funcao `buscarInvestimentosDetalhados`**: buscar em `tokeniza_investimento` (filtro `FINISHED`/`PAID`/`was_paid=true`) e `tokeniza_venda` (`was_paid=true`), cruzar com mapa de nomes, ordenar por data

4. **Enriquecer a resposta**: apos encontrar o lead, se `id_empresa === TOKENIZA_ID` e `tokeniza_user_id` existir, buscar investimentos e adicionar ao objeto de resposta como `dados_tokeniza`:

```text
{
  found: true,
  lead: { ... campos do lead ... },
  dados_tokeniza: {
    valor_investido: 701573.97,
    qtd_investimentos: 264,
    investimentos: [
      {
        oferta_nome: "Mineradora de Bitcoin #1",
        oferta_id: "uuid",
        valor: 5000,
        data: "2025-06-15T...",
        status: "FINISHED",
        tipo: "crowdfunding"
      },
      ...
    ]
  }
}
```

5. **Para leads nao-Tokeniza**: o campo `dados_tokeniza` simplesmente nao aparece na resposta (sem impacto)

### Performance

- Apenas 1-2 queries extras por chamada (somente quando o lead e Tokeniza)
- A API ja retorna 1 lead por vez, entao o impacto e minimo
