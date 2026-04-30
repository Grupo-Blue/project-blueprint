## Visão geral

Criar um **Gerador de Links UTM** dentro da página `/guia-utm` (nova aba "Gerador") que:

1. Permite ao usuário montar a URL com os 5 parâmetros UTM (`source`, `medium`, `campaign`, `content`, `term`).
2. Salva cada link gerado em uma nova tabela `utm_link` no banco — com nome interno, canal, empresa, responsável, tags, observações, vínculo opcional a campanha/criativo.
3. Lista todos os links salvos com filtros (empresa, canal, fonte, campanha, criado por, ativo/inativo) e ações (copiar, abrir, editar, desativar, ver leads atribuídos).
4. **Rastreabilidade automática:** como a tabela `lead` já tem as colunas `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (e elas já são preenchidas pelos webhooks Pipedrive/LP/etc.), basta cruzar essas colunas com `utm_link` para descobrir quantos leads cada link gerou — sem mudar nenhum webhook.
5. Adiciona um filtro novo "Link UTM" na página de Leads, além de exibir uma coluna/tag indicando de qual link salvo o lead veio.

## Como vai parecer (aba dentro de `/guia-utm`)

```text
[Visão Geral] [Meta Ads] [Google Ads] [Pipedrive] [Validação] [Gerador]   ← nova aba
                                                              ─────────
┌─ Gerar novo link UTM ─────────────────────────────────┐
│ Nome interno*: [Lançamento Abril - Banner Topo]       │
│ Empresa*:     [Tokeniza ▼]   Canal: [Meta ▼]          │
│ URL base*:    [https://...]                            │
│ utm_source*:  [facebook]   utm_medium*: [cpc]          │
│ utm_campaign*:[lanc_abril] utm_content: [banner_topo]  │
│ utm_term:     [...]                                    │
│ Vincular a:   [Campanha ▼]  [Criativo ▼] (opcional)   │
│ Tags: [+] Observações: [...]                          │
│                                                        │
│ Pré-visualização: https://site.com?utm_source=...     │
│ [Copiar URL]  [Salvar link]                           │
└────────────────────────────────────────────────────────┘

┌─ Links salvos ────────────────────────────────────────┐
│ Filtros: empresa | canal | utm_source | criado por... │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Lançamento Abril - Banner Topo  [Meta][cpc]      │  │
│ │ utm_campaign=lanc_abril utm_content=banner_topo  │  │
│ │ 47 leads atribuídos · criado por João · 12/04    │  │
│ │ [Copiar] [Abrir] [Editar] [Ver leads] [Desativar]│  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Mudanças no banco (migration)

Nova tabela `utm_link`:

| coluna | tipo | obs |
|---|---|---|
| `id` | uuid PK | |
| `id_empresa` | uuid FK | obrigatório, isolamento multi-empresa |
| `nome_interno` | text | apelido do link |
| `url_base` | text | URL sem UTMs |
| `utm_source` / `utm_medium` / `utm_campaign` | text | obrigatórios |
| `utm_content` / `utm_term` | text | opcionais |
| `canal` | text | meta, google, organico, email, whatsapp, outro |
| `id_campanha` / `id_criativo` | uuid FK | opcionais |
| `tags` | text[] | |
| `observacoes` | text | |
| `ativo` | boolean default true | |
| `created_by` | uuid (auth.users) | |
| `created_at` / `updated_at` | timestamptz | |

Constraint única: `(id_empresa, utm_source, utm_medium, utm_campaign, utm_content, utm_term)` para evitar links duplicados.

**RLS:** todos os perfis logados (admin, direcao, trafego, sdr) podem `SELECT/INSERT/UPDATE` desde que a empresa esteja em `user_empresa` (ou perfil admin). `DELETE` apenas admin (preferimos desativar via `ativo=false`).

Função SQL `utm_link_com_contagem(_id_empresa)` que devolve cada link junto com `total_leads` cruzando com a tabela `lead` pelas colunas UTM (match por `id_empresa` + `utm_campaign` + `utm_content` quando presentes; fallback só por `utm_campaign`).

## Mudanças no frontend

1. **`src/pages/GuiaUTM.tsx`** — adicionar 6ª aba "Gerador" (renomear grid para `grid-cols-6`).
2. **`src/components/utm/GeradorUTM.tsx`** (novo) — formulário + preview ao vivo + salvar (zod validando URL e UTMs obrigatórios).
3. **`src/components/utm/LinksUTMSalvos.tsx`** (novo) — listagem com filtros, contagem de leads por link, ações (copiar, editar, desativar, ver leads → navega para `/leads?utm_campaign=X&utm_content=Y`).
4. **`src/pages/Leads.tsx`** — ler query params `utm_campaign`/`utm_content` e adicionar ao filtro existente; exibir badge "via [nome do link]" quando o lead bate com algum `utm_link` ativo.

## Rastreio dos leads (sem mexer em webhooks)

Os webhooks (`pipedrive-webhook`, `lp-lead-webhook`, `criar-lead-api`, `mautic-webhook`, `chatblue-webhook`) **já gravam** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` na tabela `lead`. Logo:

- **Atribuição é puro JOIN**: `lead.utm_campaign = utm_link.utm_campaign AND lead.utm_content = utm_link.utm_content AND lead.id_empresa = utm_link.id_empresa`.
- **Filtro por link na página de Leads**: passar os UTMs do link no filtro existente.
- Não há clique rastreado (o usuário escolheu URL direta, sem short link).

## Permissões e empresa

- O componente usa o `EmpresaContext` para preencher `id_empresa` no link e filtrar listagens.
- Todos os perfis logados podem criar; o link fica visível para quem tem acesso à empresa dele.

## O que NÃO faz parte deste plano

- Short link próprio com redirect (`/r/abc123`) e contagem de cliques — descartado nas perguntas.
- QR code do link — pode ser adicionado depois se você quiser.
- Edição em massa / import CSV de links — fora do escopo inicial.

## Resumo das entregas

1. Migration: tabela `utm_link` + RLS + função `utm_link_com_contagem`.
2. Aba "Gerador" em `/guia-utm` com formulário + listagem + filtros.
3. Filtro por link UTM e badge de origem na página de Leads.
4. Memória de projeto registrando o módulo Gerador UTM.