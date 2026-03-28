

# Webhook Amélia → SGT: Enriquecimento com ICP, Persona, DISC, Health Score

## Contexto

Hoje o fluxo é unidirecional: SGT envia leads para Amélia via `disparar-webhook-leads`. A Amélia classifica (ICP, persona, temperatura, DISC) e gerencia CS (health score), mas esses dados ficam presos lá. O objetivo é criar o caminho de volta: quando a Amélia classificar ou atualizar um lead, ela empurra os dados para o SGT via webhook.

## O que será construído

### 1. Edge Function `amelia-webhook` (SGT)

Receptor no SGT que aceita POSTs da Amélia com dados de enriquecimento:

```text
POST /functions/v1/amelia-webhook
Header: x-webhook-secret: <SGT_WEBHOOK_SECRET>

Payload:
{
  "lead_id": "uuid-do-lead-no-sgt",
  "empresa": "BLUE" | "TOKENIZA",
  "evento": "CLASSIFICACAO" | "CS_UPDATE" | "DISC_DETECTADO" | "QUALIFICACAO",
  "dados": {
    "icp": "TOKENIZA_SERIAL",
    "persona": "CONSTRUTOR_PATRIMONIO",
    "temperatura": "QUENTE",
    "prioridade": 1,
    "score_interno": 85,
    "perfil_disc": "D",
    "health_score": 78,
    "estado_funil": "QUALIFICACAO",
    "framework_ativo": "SPIN",
    "mql": true,
    "data_mql": "2026-03-28T..."
  }
}
```

A function valida o token (reutiliza `SGT_WEBHOOK_SECRET`), faz upsert na tabela `lead` com os campos de enriquecimento e registra log.

### 2. Migration: Novas colunas na tabela `lead`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `amelia_icp` | text | Classificação ICP da Amélia |
| `amelia_persona` | text | Persona identificada |
| `amelia_temperatura` | text | FRIO/MORNO/QUENTE |
| `amelia_prioridade` | int | 1, 2 ou 3 |
| `amelia_score` | int | Score consolidado 0-100 |
| `amelia_disc` | text | Perfil DISC (D/I/S/C) |
| `amelia_health_score` | int | Health Score CS (0-100) |
| `amelia_estado_funil` | text | Estado no funil conversacional |
| `amelia_framework` | text | Framework ativo (SPIN, BANT, etc.) |
| `amelia_updated_at` | timestamptz | Última atualização da Amélia |

Prefixo `amelia_` para não conflitar com campos existentes do SGT.

### 3. Webhook de saída na Amélia (projeto separado)

Criar edge function `sgt-enrichment-callback` na Amélia que é chamada após classificação ou update de CS. Envia POST para o SGT com os dados acima. Isso será implementado no projeto da Amélia como etapa separada.

### 4. Exibição no SGT

Atualizar a página de Leads para mostrar os campos de enriquecimento da Amélia (badges de ICP, persona, DISC, barra de health score) quando disponíveis.

## Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/amelia-webhook/index.ts` | Nova — receptor de enriquecimento |
| Migration SQL | Adicionar colunas `amelia_*` na tabela `lead` |
| `src/pages/Leads.tsx` | Exibir badges ICP/Persona/DISC/Health quando preenchidos |

## Detalhes técnicos

- Autenticação via `x-webhook-secret` usando o `SGT_WEBHOOK_SECRET` já existente (mesmo token que a Amélia já usa para receber do SGT)
- O `lead_id` no payload é o UUID do SGT — a Amélia já armazena isso em `lead_contacts.lead_id`
- Idempotência: upsert por `id_lead` — reprocessar o mesmo lead apenas atualiza os campos
- A Amélia precisará de uma edge function de callback (segundo projeto), mas o receptor no SGT fica pronto agora

