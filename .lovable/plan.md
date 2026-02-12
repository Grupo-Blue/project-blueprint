

# Dashboard Comercial V3 -- Plano de Implementacao

## Visao Geral

O Dashboard V3 separa metricas de **New Business (NB)** vs **Renovacao**, onde "Renovacao" e definido como um lead que ja e cliente ou ex-cliente na base do Notion (campo `cliente_status` na tabela `lead`, populado pelo `sincronizar-notion`). Ambos os pipelines (5 e 9) sao NB por padrao.

---

## SPRINT 1: Fundacao + Cockpit Executivo

### 1.1 Alteracoes no Banco de Dados

**Novos campos na tabela `lead`:**
- `motivo_perda` (text) -- capturado do Pipedrive (`lost_reason`)
- `proprietario_nome` (text) -- nome do dono do deal no Pipedrive
- `proprietario_id` (text) -- user_id do dono no Pipedrive
- `tempo_primeira_resposta_seg` (integer) -- calculado combinando Pipedrive + Chatblue

**Nova tabela `meta_comercial`:**

```text
meta_comercial
  id (UUID PK)
  id_empresa (UUID FK -> empresa)
  ano (integer)
  mes (integer)
  tipo_negocio (text: 'new_business' | 'renovacao' | 'total')
  meta_receita (numeric)
  meta_vendas (integer)
  meta_leads (integer)
  indice_sazonal (numeric, default 1.0)
  created_at (timestamptz)
  updated_at (timestamptz)
  UNIQUE(id_empresa, ano, mes, tipo_negocio)
```

RLS: leitura para autenticados, escrita para admins.

**Novo campo em `empresa_metricas_dia`:**
- `tipo_negocio` (text, default 'total') -- para separar metricas NB vs Renovacao
- Atualizar constraint unique para incluir `tipo_negocio`

### 1.2 Atualizar Edge Functions

**`sincronizar-pipedrive` -- adicionar captura de:**
- `deal.lost_reason` -> campo `motivo_perda`
- `deal.user_id` e buscar nome do owner via API -> `proprietario_nome` e `proprietario_id`
- Usar `cliente_status` existente no lead (populado pelo Notion) para classificar NB vs Renovacao

**`pipedrive-webhook` -- adicionar captura de:**
- `dealData.lost_reason` -> `motivo_perda`
- Buscar owner via API Persons (ja busca person, adicionar owner) -> `proprietario_nome`, `proprietario_id`
- Calcular `tempo_primeira_resposta_seg` quando primeira atividade chegar

**`calcular-metricas-diarias` -- separar por tipo_negocio:**
- Para cada empresa/dia, calcular 3 registros: 'total', 'new_business', 'renovacao'
- Classificar lead como renovacao quando `cliente_status IN ('cliente', 'ex_cliente')`
- Demais leads sao 'new_business'

**`chatblue-webhook` -- enriquecer tempo de resposta:**
- Quando um ticket e criado para um lead existente, calcular `tempo_primeira_resposta_seg` como diferenca entre `data_criacao` do lead e `created_at` do ticket

### 1.3 Componentes Frontend -- Visao 1 (Cockpit Executivo)

**Novo arquivo: `src/pages/DashboardComercial.tsx`**
- 6 KPIs principais com toggle NB/Renovacao/Total
- Cards: Receita, Vendas, Leads, Conversao, CAC, Ticket Medio
- Cada card mostra valor + variacao vs meta + variacao vs periodo anterior

**Novo arquivo: `src/components/dashboard/CockpitKPIs.tsx`**
- Componente dos 6 KPIs com suporte a tipo_negocio
- Busca de `empresa_metricas_dia` filtrado por tipo

**Novo arquivo: `src/components/dashboard/MetaVsRealizado.tsx`**
- Grafico de barras duplas (meta vs realizado) por mes
- Dados da tabela `meta_comercial` cruzados com `empresa_metricas_dia`

**Novo arquivo: `src/components/dashboard/ReceitaAcumulada.tsx`**
- Grafico de linha com receita acumulada no mes (dia a dia)
- Linha pontilhada da meta proporcional

**Novo arquivo: `src/components/dashboard/AlertasCriticos.tsx`**
- Banner vermelho com leads que violam SLA:
  - Lead > 15min sem resposta (requer `tempo_primeira_resposta_seg`)
  - Levantada de mao > 1h sem contato
  - Renovacoes sem contato > 48h
  - Leads sem proprietario

### 1.4 Rota e Navegacao
- Adicionar rota `/dashboard-comercial` no `App.tsx`
- Adicionar item no menu lateral (AppLayout)

---

## SPRINT 2: Funil NB + Renovacao + Marketing

### 2.1 Visao 2 -- NB Funil e Performance

**Novo arquivo: `src/components/dashboard/FunilNB.tsx`**
- Funil visual: Leads -> MQLs -> Levantadas -> Reunioes -> Vendas
- Taxas de conversao entre cada etapa
- Filtrado apenas por leads onde `cliente_status` NOT IN ('cliente', 'ex_cliente')

**Novo arquivo: `src/components/dashboard/PainelAtacarAgora.tsx`**
- Lista de leads com `tempo_primeira_resposta_seg` > 900 (15min) ou NULL
- SLA vermelho/amarelo/verde
- Nome do lead + tempo decorrido + link Pipedrive

