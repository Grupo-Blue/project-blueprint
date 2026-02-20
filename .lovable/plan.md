

# Sincronizar TODOS os clientes do Notion Blue para o SGT

## Situacao atual

- O Notion da Blue possui centenas de clientes no database "Info Clientes - Clientes Blue Consult"
- A tabela `cliente_notion` no SGT tem apenas **141 registros** (limitada pela falta de paginacao na Edge Function)
- Apenas **69 leads** estao vinculados a um `id_cliente_notion`
- A tabela `cliente_notion` nao possui colunas para campos extras do Notion (cidade, CEP, endereco, perfil, motivo de cancelamento, etc.)

## Plano

### Parte 1: Adicionar colunas na tabela `cliente_notion`

Migracao SQL para adicionar os campos que existem no Notion mas nao estao sendo capturados:

- `cidade` (varchar)
- `cep` (varchar)
- `endereco` (text)
- `perfil_cliente` (varchar) - ex: "Baixa complexidade", "Colaborativo", "Complexo"
- `motivo_cancelamento` (varchar) - ex: "Concorrente", "Insatisfacao"
- `data_cancelamento` (date)
- `tag` (varchar)
- `url_google_drive` (text)
- `vencimento_procuracao` (date)
- `apuracao_b3` (varchar) - "Sim"/"Nao"
- `telefone_secundario` (varchar)

### Parte 2: Atualizar a Edge Function `sincronizar-notion`

Corrigir os dois problemas principais:

1. **Paginacao**: Implementar loop com `next_cursor` para buscar TODOS os registros (nao apenas os primeiros 100)
2. **Campos extras**: Extrair e salvar os novos campos do Notion (cidade, CEP, endereco, perfil, motivo de cancelamento, etc.)
3. **Nome do campo corrigido**: O Notion usa `"Cliente inativo?"` (com i minusculo), e o codigo atual busca `"Cliente Inativo?"` (com I maiusculo) -- corrigir para o nome real

### Parte 3: Enriquecer leads com dados dos clientes Notion

Apos sincronizar todos os clientes, o match por email ja existente vinculara os leads encontrados. Adicionalmente:

- Atualizar `cliente_status` nos leads para `"cliente"` ou `"ex_cliente"`
- Vincular `id_cliente_notion` para referencia cruzada
- Match tambem por telefone (alem de email) para capturar mais vinculos

### Parte 4: Executar a sincronizacao

Apos deploy, chamar a funcao para importar todos os registros do Notion de uma vez.

## Detalhes tecnicos

### Migracao SQL

```text
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS cidade varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS cep varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS perfil_cliente varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS motivo_cancelamento varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS data_cancelamento date;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS tag varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS url_google_drive text;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS vencimento_procuracao date;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS apuracao_b3 varchar;
ALTER TABLE cliente_notion ADD COLUMN IF NOT EXISTS telefone_secundario varchar;
```

### Edge Function `sincronizar-notion/index.ts`

Alteracoes principais:

1. **Loop de paginacao**:
```text
let hasMore = true;
let startCursor = undefined;
while (hasMore) {
  const response = await fetch(notionDbQuery, {
    body: { page_size: 100, start_cursor: startCursor }
  });
  // processar resultados
  hasMore = response.has_more;
  startCursor = response.next_cursor;
}
```

2. **Extracao de campos adicionais**: Cidade, CEP, Endereco, Perfil do cliente, Motivo de cancelamento, Data de Cancelamento, Tag, URL Google Drive, Vencimento Procuracao, Apuracao B3, Telefone 1 (secundario)

3. **Match por telefone**: Alem do match por email, tambem buscar leads pelo numero de telefone normalizado (com +55)

### Arquivo alterado

- `supabase/functions/sincronizar-notion/index.ts`

### Performance

- A paginacao garante que todos os registros serao importados, independente da quantidade
- O upsert por `id_notion` evita duplicatas
- Match por email + telefone maximiza a vinculacao com leads existentes
