

# Análise: Conexão Amélia + Mautic — Status e Melhorias

## Amélia CRM → SGT: Status

**Conexão OK.** A Amélia tem o `sgt-enrichment-callback` configurado corretamente:
- URL do SGT: `https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/amelia-webhook` (correto)
- Autenticação via `SGT_WEBHOOK_SECRET` (correto)
- Envia: ICP, persona, temperatura, prioridade, score, DISC, estado_funil, framework, health_score
- O receptor no SGT (`amelia-webhook`) mapeia tudo corretamente para as colunas `amelia_*`
- A Amélia também busca dados de `lead_conversation_state` (DISC, estado_funil, framework) antes de enviar

**Nenhuma ação necessária** na integração Amélia — está pronta para funcionar.

---

## Mautic: Status e Problemas Encontrados

### O que funciona
- **Webhook de entrada** (`mautic-webhook`): recebe eventos do Mautic, cria/atualiza leads, detecta MQL, registra eventos
- **Enriquecimento** (`enriquecer-lead-mautic`): busca score, UTMs, cidade, tags por email ou telefone
- **Sincronização de segmentos** (`sincronizar-segmento-mautic`): empurra segmentos SGT → Mautic
- **Identity Graph**: alimentado pelos webhooks

### Bug encontrado: variável errada no Identity Graph

No `mautic-webhook` (linha 472), o bloco do Identity Graph usa `contactData` mas a variável real chama-se `contact`. Isso faz com que o Identity Graph **nunca seja alimentado** pelo Mautic.

### Inconsistência: nomes dos campos de config Mautic

As funções usam nomes diferentes para ler a mesma config:
- `enriquecer-lead-mautic`: usa `url_base`, `login`, `senha`
- `sincronizar-segmento-mautic`: usa `mautic_url`, `mautic_user`, `mautic_password`

Isso pode causar falha na sincronização de segmentos se o `config_json` da integração Mautic só tiver um dos formatos. A `sincronizar-segmento-mautic` tem fallbacks (`config.username`, `config.password`) mas não para `url_base`.

### O que NÃO estamos aproveitando do Mautic

1. **Segmentos do Mautic para o SGT**: o webhook recebe os segmentos do contato (`contactSegments`) mas só os usa para mapear empresa — não salva na tabela `lead` para consulta
2. **DoNotContact**: o Mautic tem a flag `doNotContact` que indica opt-out — não estamos salvando isso, o que pode levar a disparos para quem pediu pra sair
3. **Formulários preenchidos**: o Mautic rastreia formulários (`form_on_submit`) mas o webhook não escuta esse evento

---

## Plano de Correções

### 1. Corrigir bug `contactData` → `contact` no mautic-webhook
Linha 472-474: trocar `contactData` por `contact` para que o Identity Graph funcione.

### 2. Normalizar nomes de config no `sincronizar-segmento-mautic`
Adicionar fallbacks para aceitar ambos os formatos: `url_base` ou `mautic_url`, `login` ou `mautic_user`.

### 3. Salvar segmentos Mautic no lead
Adicionar coluna `mautic_segments` (já existe na interface `EnrichedLeadData` do enriquecer) e popular no webhook.

### 4. Salvar flag DoNotContact
Adicionar coluna `mautic_do_not_contact` (boolean) na tabela `lead` para evitar disparos indevidos.

## Alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/mautic-webhook/index.ts` | Corrigir `contactData` → `contact`, salvar `mautic_segments` e `doNotContact` |
| `supabase/functions/sincronizar-segmento-mautic/index.ts` | Normalizar leitura de config (aceitar `url_base`/`mautic_url`) |
| Migration SQL | Adicionar `mautic_segments` (jsonb) e `mautic_do_not_contact` (boolean) na tabela `lead` |

