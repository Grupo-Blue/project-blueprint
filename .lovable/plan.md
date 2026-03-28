

# Identity Graph — Construção de Identidade Persistente

## Diagnóstico: O que já existe

O SGT já tem **80% da infraestrutura** de um Identity Graph, mas de forma dispersa e não centralizada:

| Camada | Status | Onde vive |
|--------|--------|-----------|
| Coleta server-side | Parcial | `stape_evento` (client_id, session_id, fbp, fbc, gclid, UTMs) |
| Identity Resolution | Parcial | `enriquecer-leads-stape` (triple-match: email → client_id → fbp) |
| Event Tracking | Existe mas não padronizado | `stape_evento.event_name` (valores livres) |
| Enriquecimento | Forte | 50+ colunas na tabela `lead` (Mautic, LinkedIn, Tokeniza, GA4, Chatblue, IRPF) |
| Segmentação dinâmica | Não existe | Filtros manuais na página de Leads |
| Loop fechado (CAPI) | Existe | `disparar-meta-capi-venda` + `stape-meta-capi` |

**O que falta**: uma tabela de identidades separada para mapear N identificadores → 1 lead, e segmentação dinâmica automática.

## O que será construído

### 1. Tabela `identity_graph` (Camada 3 — Identity Resolution)

Tabela de mapeamento N:1 que vincula qualquer identificador a um `id_lead`:

```text
identity_graph
├── id (UUID, PK)
├── id_lead (UUID, FK → lead)
├── id_empresa (UUID, FK → empresa)
├── identifier_type (ENUM: email, phone, cookie_id, session_id, fbp, fbc, gclid, gbraid, mautic_id, pipedrive_id, tokeniza_id, cpf, linkedin_url, device_id)
├── identifier_value (TEXT)
├── confidence (FLOAT 0-1): grau de certeza do match
├── first_seen_at (TIMESTAMPTZ)
├── last_seen_at (TIMESTAMPTZ)
├── source (TEXT): de onde veio (stape, mautic, pipedrive, manual, webhook)
├── UNIQUE(identifier_type, identifier_value)
```

### 2. Função `resolver-identidade` (Edge Function)

Chamada por todos os webhooks e funções de coleta. Recebe um conjunto de identificadores e:
- Busca matches na `identity_graph`
- Se encontra → retorna o `id_lead` existente
- Se não encontra mas tem email/telefone → cria lead + registra todos os IDs
- Se só tem cookie/session → registra como anônimo (id_lead = null), aguarda merge futuro
- Quando um anônimo ganha email → faz merge automático de todos os IDs vinculados ao mesmo cookie

### 3. Tabela `lead_segmento` (Camada 5 — Segmentação Dinâmica)

```text
lead_segmento
├── id (UUID, PK)
├── id_empresa (UUID, FK → empresa)
├── nome (TEXT): "Alta Intenção", "Quase Cliente", etc.
├── regras (JSONB): critérios automáticos
├── ativo (BOOLEAN)
├── created_at

lead_segmento_membro
├── id_lead (UUID, FK → lead)
├── id_segmento (UUID, FK → lead_segmento)
├── adicionado_em (TIMESTAMPTZ)
├── removido_em (TIMESTAMPTZ, nullable)
```

### 4. Função `calcular-segmentos` (Edge Function)

Cronjob (a cada 2h) que avalia todos os leads ativos contra as regras de segmentação e atualiza membros. Regras pré-configuradas:

| Segmento | Regra |
|----------|-------|
| Alta Intenção | visitou LP + clicou CTA + não comprou (últimos 7 dias) |
| Aquecimento | abriu email (mautic_page_hits > 3) + visitou 2+ páginas |
| Quase Cliente | stape_eventos contém "initiate_checkout" + não tem venda |
| Cliente Quente | venda_realizada = true + stape_last_activity < 7 dias |
| Reativação | mautic_last_active > 30 dias + já foi MQL |

### 5. Padronização de Eventos (Camada 2)

Adicionar coluna `event_category` (ENUM) na `stape_evento`:
- `page_view`, `view_content`, `lead`, `qualify_lead`, `schedule_call`, `purchase`, `revenue_event`, `custom`

### 6. Integração nos webhooks existentes

Atualizar `stape-webhook`, `pipedrive-webhook`, `mautic-webhook`, `lp-lead-webhook` e `criar-lead-api` para chamar `resolver-identidade` automaticamente, alimentando o grafo a cada interação.

### 7. Widget no Dashboard

Card "Identity Graph" mostrando:
- Total de identidades mapeadas
- % de leads com identidade resolvida (vs anônimos)
- Top segmentos dinâmicos com contagem

## Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar `identity_graph`, `lead_segmento`, `lead_segmento_membro`, enum `identifier_type`, coluna `event_category` |
| `supabase/functions/resolver-identidade/index.ts` | Nova edge function de identity resolution |
| `supabase/functions/calcular-segmentos/index.ts` | Nova edge function de segmentação dinâmica |
| `supabase/functions/stape-webhook/index.ts` | Chamar resolver-identidade |
| `supabase/functions/pipedrive-webhook/index.ts` | Chamar resolver-identidade |
| `supabase/functions/mautic-webhook/index.ts` | Chamar resolver-identidade |
| `supabase/functions/criar-lead-api/index.ts` | Chamar resolver-identidade |
| `supabase/functions/enriquecer-leads-stape/index.ts` | Migrar lógica de match para usar identity_graph |
| `src/components/dashboard/IdentityGraphWidget.tsx` | Novo widget |
| `src/pages/Dashboard.tsx` | Incluir widget |
| Cronjob SQL | Agendar `calcular-segmentos` a cada 2h |

## Detalhes Técnicos

- A tabela `identity_graph` usa índice UNIQUE em `(identifier_type, identifier_value)` para deduplicação e lookup O(1)
- A função `resolver-identidade` usa lógica de "merge transitivo": se cookie_A → lead_1 e email_X → lead_1, qualquer novo evento com cookie_A automaticamente herda o email_X
- RLS: leitura restrita a usuários da empresa (via `user_empresa`) + admins
- A segmentação é calculada em batch (não real-time) para evitar overhead nos webhooks
- O modelo é incremental: não quebra nada existente, apenas adiciona a camada de resolução

