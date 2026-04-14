

# Plano — SGT Intelligence (Módulo de Inteligência Comercial)

## O que já existe e será reaproveitado

| Recurso existente | Como será usado |
|---|---|
| Tabela `lead` com todos os campos necessários (irpf_*, tokeniza_*, mautic_*, linkedin_*, amelia_*) | Base de dados para ICP e Match — **nenhuma coluna nova necessária** |
| `lead_segmento` + `lead_segmento_membro` + `calcular-segmentos` Edge Function | Segmentos ICP serão criados nessas tabelas, adicionando novos tipos ao motor existente |
| `Segmentos.tsx` (página existente) | Será **evoluída**, não duplicada — ganha visualizações extras (variação, temperatura, conversão) |
| `lead-scoring.ts` | Reaproveitado como base do Score de Match |
| `IRPFDashboardInsights.tsx` | Componente de insights IRPF já existe — será estendido com insights comerciais |
| 30k leads, 12k vendas, 41 com IRPF, 2.5k investidores Tokeniza | Volume real para cálculos |

## O que será criado

### Fase 1 — Backend (tabelas + edge function)

**Nova tabela: `icp_perfil`**
- `id`, `id_empresa`, `nome` (ex: "Blue Premium"), `descricao`, `regras` (JSONB com critérios e pesos), `auto_gerado` (bool), `created_at`, `updated_at`
- Cada ICP gera automaticamente um `lead_segmento` vinculado (campo `id_icp` adicionado a `lead_segmento`)

**Nova tabela: `icp_match`**
- `id`, `id_lead`, `id_icp`, `score_match` (0-100), `campos_match` (JSONB — quais critérios bateram), `campos_faltantes` (JSONB), `calculated_at`
- Índice em `(id_icp, score_match DESC)` para queries rápidas de ranking
- Recalculada periodicamente

**Edge Function: `calcular-icp-match`**
- Recebe `id_icp` ou roda para todos
- Para cada ICP, busca leads sem venda e calcula score baseado nos pesos configuráveis
- Grava em `icp_match`
- Pode ser chamada manualmente ou via cron (1x/dia)

**Novo tipo no motor de segmentos:**
- Adicionar tipo `icp_match` ao `calcular-segmentos` — segmentos vinculados a ICPs usam a tabela `icp_match` com threshold configurável

### Fase 2 — Frontend (4 sub-páginas + sidebar)

**Sidebar**: Novo grupo "Inteligência" com 4 itens:
- Perfis ICP (`/inteligencia/icp`)
- Match de Leads (`/inteligencia/match`)
- Segmentos Inteligentes (`/inteligencia/segmentos`) — evolução do `/segmentos` atual
- Oportunidades IRPF (`/inteligencia/irpf`)

**Página 1 — Motor de Perfis ICP** (`/inteligencia/icp`)
- Cards por empresa mostrando perfis existentes
- Botão "Gerar ICP automaticamente" → analisa leads com `venda_realizada = true`, calcula medianas/distribuições dos campos-chave, sugere nome e critérios
- Editor de regras: sliders para faixas (renda, patrimônio, investimentos) + toggles (possui_cripto, possui_empresas) + pesos
- Ao salvar, cria automaticamente o segmento vinculado

**Página 2 — Match de Leads** (`/inteligencia/match`)
- Dropdown para selecionar ICP ativo
- Lista ranqueada de leads com: score (0-100), badges dos campos que bateram, indicadores de campos faltantes
- Filtros: score mínimo, empresa, canal
- KPIs no topo: total de matches, matches >80, oportunidades cross-sell
- Botão de ação: enviar para Mautic/Meta/WhatsApp (reusa mutations do Segmentos.tsx)

**Página 3 — Segmentos Inteligentes** (`/inteligencia/segmentos`)
- Migra a página `Segmentos.tsx` para cá com adições:
  - KPI cards no topo: tamanho vs semana anterior (variação %), distribuição de temperatura, taxa de conversão histórica
  - Segmentos automáticos de ICP aparecem com badge "ICP"
  - Segmentos cross-sell pré-configurados
- Mantém toda funcionalidade existente (Mautic, Meta, WhatsApp, CSV)

**Página 4 — Oportunidades IRPF** (`/inteligencia/irpf`)
- Lista de leads com dados IRPF importados
- Para cada lead: cards de insight gerados por regras simples no frontend (sem IA):
  - "Declaração simplificada com renda > 150k — pode estar pagando mais imposto"
  - "Possui X empresas — potencial para planejamento societário"
  - "R$ X em investimentos financeiros — perfil para diversificação Tokeniza"
  - "Possui cripto — familiarizado com ativos digitais"
- Filtros: empresa, faixa de renda, tipo de oportunidade
- Botão "Enviar para cadência" (dispara webhook Amélia)

### Fase 3 — Dashboard KPIs (widget no Dashboard principal ou sub-página)

- Widget compacto no Dashboard Comercial com:
  - Leads por segmento ICP
  - Pipeline estimado cross-sell
  - Cobertura IRPF (leads com dados vs total)
- Pode ser implementado como aba extra no Dashboard Comercial existente

## Detalhes técnicos

- **Tabelas novas**: `icp_perfil`, `icp_match` (+ coluna `id_icp` em `lead_segmento`)
- **Edge Function nova**: `calcular-icp-match`
- **Edge Function alterada**: `calcular-segmentos` (novo tipo `icp_match`)
- **Páginas novas**: 4 páginas em `/inteligencia/*`
- **Sidebar alterada**: `LiquidSidebar.tsx` — novo grupo "Inteligência"
- **Página removida/redirect**: `/segmentos` → `/inteligencia/segmentos`
- **RLS**: `icp_perfil` e `icp_match` com policies baseadas em `user_empresa`
- **Cron**: `calcular-icp-match` 1x/dia após `calcular-segmentos`

## Ordem de implementação

1. Migration: criar `icp_perfil` + `icp_match` + alterar `lead_segmento` + RLS
2. Edge Function `calcular-icp-match`
3. Atualizar `calcular-segmentos` com tipo `icp_match`
4. Páginas frontend (ICP → Match → Segmentos → IRPF)
5. Sidebar + rotas
6. Widget no Dashboard Comercial

