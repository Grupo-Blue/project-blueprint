

## Plano — Botão "Automatizar Cadência" integrado à Amélia

### O que muda na UI

No `src/pages/Segmentos.tsx`:
- Renomear o item do dropdown e o botão do header de **"Preparar Disparo WhatsApp"** → **"Automatizar Cadência"**.
- Trocar o ícone `MessageCircle` por `Bot` (lucide-react).
- Manter o botão "Preparar Disparo WhatsApp" antigo? **Não** — substituir totalmente, conforme o pedido. (A função `disparar-segmento-whatsapp` continua existindo no backend caso precise no futuro, mas some da UI.)

### Novo fluxo ao clicar "Automatizar Cadência"

1. Identifica a empresa do segmento (via `lead_segmento.id_empresa` → mapeia nome para `BLUE` ou `TOKENIZA` usando `empresa-constants.ts`).
2. Abre um **Dialog "Automatizar Cadência na Amélia"** que:
   - Mostra contagem de leads elegíveis (com **nome E telefone** — filtra os demais).
   - Lista as cadências existentes da empresa (chama MCP `list_cadences`).
   - Permite selecionar uma cadência **OU** clicar em "Criar nova cadência" (abre sub-form com nome, código, canal — chama MCP `create_cadence`).
3. Ao confirmar:
   - Para cada lead elegível, garante que existe um contato na Amélia (`search_contacts` por telefone → se não achar, `create_contact` com nome/telefone/empresa).
   - Coleta os IDs dos contatos da Amélia.
   - Chama MCP `enroll_lead_cadence` com `cadence_id`, `lead_ids`, `empresa`.
   - Mostra resumo: "X leads inscritos, Y já estavam inscritos, Z criados como novos contatos".

### Arquitetura técnica

**Nova edge function: `amelia-cadencia-proxy`**
- Recebe do frontend: `{ action: 'list_cadences' | 'create_cadence' | 'enroll_leads', empresa, ...args }`.
- Para `enroll_leads`: recebe `id_segmento` + `cadence_id`, busca os leads do segmento no banco SGT, filtra por `nome IS NOT NULL AND telefone valido`, depois faz o ciclo search/create/enroll na Amélia via MCP.
- Faz proxy para `https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/mcp-server` com header `Authorization: Bearer ${AMELIA_MCP_API_KEY}` e `Accept: application/json, text/event-stream`.
- Valida JWT do usuário antes de qualquer ação.

**Por que edge function e não chamar MCP direto do frontend:**
- A API key da Amélia fica server-side (secret).
- O ciclo search-or-create-then-enroll envolve N+1 chamadas — melhor server-side.
- Permite logar a operação localmente.

### Secret necessário

- `AMELIA_MCP_API_KEY` (você vai me passar). Vou usar `add_secret` para configurá-lo.

### Mapeamento empresa SGT → Amélia

Vou ler `src/lib/empresa-constants.ts` para confirmar IDs, mas a lógica:
- Empresa Tokeniza (`61b5ffeb-fbbc-47c1-8ced-152bb647ed20`) → `TOKENIZA`
- Empresa Blue (Blue Consult) → `BLUE`
- Outras → erro "empresa não suportada na Amélia ainda"

### Filtro obrigatório (nome + telefone)

No backend, antes de enviar para Amélia:
```ts
const elegiveis = leads.filter(l => 
  l.nome_lead?.trim() && 
  l.telefone?.replace(/\D/g, "").length >= 10
);
```
Telefones são normalizados para E.164 com `55` como prefixo Brasil antes de enviar.

### Arquivos afetados

- **Novo**: `supabase/functions/amelia-cadencia-proxy/index.ts`
- **Novo**: `src/components/segmentos/AutomatizarCadenciaDialog.tsx`
- **Editado**: `src/pages/Segmentos.tsx` (substituir botão/item dropdown, abrir o dialog em vez de chamar `disparar-segmento-whatsapp`)
- **Secret**: `AMELIA_MCP_API_KEY`

### Ordem de implementação

1. Pedir o secret `AMELIA_MCP_API_KEY` (`add_secret`).
2. Criar edge function `amelia-cadencia-proxy` com 3 actions (list_cadences, create_cadence, enroll_leads).
3. Criar componente `AutomatizarCadenciaDialog`.
4. Atualizar `Segmentos.tsx` — botão + dropdown + estado do dialog.
5. Testar end-to-end com um segmento real da Tokeniza.

