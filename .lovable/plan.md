

# Integração SGT com Chatblue

## Contexto

O Chatblue é o sistema de atendimento próprio (fork personalizado), com backend Node.js/Express, PostgreSQL/Prisma, e APIs REST completas. A integração atual com "Chatwoot" no SGT já funciona via webhook -- o Chatblue pode enviar os mesmos eventos. A estratégia é **dupla**: webhook (Chatblue envia para o SGT em tempo real) + API polling (SGT consulta métricas do Chatblue periodicamente).

## O que será integrado

### Dados em tempo real (via Webhook - já funciona parcialmente)
- Leads que entram pelo WhatsApp sem passar por anúncios (orgânicos)
- Status de atendimento (aberto, em andamento, resolvido)
- Contagem de conversas e mensagens
- Agente atual do atendimento
- Inbox de origem

### Dados de métricas (novos - via API do Chatblue)
- **Tempo médio de primeira resposta** (responseTime do Ticket)
- **Tempo médio de resolução** (resolutionTime do Ticket)
- **SLA compliance** (% de tickets dentro do prazo)
- **Tickets por departamento** (Triagem, Comercial, Suporte)
- **Taxa de atendimento por IA** vs humano
- **NPS** (se disponível)
- **Tickets por período** (volume diário)

## Arquitetura da integração

```text
                    CHATBLUE                          SGT
              +-----------------+           +------------------+
              |  Ticket criado  |--webhook->| chatblue-webhook |
              |  Msg recebida   |--webhook->|  (edge function) |
              |  Status mudou   |--webhook->|    Upsert lead   |
              +-----------------+           +------------------+
              |                 |
              |  GET /metrics/* |<--poll----|  coletar-metricas |
              |  GET /tickets/* |<--poll----|  -chatblue        |
              |  GET /contacts  |<--poll----|  (edge function)  |
              +-----------------+           +------------------+
```

## Plano de implementação

### Parte 1: Renomear integração de CHATWOOT para CHATBLUE

Atualizar referências no código e na UI para refletir o novo nome. O tipo do enum `CHATWOOT` no banco será mantido por compatibilidade, mas a UI mostrará "Chatblue".

**Arquivos afetados:**
- `src/pages/Integracoes.tsx` - Label na UI
- `supabase/functions/chatwoot-webhook/index.ts` - Logs e referências

### Parte 2: Configurar webhook no Chatblue (ação do usuário)

No Chatblue, criar um webhook outgoing que envie eventos para:
```
POST https://<supabase-url>/functions/v1/chatblue-webhook
```

Eventos a configurar:
- `ticket.created` (nova conversa)
- `ticket.updated` (status mudou)
- `message.created` (nova mensagem)

Isso substitui o webhook do Chatwoot com o mesmo payload adaptado.

### Parte 3: Nova edge function `chatblue-webhook`

Criar nova edge function que recebe webhooks do Chatblue. A lógica é similar à `chatwoot-webhook` atual, mas adaptada ao formato de dados do Chatblue (modelo Prisma: Ticket, Contact, Message).

**Mapeamento de campos Chatblue para lead:**

| Campo Chatblue | Campo Lead SGT |
|---|---|
| `contact.phone` | `telefone` |
| `contact.name` | `nome_lead` |
| `contact.email` | `email` |
| `ticket.status` | `chatwoot_status_atendimento` |
| `ticket.responseTime` | `chatwoot_tempo_resposta_medio` |
| `ticket.assignedTo.name` | `chatwoot_agente_atual` |
| `connection.name` (inbox) | `chatwoot_inbox` |

### Parte 4: Nova edge function `coletar-metricas-chatblue`

Edge function que consulta a API REST do Chatblue periodicamente para trazer métricas agregadas:

- `GET /api/metrics/dashboard?period=7` - KPIs gerais
- `GET /api/metrics/sla` - Dados de SLA por departamento

**Dados coletados:**
- Tempo médio de resposta e resolução
- SLA compliance %
- Volume de tickets (total, pendentes, resolvidos)
- Taxa de atendimento por IA
- Tickets por departamento

Esses dados serão armazenados em uma nova tabela `metricas_atendimento`.