**Novo arquivo: `src/components/dashboard/RankingVendedores.tsx`**
- Tabela com vendedores (campo `proprietario_nome`)
- Colunas: Vendas, Conversao, Ticket Medio, Tempo Medio Resposta
- Ordenavel por qualquer coluna

**Novo arquivo: `src/components/dashboard/MotivosPerdaNB.tsx`**
- Grafico de pizza/barras com `motivo_perda` agrupado
- Filtrado por leads NB perdidos (`stage_atual = 'Perdido'` e nao e cliente/ex-cliente)

### 2.2 Visao 3 -- Renovacao

**Novo arquivo: `src/components/dashboard/RenovacaoKPIs.tsx`**
- KPIs especificos: Taxa Renovacao, Churn, Receita Renovacao
- Gauge de churn (meta vs real)
- Filtrado por leads onde `cliente_status IN ('cliente', 'ex_cliente')`

**Novo arquivo: `src/components/dashboard/MotivosNaoRenovacao.tsx`**
- Mesmo formato do MotivosPerdaNB mas filtrado por renovacoes

### 2.3 Visao 4 -- Marketing e Canais

**Novo arquivo: `src/components/dashboard/LeadsPorCanal.tsx`**
- Leads agrupados por `origem_canal` e `utm_source`
- CAC Ativo por canal (verba do canal / vendas do canal)
- Conversao por canal

**Novo arquivo: `src/components/dashboard/CACPorCanal.tsx`**
- Grafico de barras comparando CAC entre canais
- Dados cruzados de `campanha_metricas_dia` (verba) com `lead` (vendas por utm_source)

---

## SPRINT 3: Financeiro + Operacional

### 3.1 Visao 5 -- Financeiro e Metas

**Novo arquivo: `src/components/dashboard/MetaSazonal.tsx`**
- Grafico com 3 barras por mes: Meta NB, Meta Renovacao, Realizado
- Indices sazonais aplicados visualmente
- Dados de `meta_comercial`

**Novo arquivo: `src/components/dashboard/ProjecaoReceita.tsx`**
- Projecao linear baseada no ritmo atual do mes
- Linha pontilhada projetando ate fim do mes

### 3.2 Visao 6 -- Operacional

**Novo arquivo: `src/components/dashboard/SLACompliance.tsx`**
- Porcentagem de leads respondidos dentro do SLA
- Breakdown por vendedor

**Novo arquivo: `src/components/dashboard/AtividadesCRM.tsx`**
- Resumo de atividades do Pipedrive (`pipedrive_activity`)
- Atividades por vendedor, tipo e status

**Novo arquivo: `src/components/dashboard/LeadsOrfaos.tsx`**
- Leads sem `proprietario_nome` (sem dono no CRM)
- Leads sem atividade recente

### 3.3 Visao 7 -- Comparativo Historico

**Novo arquivo: `src/components/dashboard/ComparativoAnual.tsx`**
- Graficos multi-linha com overlay de ate 3 anos
- Toggle para selecionar anos (2023, 2024, 2025 mockados; 2026 real)
- Metricas: Receita, Conversao, CAC

**Dados mockados** para 2023-2025: inserir via migration com valores representativos em `empresa_metricas_dia` para os anos anteriores.

---

## SPRINT 4: Sofisticacao

### 4.1 Insights Automaticos
- Usar Lovable AI (Gemini 2.5 Flash) para gerar insights semanais
- Entrada: metricas dos ultimos 7 dias vs 7 dias anteriores
- Saida: 3-5 bullet points com observacoes e sugestoes

### 4.2 Configuracao de Metas
- Tela simples para configurar metas anuais e indices sazonais
- CRUD na tabela `meta_comercial`
- Acessivel via pagina de configuracoes

---

## Resumo de Arquivos

### Banco de Dados (Migrations)
1. Adicionar campos `motivo_perda`, `proprietario_nome`, `proprietario_id`, `tempo_primeira_resposta_seg` na tabela `lead`
2. Criar tabela `meta_comercial`
3. Adicionar campo `tipo_negocio` em `empresa_metricas_dia` e ajustar constraint unique

### Edge Functions a Editar
4. `sincronizar-pipedrive/index.ts` -- capturar owner e lost_reason
5. `pipedrive-webhook/index.ts` -- capturar owner e lost_reason
6. `calcular-metricas-diarias/index.ts` -- separar metricas por tipo_negocio
7. `chatblue-webhook/index.ts` -- calcular tempo primeira resposta

### Frontend Novo
8. `src/pages/DashboardComercial.tsx` -- pagina principal com as 7 visoes em tabs
9. ~15 componentes novos em `src/components/dashboard/`

### Frontend Existente a Editar
10. `src/App.tsx` -- adicionar rota
11. `src/components/AppLayout.tsx` -- adicionar link no menu

---

## Criterio de Classificacao NB vs Renovacao

A logica e simples e reutiliza o que ja existe:

```text
SE lead.cliente_status IN ('cliente', 'ex_cliente')
  ENTAO tipo_negocio = 'renovacao'
SENAO
  tipo_negocio = 'new_business'
```

O campo `cliente_status` ja e populado pelo `sincronizar-notion` que cruza email do lead com a base de clientes do Notion.

---

## Pre-requisito

O `sincronizar-notion` precisa estar rodando periodicamente para manter o `cliente_status` atualizado. Se um lead novo entra e depois e identificado como cliente, a classificacao sera retroativa na proxima sincronizacao.

