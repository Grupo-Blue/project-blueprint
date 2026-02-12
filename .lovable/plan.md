

# Melhorar a coluna Prioridade em /leads

## Situacao Atual

A coluna **Prioridade** usa a funcao `getPrioridade` que classifica leads em 4 niveis (URGENTE, QUENTE, MORNO, FRIO) baseada quase exclusivamente no `mautic_score` bruto e alguns flags booleanos simples. Enquanto isso, existe uma funcao `calcularScoreTemperatura` mais completa que combina multiplas fontes de dados, mas ela so aparece como um numero nos detalhes expandidos e nao influencia a prioridade exibida.

## Proposta: Unificar as duas logicas

Fazer a coluna **Prioridade** usar o score composto (temperatura) como base, incorporando todos os dados disponiveis.

### Nova formula de temperatura (0-200 pontos)

**Engajamento Mautic (max ~90 pts)**
- `mautic_score * 0.4` (max ~40 pts para scores ate 100)
- `page_hits * 5` (max 50 pts)
- Bonus de recencia: se `mautic_last_active` < 3 dias = +15 pts, < 7 dias = +8 pts
- Bonus por tags de intencao (ex: "clicou-whatsapp") = +20 pts

**Sinais comerciais (max ~100 pts)**
- Levantou mao = +30
- Tem reuniao = +50
- E MQL = +20

**Dados Tokeniza (max ~70 pts)**
- Investidor = +40
- Qtd investimentos * 10 (max 30)
- Carrinho abandonado = +35

**Atendimento Chatblue (max ~60 pts)**
- Conversa ativa = +30
- SLA violado = +25 (urgencia operacional)
- Prioridade alta no Chatblue = +15
- Historico de conversas * 10 (max 50)
- Penalidade: tempo resposta > 24h = -20

**Qualificacao LinkedIn (max ~25 pts)**
- Senioridade C-Level = +25, Senior = +15, Pleno = +8

**Cliente existente (Notion)**
- Tem id_cliente_notion = +25

**Penalidades**
- Inatividade (>7 dias sem avancar stage, exceto Vendido/Perdido) = -2 por dia extra (max -30)
- Mautic inativo > 30 dias = -15

### Novos thresholds de Prioridade

| Nivel | Score | Condicao especial |
|-------|-------|-------------------|
| URGENTE | >= 120 | OU carrinho abandonado OU lead parado >7d em negociacao OU SLA violado |
| QUENTE | >= 70 | OU levantou mao OU tem reuniao |
| MORNO | >= 30 | OU e MQL |
| FRIO | < 30 | - |

### Mudancas visuais na coluna

Adicionar o score numerico ao lado do label para dar transparencia:
- Exemplo: "QUENTE 85°" em vez de apenas "QUENTE"

## Detalhes tecnicos

### Arquivos a modificar

1. **`src/pages/Leads.tsx`**
   - Refatorar `calcularScoreTemperatura` para incluir os novos campos (`mautic_last_active`, `mautic_tags`, `chatblue_sla_violado`, `chatblue_prioridade`, `linkedin_senioridade`)
   - Refatorar `getPrioridade` para usar o score composto como criterio principal, mantendo as condicoes especiais (carrinho abandonado, SLA violado) como override para URGENTE
   - Atualizar a celula da tabela para exibir o score ao lado do label

2. **`src/components/leads/LeadCardMobile.tsx`**
   - Replicar as mesmas mudancas nas funcoes duplicadas `calcularScoreTemperatura` e `getPrioridade`
   - Atualizar o badge de prioridade no card mobile

### Consideracao importante
As funcoes `calcularScoreTemperatura` e `getPrioridade` estao duplicadas entre `Leads.tsx` e `LeadCardMobile.tsx`. Idealmente, extrair para um arquivo utilitario compartilhado (ex: `src/lib/lead-scoring.ts`) para evitar divergencia futura.