### Parte 5: Nova tabela `metricas_atendimento`

```sql
CREATE TABLE metricas_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID NOT NULL REFERENCES empresa(id_empresa),
  data DATE NOT NULL,
  tickets_total INT DEFAULT 0,
  tickets_pendentes INT DEFAULT 0,
  tickets_resolvidos INT DEFAULT 0,
  tickets_sla_violado INT DEFAULT 0,
  tickets_ia INT DEFAULT 0,
  tempo_resposta_medio_seg INT,
  tempo_resolucao_medio_seg INT,
  sla_compliance NUMERIC(5,2),
  nps_score INT,
  dados_departamentos JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, data)
);
```

### Parte 6: Novas colunas no lead (chatblue-specific)

Adicionar colunas para dados mais ricos do Chatblue:

```sql
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_ticket_id TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_protocolo TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_departamento TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_prioridade TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_sla_violado BOOLEAN DEFAULT false;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_tempo_resolucao_seg INT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS chatblue_atendido_por_ia BOOLEAN DEFAULT false;
```

### Parte 7: Atualizar config_json para tipo CHATBLUE

O `config_json` para integração Chatblue terá:

```json
{
  "api_url": "https://chatblue.suaempresa.com/api",
  "api_token": "jwt-token-ou-api-key",
  "webhook_secret": "secret-para-validar-webhooks",
  "empresas": [
    {
      "id_empresa": "uuid-sgt",
      "company_id": "cuid-chatblue",
      "inboxes": ["WhatsApp BlueConsult", "WhatsApp Tokeniza"]
    }
  ]
}
```

### Parte 8: O que alterar no Chatblue (sua parte)

1. **Criar rota de webhook outgoing** - No Chatblue, adicionar um sistema de webhooks de saída que dispare para URLs externas quando tickets/mensagens são criados/atualizados. Pode ser implementado como um serviço que escuta eventos do Prisma (middleware) ou via Bull job.

2. **Criar rota pública de API para métricas** - Expor uma rota como `GET /api/external/metrics` autenticada por API key (header `X-API-Key`) que retorne os mesmos dados do `GET /api/metrics/dashboard` sem precisar do JWT de sessão do Chatblue.

3. **Formato do payload do webhook:**

```json
{
  "event": "ticket.created",
  "company": { "id": "cuid", "name": "BlueConsult" },
  "ticket": {
    "id": "cuid",
    "protocol": "BC-00123",
    "status": "PENDING",
    "priority": "MEDIUM",
    "responseTime": null,
    "resolutionTime": null,
    "slaBreached": false,
    "isAIHandled": false,
    "departmentName": "Comercial"
  },
  "contact": {
    "phone": "+5561986263349",
    "name": "João Silva",
    "email": "joao@email.com",
    "isClient": false
  },
  "connection": {
    "name": "WhatsApp BlueConsult",
    "type": "BAILEYS"
  },
  "message": {
    "content": "Olá, gostaria de informações",
    "type": "TEXT",
    "isFromMe": false
  }
}
```

### Parte 9: Validação da integração

Adicionar case `CHATBLUE` (reutilizando o tipo `CHATWOOT` do enum) na edge function `validar-integracao` para testar a conectividade com a API do Chatblue via `GET /api/external/health`.

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/chatblue-webhook/index.ts` | Criar (nova edge function) |
| `supabase/functions/coletar-metricas-chatblue/index.ts` | Criar (nova edge function) |
| `supabase/functions/validar-integracao/index.ts` | Alterar (adicionar case CHATBLUE) |
| `src/pages/Integracoes.tsx` | Alterar (UI para config Chatblue) |
| `src/components/AlertaIntegracao.tsx` | Alterar (renomear referências) |
| Migração SQL | Criar tabela `metricas_atendimento` + colunas no `lead` |

## Dependências no Chatblue (sua responsabilidade)

1. Criar sistema de webhook outgoing (disparar POST para URL configurável)
2. Criar rota `GET /api/external/metrics` com auth por API key
3. Criar rota `GET /api/external/health` para validação
4. Definir o payload do webhook conforme especificação acima

