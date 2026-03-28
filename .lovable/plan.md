

# Identidades Anônimas + Integração de Segmentos (Mautic, WhatsApp, Meta Ads)

## Sobre os anônimos

Sim, a falta de identidades anônimas é uma lacuna. O Mautic rastreia visitantes anônimos por IP/cookie antes de se identificarem. O Identity Graph deveria fazer o mesmo: registrar `cookie_id`, `session_id`, `fbp` vindos do Stape **sem exigir lead** (`id_lead = null`). Quando o visitante se identifica (preenche formulário), todos os IDs anônimos são automaticamente vinculados via merge transitivo — isso já está implementado na lógica do `resolver-identidade`, mas o `stape-webhook` atualmente só chama o resolver quando já tem email/telefone. A correção é simples: chamar o resolver **sempre**, mesmo sem email.

## O que será construído

### 1. Captura de identidades anônimas no Stape Webhook

Atualizar `stape-webhook` para chamar `resolver-identidade` em **todo** evento, mesmo sem email/telefone. Isso registra `cookie_id`, `session_id`, `fbp`, `fbc`, `gclid` como entradas anônimas (`id_lead = null`). Quando o mesmo cookie aparecer num evento com email, o merge acontece automaticamente.

### 2. Ações nos Segmentos (página `/segmentos`)

Adicionar botões de ação em cada segmento:

| Ação | O que faz |
|------|-----------|
| **Sincronizar Mautic** | Cria/atualiza um segmento no Mautic com os leads do segmento SGT (via API do Mautic) |
| **Disparar WhatsApp** | Gera CSV com telefones do segmento e dispara para a API de mensageria existente |
| **Enviar Meta Ads** | Cria Custom Audience via Meta CAPI com emails+phones hasheados (SHA-256) |
| **Exportar CSV** | Download direto da lista de leads |

### 3. Edge Function `sincronizar-segmento-mautic`

- Recebe `id_segmento`
- Busca membros do segmento com email
- Chama API do Mautic (`POST /api/segments/{id}/contact/{contactId}/add`) para cada lead
- Se o segmento não existe no Mautic, cria via `POST /api/segments/new`
- Armazena `mautic_segment_id` no campo `regras` do segmento SGT

### 4. Edge Function `exportar-segmento-meta`

- Recebe `id_segmento` + `ad_account_id`
- Busca membros com email/telefone
- Hasheia com SHA-256 (padrão Meta)
- Chama Meta Marketing API `POST /{ad_account_id}/customaudiences` para criar audiência
- Depois `POST /{audience_id}/users` com os hashes
- Usa o `META_ACCESS_TOKEN` já usado pelo sistema CAPI

### 5. Edge Function `disparar-segmento-whatsapp`

- Recebe `id_segmento` + `mensagem` + `template_id`
- Busca membros com telefone
- Chama a mesma API de mensageria que o sistema já usa (ou gera CSV para download)

## Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/stape-webhook/index.ts` | Chamar resolver-identidade em TODOS os eventos (não só quando tem email) |
| `supabase/functions/sincronizar-segmento-mautic/index.ts` | Nova — sincroniza segmento SGT → Mautic |
| `supabase/functions/exportar-segmento-meta/index.ts` | Nova — cria Custom Audience no Meta Ads |
| `supabase/functions/disparar-segmento-whatsapp/index.ts` | Nova — dispara campanha WhatsApp por segmento |
| `src/pages/Segmentos.tsx` | Adicionar botões de ação (Mautic, WhatsApp, Meta, CSV) com modais de configuração |
| Migration SQL | Adicionar colunas `mautic_segment_id` e `meta_audience_id` na tabela `lead_segmento` |

## Detalhes técnicos

- A API do Mautic já está configurada (usada por `enriquecer-lead-mautic`) — reutiliza as mesmas credenciais
- Meta Custom Audiences usa a Graph API v22.0 com o mesmo token do CAPI
- O disparo de WhatsApp reutiliza a infraestrutura do `whatsapp-disparo-webhook`
- Os anônimos no Identity Graph só consomem espaço se nunca convertem — pode-se implementar um cleanup periódico (TTL de 90 dias para entradas sem `id_lead`)
- Cada ação é idempotente: sincronizar o mesmo segmento duas vezes não duplica dados

