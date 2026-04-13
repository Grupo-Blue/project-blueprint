<final-text>
## Plano de correção definitiva — Importação IRPF

### Diagnóstico
- O lote mais recente (`493cd4f5-7c50-4d28-944a-5091a9f1739f`) ficou em:
  - `1 erro`
  - `1 sucesso`
  - `1 arquivo preso em processando`
  - `15 pendentes`
- Os registros de execução mostram que o `processar-irpf` continuou funcionando e chegou a concluir outro arquivo com sucesso depois de mais de 2 minutos.
- Isso indica que o problema principal não é mais a IA da Isa: o gargalo está no **orquestrador do lote**, que para no meio do caminho e deixa a fila inconsistente.
- Também existe um problema estrutural no banco:
  - a tabela de lote só aceita `pendente | processando | concluido`
  - mas o código tenta usar `erro`
  - e a UI já trata `cancelado`
- Resultado: quando algo quebra, o lote pode ficar “preso” em `processando` para sempre.

### O que vou corrigir
#### 1. Refatorar o `processar-irpf-lote` para ser retomável
- Parar de tentar processar o lote inteiro em uma única execução longa.
- Mudar para um fluxo **1 arquivo por execução** (ou lote muito pequeno), com auto-continuação:
  1. buscar/claim do próximo arquivo
  2. processar
  3. atualizar status e contadores
  4. disparar a próxima execução se ainda houver pendentes
- Assim o sistema não depende de uma execução única sobreviver por muitos minutos.

#### 2. Tornar a fila resiliente a travamentos
- Adicionar controle de execução na fila, com campos de apoio como:
  - `tentativas`
  - `processing_started_at`
  - `heartbeat_at` ou equivalente
- Criar recuperação automática para arquivos presos em `processando`:
  - se ficar travado por tempo demais, o item volta para `pendente` ou vai para `erro` com mensagem clara
  - limitar tentativas para não entrar em loop infinito

#### 3. Corrigir o modelo de status no banco
- Ajustar a constraint/status do lote para refletir o que o sistema realmente usa:
  - `pendente`
  - `processando`
  - `concluido`
  - `erro`
  - `cancelado`
- Alinhar backend e frontend para trabalhar com os mesmos estados.

#### 4. Recalcular contadores do lote do jeito certo
- Parar de incrementar `processados` e `erros` “no braço”.
- Recalcular os totais a partir da própria `irpf_importacao_fila` após cada etapa importante.
- Isso evita lote com números errados quando houver retomada, cancelamento ou recuperação de item travado.

#### 5. Ajustar cancelamento e retomada
- Fazer o cancelamento marcar o lote como `cancelado` de verdade.
- Garantir que o worker pare antes de pegar o próximo arquivo.
- Adicionar retomada segura para lote travado, sem duplicar processamento.

#### 6. Melhorar o frontend para refletir a realidade
- Em vez de “fire-and-forget” silencioso, aguardar a confirmação inicial do disparo do lote.
- Atualizar também a fila de arquivos quando o lote estiver aberto, não só o resumo do lote.
- Exibir com clareza:
  - processando
  - travado/retomando
  - cancelado
  - erro real do arquivo

#### 7. Corrigir o lote atual
- Depois do ajuste, aplicar uma correção pontual no lote que travou:
  - liberar o item preso em `processando`
  - recalcular os contadores
  - retomar os 15 pendentes restantes

### Arquivos envolvidos
- `supabase/functions/processar-irpf-lote/index.ts`
- `src/pages/IRPFImportacoes.tsx`
- `supabase/migrations/*` (nova migration para status/controle de fila)

### Detalhes técnicos
- O modelo principal da Isa será mantido em `google/gemini-2.5-pro`.
- Os tempos recentes de sucesso do `processar-irpf` ficaram na faixa de ~120s a ~145s, então o problema não exige troca de modelo.
- O foco será remover o ponto único de falha do lote e tornar a importação **retomável, idempotente e auto-recuperável**.
- Não vejo necessidade de alterar autenticação; o ajuste é de orquestração, estado e consistência de backend.
</final-text>