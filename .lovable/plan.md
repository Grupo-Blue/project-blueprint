## Objetivo

Construir o módulo **"Visão 360 Comercial — Blue Consult"**: ingestão das 3 bases do Notion → unificação por chave canônica de cliente → cálculo de gatilhos/score/filas → nova página `/comercial/visao-360` no SGT com 4 filas de ataque (Renovação, Upsell, Resgate, Win-back), priorizadas e prontas para o time comercial.

## Bases de origem (Notion)

| Base | Data Source ID | Papel |
|---|---|---|
| Info Clientes | `4dacdfcc-44cb-4775-b6d6-e4bd21bcfd60` | Cadastro mestre (CPF, contato, perfil, status ativo) |
| CRM Clientes | `1a52e840-ab4f-815e-a7be-000b06b47b88` | Histórico fiscal multi-ano (Nivel, Prioridade, Status 2021–2025) |
| CRM 2026 | `2a22e840-ab4f-81f6-b62d-000bd29e26f2` | Operação ano corrente (Status 2026 mês a mês, B3, IR Geral, responsável) |

## Fases

### Fase 1 — Fundação de dados (backend)

**1.1 Schema Supabase** (migration)
- Tabela `blue_cliente_raw_info` — espelho cru de Info Clientes (campos do briefing + `notion_page_id`, `notion_last_edited`).
- Tabela `blue_cliente_raw_crm` — espelho de CRM Clientes (Nivel, Prioridade, Status 2021–2025, IRPF Geral 2026, FIM, Validou Dez/2025, Cronograma).
- Tabela `blue_cliente_raw_2026` — espelho de CRM 2026 (Status 2026, Apuração B3, IR Geral 2026, Card 2025 Anteriores, Responsável).
- Tabela `blue_cliente_360` — visão consolidada (1 linha por `client_key`) com TODOS os campos do modelo unificado (seção 4 do briefing) + `score_priorizacao`, `fase_macro`, `gatilho_principal`, `oportunidades jsonb[]`, `filas text[]`.
- Tabela `blue_match_revisao` — pares com similaridade 70–85% para confirmação humana, com vínculo permanente após resolução.
- Tabela `blue_sync_status` — controle de execução do worker (último run, erros, contagens).
- RLS: visível para admin + perfis com acesso à empresa Blue Consult (reaproveita `user_has_irpf_empresa_access` adaptado).

**1.2 Edge function `notion-blue-sync`**
- Lê as 3 bases do Notion via API (paginação completa, secret `NOTION_API_KEY`).
- Faz upsert nas tabelas raw (chave: `notion_page_id`).
- Calcula `client_key` (lowercase + remove acentos + remove pontuação + remove tokens ≤ 1 char + ordena alfabeticamente + join com `-`).
- Match em duas camadas: exato por `client_key` → fuzzy Levenshtein > 85%; intervalos 70–85% vão para `blue_match_revisao`.
- Trigger manual + cron a cada 30 min.
- Retorna métricas: registros lidos, matched, em revisão, tempo de execução.

**1.3 Edge function `blue-cliente-360-build`**
- Lê tabelas raw já matched.
- Calcula campos derivados: `anos_finalizados`, `anos_pendentes`, `fase_macro`, `gatilho_principal`, `oportunidades`, `filas`, `score_priorizacao` (fórmula da seção 5.2 do briefing, parametrizável).
- Faz upsert em `blue_cliente_360`.
- Disparada ao final do `notion-blue-sync`.

**Entrega da Fase 1:** dados das 3 bases sincronizados e consolidados no Supabase, sem UI ainda. Testável via SQL.

---

### Fase 2 — Interface "Visão 360" (frontend)

**2.1 Nova página `src/pages/Visao360Comercial.tsx`** registrada em `App.tsx` e no menu da `LiquidSidebar` (sob "Comercial"; visível apenas quando empresa selecionada = Blue Consult).

