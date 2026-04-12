## Importação IRPF em Segundo Plano

### Problema Atual

Os PDFs são processados um a um no frontend. O usuário precisa manter a tela aberta durante todo o processamento.

### Solução

Dividir em duas etapas: **upload rápido** para o Storage e **processamento assíncrono** em background via Edge Function.

### Arquitetura

```text
1. Usuário seleciona PDFs
2. Frontend faz upload de todos para Storage (bucket irpf-uploads)
3. Frontend cria registros na tabela irpf_importacao_fila (status: pendente)
4. Frontend cria um registro "lote" na tabela irpf_importacao_lote
5. Após todos os uploads, chama Edge Function processar-irpf-lote (fire-and-forget)
6. Edge Function processa cada arquivo da fila sequencialmente
7. Usuário pode sair e voltar — consulta o lote para ver resultado
```

### Mudanças no Banco de Dados

**Tabela `irpf_importacao_lote**` — agrupa um lote de importação:

- `id`, `id_empresa`, `total_arquivos`, `processados`, `erros`, `status` (pendente/processando/concluido), `created_at`, `updated_at`, `created_by`

**Tabela `irpf_importacao_fila**` — cada arquivo individual:

- `id`, `id_lote`, `nome_arquivo`, `storage_path`, `status` (pendente/processando/sucesso/erro), `resultado`, `erro_mensagem`, `created_at`, `updated_at`

**Storage bucket** `irpf-uploads` (privado) com RLS para usuários autenticados.

### Nova Edge Function: `processar-irpf-lote`

- Recebe `id_lote`
- Busca arquivos pendentes da fila
- Para cada: baixa do Storage, converte para base64, chama `processar-irpf` internamente
- Atualiza status de cada item e contadores do lote
- Ao final, marca lote como concluído
- O arquivo PDF após processado pode ser jogado fora, não precisa armazenar.

### Mudanças no Frontend (`IRPFImportacoes.tsx`)

1. **Upload**: Ao selecionar arquivos, faz upload para Storage e cria registros na fila. Mostra progresso de upload (rápido).
2. **Processamento**: Após uploads, chama `processar-irpf-lote` sem esperar resposta.
3. **Histórico de Lotes**: Nova seção mostrando lotes recentes com status, contagem de sucesso/erro, e lista dos arquivos com erro expandível.
4. **Polling**: Enquanto um lote estiver "processando", faz polling a cada 5s para atualizar status.

### Arquivos Alterados

- **Migration SQL**: criar tabelas, bucket e RLS
- `**supabase/functions/processar-irpf-lote/index.ts**`: nova Edge Function
- `**src/pages/IRPFImportacoes.tsx**`: refatorar upload e adicionar seção de histórico de lotes