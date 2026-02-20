
# Criar endpoint `listar-clientes-api`

## Contexto e diagnóstico

O time da Amélia precisa varrer ~755 clientes Blue e ~2.351 investidores Tokeniza. Hoje o único jeito é chamar `buscar-lead-api` 1 vez por contato, totalizando ~3.100 chamadas individuais (~40 min de sync). Um endpoint de listagem paginada resolve isso em menos de 2 minutos.

### O que já existe na base

| Dado | Campo na tabela `lead` | Status |
|---|---|---|
| Email, telefone, nome | `email`, `telefone`, `nome_lead` | Existe |
| Venda realizada | `venda_realizada` (boolean) | Existe |
| Valor da venda | `valor_venda` (numeric) | Existe |
| Data da venda | `data_venda` (timestamp) | Existe |
| Stage atual | `stage_atual` (text) | Existe |
| Status cliente | `cliente_status` (varchar) | Existe |
| Investidor Tokeniza | `tokeniza_investidor` (boolean) | Existe |
| Valor investido | `tokeniza_valor_investido` (numeric) | Existe |
| Qtd investimentos | `tokeniza_qtd_investimentos` (integer) | Existe |

**Campos ausentes**: `plano_ativo` e `plano_atual` não existem no banco. Para Blue, `cliente_status = 'cliente'` + join com `cliente_notion.status_cliente = 'cliente'` equivale ao conceito de "plano ativo". Vamos expor isso claramente no response como `plano_ativo: boolean`.

## Novo arquivo: `supabase/functions/listar-clientes-api/index.ts`

### Autenticação
Mesma política do `buscar-lead-api`: cabeçalho `x-api-key` validado contra `SGT_WEBHOOK_SECRET`.

### Request

```
POST /listar-clientes-api
Headers: x-api-key: <SGT_WEBHOOK_SECRET>

Body:
{
  "empresa": "BLUE" | "TOKENIZA",   // obrigatório
  "apenas_clientes": true,          // opcional, default true
  "limit": 100,                     // opcional, default 100, max 500
  "offset": 0                       // opcional, default 0
}
```

### Lógica de filtro por empresa

**BLUE** (`id_empresa = '95e7adaf-...'`):
- `apenas_clientes: true` → `cliente_status = 'cliente' OR venda_realizada = true`
- `apenas_clientes: false` → sem filtro de status (retorna todos os leads Blue)
- Campos retornados incluem dados do `cliente_notion` via LEFT JOIN (nome do plano/produto quando disponível)
- `plano_ativo` = `cliente_status = 'cliente'`

**TOKENIZA** (`id_empresa = '61b5ffeb-...'`):
- `apenas_clientes: true` → `tokeniza_investidor = true`
- Inclui `dados_tokeniza` aninhado no response com `valor_investido`, `qtd_investimentos`, `projetos`
- **Não** carrega investimentos detalhados por oferta por padrão (custo alto em batch). Um parâmetro opcional `incluir_investimentos: true` pode ser passado para buscar linha a linha quando necessário.

### Response

```json
{
  "total": 755,
  "empresa": "BLUE",
  "limit": 100,
  "offset": 0,
  "clientes": [
    {
      "lead_id": "uuid",
      "nome": "João Silva",
      "email": "joao@email.com",
      "telefone": "+5511999999999",
      "plano_ativo": true,
      "stage_atual": "Vendido",
      "cliente_status": "cliente",
      "venda_realizada": true,
      "valor_venda": 3100,
      "data_venda": "2025-12-16T13:31:19Z",
      "organizacao": null,
      "dados_tokeniza": null
    }
  ]
}
```

Para Tokeniza:
```json
{
  "clientes": [
    {
      "lead_id": "uuid",
      "nome": "...",
      "email": "...",
      "plano_ativo": true,
      "dados_tokeniza": {
        "valor_investido": 18029.84,
        "qtd_investimentos": 23,
        "projetos": ["uuid1", "uuid2"],
        "ultimo_investimento_em": "2024-04-06T14:46:38Z",
        "carrinho_abandonado": false,
        "valor_carrinho": 0
      }
    }
  ]
}
```

### Query SQL de base

Para Blue:
```sql
SELECT 
  l.id_lead, l.nome_lead, l.email, l.telefone, l.organizacao,
  l.cliente_status, l.venda_realizada, l.valor_venda, l.data_venda, l.stage_atual,
  cn.status_cliente as notion_status_cliente,
  cn.produtos_contratados as notion_produtos
FROM lead l
LEFT JOIN cliente_notion cn ON cn.id_cliente = l.id_cliente_notion
WHERE l.id_empresa = 'BLUE_ID'
  AND (l.merged IS NULL OR l.merged = false)
  AND (l.cliente_status = 'cliente' OR l.venda_realizada = true)
ORDER BY l.data_venda DESC NULLS LAST, l.data_criacao DESC
LIMIT 100 OFFSET 0
```

Para Tokeniza:
```sql
SELECT id_lead, nome_lead, email, telefone,
  tokeniza_investidor, tokeniza_valor_investido, tokeniza_qtd_investimentos,
  tokeniza_projetos, tokeniza_ultimo_investimento,
  tokeniza_carrinho_abandonado, tokeniza_valor_carrinho,
  cliente_status, venda_realizada, valor_venda, data_venda, stage_atual
FROM lead
WHERE id_empresa = 'TOKENIZA_ID'
  AND tokeniza_investidor = true
  AND (merged IS NULL OR merged = false)
ORDER BY tokeniza_valor_investido DESC
LIMIT 100 OFFSET 0
```

## Arquivo criado

- `supabase/functions/listar-clientes-api/index.ts` (novo, ~200 linhas)

## Não há alterações de schema

Nenhuma migração SQL necessária — todos os campos necessários já existem na tabela `lead` e `cliente_notion`.

## Volumes reais confirmados (via banco)

| Empresa | Clientes (apenas_clientes=true) |
|---|---|
| Blue | 465 (venda_realizada) / 425 (cliente_status=cliente) |
| Tokeniza | 2.351 (tokeniza_investidor=true) |

Com `limit: 500`, são ~5 chamadas para Blue e ~5 para Tokeniza = 10 requests totais ao invés de ~3.100.
