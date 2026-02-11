

# Webhook Mautic para SGT (Tempo Real)

## Objetivo

Criar uma edge function `mautic-webhook` que receba eventos do Mautic em tempo real (mudanca de score, tags, page hits) e atualize o lead no SGT automaticamente -- incluindo a logica de MQL e alerta para SDR.

## Fluxo completo

```text
Lead chega no Mautic (formulario, LP, WhatsApp)
  |
  v
Mautic envia webhook para SGT (score, tags, page hits)
  |
  v
mautic-webhook (edge function)
  |-- Lead existe no SGT? (busca por email/telefone)
  |     |-- SIM: Atualiza score, tags, page_hits, UTMs
  |     |-- NAO: Cria lead basico (origem MAUTIC, organico)
  |
  v
Logica de MQL automatica:
  |-- score >= 50 OU page_hits >= 10? --> is_mql = true, data_mql = now()
  |-- Tag contem "levantou_mao" ou "clicou_whatsapp"? --> levantou_mao = true
  |
  v
Dispara webhook SDR (se houve mudanca relevante)
  |-- Eventos: MQL, SCORE_ATUALIZADO, LEAD_NOVO
  |
  v
Lead aquece no Mautic...
  |
  v
Score >= 50 --> SGT ja marcou MQL
Clicou WhatsApp --> SGT marca levantou_mao, alerta SDR
SDR cria deal Pipedrive --> Pipedrive webhook --> SGT
SGT busca Mautic (enriquecer-lead-mautic) --> Dados completos
```

## Implementacao

### 1. Nova edge function: `mautic-webhook`

Recebe webhooks do Mautic (configurados via "Webhooks" no painel do Mautic). O Mautic envia eventos como:

- `mautic.lead_post_save_update` (contato atualizado - score, tags mudaram)
- `mautic.lead_post_save_new` (contato criado)
- `mautic.page_on_hit` (visita a pagina)
- `mautic.lead_points_change` (score mudou)

**Logica principal:**
1. Validar webhook secret (header `X-Webhook-Secret`)
2. Extrair email/telefone do payload Mautic
3. Buscar lead no SGT por email ou telefone
4. Se nao existe: criar lead basico com `origem_tipo = 'ORGANICO'`, `origem_canal = 'MAUTIC'`
5. Atualizar campos Mautic no lead: `mautic_score`, `mautic_page_hits`, `mautic_tags`, `mautic_last_active`, `id_mautic_contact`
6. Aplicar regras de MQL:
   - `score >= 50 OR page_hits >= 10` --> `is_mql = true`, `data_mql = now()`
   - Tag contem palavras-chave (configuravel) --> `levantou_mao = true`
7. Disparar webhook SDR se houve transicao (nao era MQL e agora e)
8. Registrar evento no `lead_evento`

### 2. Configuracao no Mautic (sua parte)

No painel do Mautic:
1. Ir em **Configuracoes > Webhooks**
2. Criar webhook com URL: `https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/mautic-webhook`
3. Adicionar header customizado: `X-Webhook-Secret: [seu-secret]`
4. Selecionar eventos:
   - Contact Updated
   - Contact Points Changed
   - Contact Created (opcional)
5. Salvar

### 3. Atualizacao do `config.toml`

Adicionar a nova funcao com `verify_jwt = false` (webhook externo, validacao por secret).

### 4. Secret necessario

Adicionar `MAUTIC_WEBHOOK_SECRET` nos secrets do projeto para validar autenticidade dos webhooks recebidos.

### 5. Integracao com webhooks SDR existentes

Quando o webhook Mautic detectar uma transicao relevante (lead virou MQL, ou levantou mao), a edge function invocara `disparar-webhook-leads` passando o `lead_id` e o evento especifico, garantindo que o SDR IA seja notificado em tempo real.

## Detalhes tecnicos

### Formato do payload do Mautic (webhook nativo)

O Mautic envia payloads no formato:

```json
{
  "mautic.lead_post_save_update": [
    {
      "contact": {
        "id": 123,
        "points": 55,
        "fields": {
          "core": {
            "email": { "value": "joao@email.com" },
            "phone": { "value": "+5561986263349" },
            "firstname": { "value": "Joao" },
            "lastname": { "value": "Silva" },
            "city": { "value": "Brasilia" },
            "state": { "value": "DF" }
          }
        },
        "tags": [
          { "tag": "investidor" },
          { "tag": "clicou-whatsapp" }
        ],
        "utmtags": [
          { "utmSource": "google", "utmMedium": "cpc", "utmCampaign": "irpf-2025" }
        ]
      },
      "timestamp": "2026-02-11T10:30:00-03:00"
    }
  ]
}
```

### Mapeamento de campos

| Mautic Webhook | Campo Lead SGT |
|---|---|
| `contact.id` | `id_mautic_contact` |
| `contact.points` | `mautic_score` |
| `contact.fields.core.email.value` | `email` |
| `contact.fields.core.phone.value` | `telefone` |
| `contact.fields.core.firstname/lastname` | `nome_lead` |
| `contact.fields.core.city.value` | `cidade_mautic` |
| `contact.fields.core.state.value` | `estado_mautic` |
| `contact.tags[].tag` | `mautic_tags` |
| `contact.utmtags[0]` | `utm_source_mautic`, etc. |

### Tags que disparam acoes

Tags configuradas para disparar `levantou_mao = true`:
- `clicou-whatsapp`
- `levantou-mao`
- `pediu-contato`
- `agendou-reuniao`

Essas tags serao verificadas case-insensitive.

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `supabase/functions/mautic-webhook/index.ts` | Criar |
| `supabase/config.toml` | Adicionar funcao com verify_jwt = false |

## Beneficio vs. sistema atual

| Aspecto | Antes (polling) | Depois (webhook) |
|---|---|
| Latencia | 10 min (cronjob) | Segundos |
| Custo | Consulta API por lead | Apenas quando muda |
| MQL detection | Proximo ciclo do cron | Imediato |
| Alerta SDR | Atrasado | Tempo real |
| Criacao de lead | Apenas via Pipedrive/Chatblue | Tambem via Mautic |

