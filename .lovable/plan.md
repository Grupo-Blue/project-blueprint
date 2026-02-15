
# Corrigir Coleta de Keywords para a Blue

## Problema

A edge function `enriquecer-campanhas-metricool` processa todas as integrações sequencialmente (Tokeniza primeiro, Blue depois). Com 30 dias de lookback e muitas campanhas, ela dá timeout antes de chegar na Blue -- por isso zero keywords.

## Solução

Atualizar a edge function para aceitar o parâmetro `id_empresa` no body, permitindo executar a coleta para uma empresa específica. Isso resolve o timeout e permite chamadas direcionadas.

## Mudança Técnica

### Arquivo: `supabase/functions/enriquecer-campanhas-metricool/index.ts`

Na query de integrações (linha 76-80), adicionar filtro condicional:

```text
const body = await req.json().catch(() => ({}));
const filtroEmpresa = body.id_empresa || null;

// Query base
let query = supabase
  .from('integracao')
  .select('*')
  .eq('tipo', 'METRICOOL')
  .eq('ativo', true);

// Se receber id_empresa, filtrar apenas essa
if (filtroEmpresa) {
  query = query.eq('id_empresa', filtroEmpresa);
}
```

Isso mantém o comportamento atual (processar todas) quando chamado sem parâmetro, mas permite chamadas direcionadas como:

```text
POST /enriquecer-campanhas-metricool
{ "id_empresa": "95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db" }
```

### Arquivos modificados
- `supabase/functions/enriquecer-campanhas-metricool/index.ts` (adicionar filtro por empresa no body)

Após o deploy, a função será executada manualmente para a Blue para validar que keywords são retornadas pelo Metricool.
