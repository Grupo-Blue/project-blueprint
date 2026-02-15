

# Agente de Tarefas Agendadas no Chat IA

## Visao Geral

Adicionar ao assistente IA (que ja usa `GEMINI_API_KEY` com a API Gemini direta) a capacidade de agendar tarefas futuras. As notificacoes de resultado serao enviadas via Brevo (`BREVO_API_KEY`), o mesmo provedor de email ja configurado no sistema.

## Componentes

### 1. Nova tabela: `tarefa_agendada_ia`

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador |
| user_id | uuid | Usuario que pediu |
| id_empresa | uuid (nullable) | Empresa do contexto |
| id_conversa | uuid (nullable) | Conversa de origem |
| instrucao | text | O que a IA deve analisar |
| data_execucao | timestamptz | Quando executar |
| status | text | pendente, executando, concluida, erro |
| resultado | text (nullable) | Resposta da IA |
| enviar_email | boolean (default true) | Se deve enviar por email |
| email_destino | text (nullable) | Email de destino (se null, usa email do usuario) |
| created_at / executed_at | timestamptz | Timestamps |

RLS: usuarios so veem suas proprias tarefas.

### 2. Duas novas tools no `chat-ia-assistente/index.ts`

Ambas adicionadas ao array de `toolDeclarations` e ao `executeTool`:

- **agendar_tarefa_ia**: Recebe instrucao, dias (ou data), enviar_email e email_destino. Calcula `data_execucao = now() + dias`. Insere na tabela. Segue a regra de pedir confirmacao antes.
- **listar_tarefas_agendadas**: Lista tarefas do usuario com filtro por status (pendente/concluida).

O system prompt sera atualizado para incluir essas capacidades e instruir a IA a pedir confirmacao antes de agendar.

### 3. Nova edge function: `executar-tarefas-agendadas/index.ts`

Logica:
1. Busca tarefas com `status = 'pendente'` e `data_execucao <= now()`
2. Para cada tarefa:
   - Chama a API Gemini diretamente (usando `GEMINI_API_KEY`) com a instrucao + contexto da empresa
   - Reutiliza as mesmas tools de leitura do chat para que a IA tenha acesso aos dados reais
   - Salva resultado na coluna `resultado`, atualiza status
3. Se `enviar_email = true`:
   - Envia resultado formatado via **Brevo** (`BREVO_API_KEY`), seguindo o mesmo padrao de `alertar-integracoes-email`
   - Sender: `SGT Alertas <noreply@grupoblue.com.br>`
4. Registra execucao na tabela `cronjob_execucao`

### 4. Cronjob via pg_cron

Agendar `executar-tarefas-agendadas` para rodar a cada hora:

```text
cron.schedule('executar-tarefas-agendadas-hourly', '0 * * * *', ...)
```

Usa `net.http_post` no mesmo padrao dos outros cronjobs do sistema.

### 5. Atualizar config.toml

Adicionar a nova funcao `executar-tarefas-agendadas` com `verify_jwt = false` (sera chamada pelo pg_cron).

## Fluxo de uso

```text
Usuario: "Daqui 4 dias analise se o gestor fez as tarefas"
    |
    v
IA: "Vou agendar para 19/02/2026. Posso registrar?"
    |
    v
Usuario: "Sim"
    |
    v
IA chama tool agendar_tarefa_ia
    |  (insere na tarefa_agendada_ia)
    v
pg_cron (a cada hora) -> executar-tarefas-agendadas
    |  (encontra tarefa com data <= now)
    |  (chama Gemini com instrucao + tools de leitura)
    v
Resultado salvo + Email enviado via Brevo
```

## Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL (tabela + RLS + pg_cron) | Criar |
| `supabase/functions/chat-ia-assistente/index.ts` | Editar (2 tools + prompt) |
| `supabase/functions/executar-tarefas-agendadas/index.ts` | Criar |
| `supabase/config.toml` | Atualizar automaticamente |

## Secrets utilizados (ja existentes)

- `GEMINI_API_KEY` - para chamadas a IA
- `BREVO_API_KEY` - para envio de emails
- `ALERT_EMAIL_TO` - email padrao de fallback

Nenhum novo secret necessario.
