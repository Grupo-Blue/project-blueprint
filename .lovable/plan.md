
# Buscar nomes de ofertas automaticamente da API Tokeniza

## Diagnóstico

Existe um endpoint `/api/v1/projects` na API da Tokeniza que retorna a lista de projetos com seus nomes. Ele já é chamado na função `validar-integracao` para checar as credenciais, mas **nunca foi aproveitado para popular a tabela `tokeniza_projeto` automaticamente**.

Hoje os nomes são cadastrados manualmente no painel de Integrações, o que gerou 61 projetos sem nome (47% dos IDs com investimentos pagos).

Para vendas automáticas (`tokeniza_venda`): o campo `items` chega vazio e `store_id = "TEMP"`. Isso é uma limitação da API — esses registros realmente não têm nome disponível.

## Solução

Adicionar uma etapa no início da função `sincronizar-tokeniza` que:

1. Chama `GET /api/v1/projects` para buscar todos os projetos com nome
2. Faz upsert na tabela `tokeniza_projeto` automaticamente
3. Usa esse mapa atualizado durante a sincronização de investimentos

Isso elimina a necessidade de cadastro manual e garante que todos os projetos tenham nome a partir da próxima sincronização.

## Endpoint a chamar

```
GET https://plataforma.tokeniza.com.br/api/v1/projects
Authorization: Bearer {TOKENIZA_API_TOKEN}
```

O response provavelmente contém algo como:
```json
[
  {
    "id": "ab0cb21a-1f89-11ef-8605-06aff79fa023",
    "title": "CRI Ápice Securitizadora",
    "name": "CRI Ápice...",
    ...
  }
]
```

Precisamos testar o response real para confirmar os campos de nome (`title`, `name`, `description`, etc.).

## O que muda em `sincronizar-tokeniza/index.ts`

Adicionar logo após a conexão com Supabase, antes de processar os dados:

```text
1. Chamar GET /api/v1/projects com o token
2. Para cada projeto retornado com id e nome:
   - Fazer upsert em tokeniza_projeto (project_id, nome)
3. Recarregar o projetoNomeMap com os dados atualizados
4. Continuar o fluxo normal
```

Também registrar nos logs e no `detalhes_execucao` quantos projetos foram descobertos automaticamente.

## Impacto

| Situação | Antes | Depois |
|---|---|---|
| Crowdfunding com nome | 69 de 130 (53%) | Potencialmente 130 de 130 (100%) |
| Vendas automáticas com nome | 0% | Continuará 0% (limitação da API) |
| Cadastro manual necessário | Sim | Não (automático na sincronização) |

## Arquivo alterado

- `supabase/functions/sincronizar-tokeniza/index.ts` — adição de ~30 linhas no início da função principal, antes do loop de processamento

## Nenhuma migração de banco necessária

A tabela `tokeniza_projeto` já existe e já tem o campo `project_id` e `nome`. O upsert usará `project_id` como chave de conflito.