**2.2 Layout (seguindo design Liquid existente)**
- Topo: 4 GlassCards-resumo (Renovação / Upsell / Resgate / Win-back) com contagem de oportunidades quentes; clique filtra a lista.
- Sidebar esquerda: filtros UF, Responsável CS, faixa de Nivel, perfil psicográfico, busca por nome/CPF.
- Área central: lista virtualizada de cards (react-virtual ou tanstack-virtual) ordenada por `score_priorizacao`.
- Painel direito (drawer ao clicar): detalhe completo do Cliente 360.

**2.3 Card do cliente** — todos os 8 itens da seção 7.2 do briefing: nome+avatar, CPF/cliente desde, badges Nivel/Prioridade, linha de gatilho, 4 mini-stats, histórico de anos como pílulas coloridas, top 3 oportunidades, perfil + WhatsApp clicável + analista CS.

**2.4 Painel de detalhe** com botões: "Registrar abordagem", "Agendar follow-up", "Marcar ganho/perdido". Persiste em `blue_cliente_acao` (nova tabela: tipo, vendedor, data, resultado, observação).

**2.5 Paginação server-side** via RPC `blue_visao360_listar(empresa, fila, filtros, ordenacao, limite, offset)` retornando `total_count + registros` (mesmo padrão do `irpf_inteligencia_listar`).

**Entrega da Fase 2:** comercial consegue navegar pelas 4 filas, ver cards priorizados e registrar ações.

---

### Fase 3 — Tela de revisão de matches

**3.1 Página `src/pages/Visao360Matches.tsx`** lista pares de `blue_match_revisao` com similaridade 70–85%.

**3.2 Operações**: confirmar vínculo (grava em `blue_match_confirmado` permanente), rejeitar (cria registro separado), ou unificar manualmente arrastando.

**3.3 Reprocessamento automático** do `blue_cliente_360` para os clientes afetados.

---

### Fase 4 — KPIs & configuração

**4.1 Dashboard gerencial** dentro da Visão 360:
- Oportunidades quentes por fila (snapshot atual).
- Conversão por fila (ganhas/perdidas/em aberto) — consome `blue_cliente_acao`.
- Tempo médio entre ataque e desfecho.
- Ranking de vendedores.

**4.2 Tela de configuração de pesos do score** (seção 5.2 do briefing): inputs para `prioridade_weight`, bônus temporal/aprovação/fidelidade, penalidade de inatividade. Persiste em `blue_score_config` (uma linha por empresa). Edge function recalcula score sob demanda.

---

### Fase 5 — Operação contínua

- Cron `notion-blue-sync` a cada 30 min via `pg_cron`.
- Alerta se sync falhar 2x seguidas (reusa `alerta_automatico`).
- Botão "Sincronizar agora" na página para forçar refresh.
- Botão "Atualizar Visão 360" (`refresh_blue_cliente_360`) para reprocessar campos derivados após mudança de pesos.

## Detalhes técnicos

- **Empresa fixa:** todo o módulo é escopado à empresa Blue Consult (`id_empresa` lida do `EmpresaContext`).
- **Pré-requisito:** secret `NOTION_API_KEY` (a integração do Notion precisa ter as 3 bases compartilhadas com ela). Será solicitada no início da Fase 1.
- **Recomendação ao usuário (do próprio briefing, seção 3.2):** adicionar coluna CPF/CNPJ nas bases CRM Clientes e CRM 2026 do Notion eliminaria o problema de match. Implementaremos o fuzzy mesmo assim, mas vale registrar.
- **Reuso:** padrão `irpf_inteligencia_*` (RPC + materialized view) serve de modelo para `blue_visao360_*`.
- **Sem mudança no MCP server** nesta fase — pode ser um adendo futuro.

## Fora de escopo (v1)

- Escrita de volta no Notion (sistema só lê).
- Disparos automáticos para Mautic/Chatblue a partir das filas (pode entrar em Fase 6).
- Integração com Pipedrive deals para fechar o loop comercial.