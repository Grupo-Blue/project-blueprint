

# Exportacao Filtrada de Leads + Controle de Disparos WhatsApp

## Resumo

Criar um sistema completo de exportacao de listas de leads filtradas para disparos via API oficial da Meta (WhatsApp), com rastreamento de quais leads receberam cada disparo, permitindo criar listas inteligentes que excluam quem ja foi contactado.

## O que sera construido

### 1. Tabelas no banco de dados

**`disparo_whatsapp`** - Registra cada campanha/disparo realizado
- id, nome do disparo, descricao, id_empresa, data_criacao, quantidade de leads, status (rascunho/enviado/concluido)

**`disparo_whatsapp_lead`** - Vincula leads a disparos (N:N)
- id, id_disparo, id_lead, data_inclusao
- Permite saber exatamente quem recebeu o que

### 2. Presets de listas inteligentes

Na tela de Leads, um novo botao "Exportar Lista" abrira um modal com presets prontos:

| Preset | Logica |
|--------|--------|
| Base completa | Todos os leads da empresa |
| Base sem clientes | Exclui quem tem `cliente_notion.status_cliente = "Cliente"` |
| Negociacao sem compra (ultimos X meses) | `stage_atual` em stages de negociacao, sem `venda_realizada`, nos ultimos X meses |
| Ex-clientes | `cliente_notion.status_cliente = "Ex-cliente"` |
| Leads quentes | Score temperatura >= 70 (prioridade QUENTE ou URGENTE) |
| Leads mornos | Score entre 30-69 |
| Leads frios | Score < 30 |
| Carrinho abandonado | `tokeniza_carrinho_abandonado = true` e nao investidor |

### 3. Filtros adicionais na exportacao

- Excluir leads que ja receberam **qualquer** disparo
- Excluir leads que receberam um **disparo especifico** (dropdown com historico)
- Filtrar por empresa
- Filtrar por periodo de entrada
- Exigir telefone valido (>= 10 digitos)

### 4. Fluxo de exportacao

1. Usuario escolhe preset ou usa filtros ativos da tela de leads
2. Visualiza preview da lista (quantidade, amostra)
3. Nomeia o disparo (ex: "Campanha IRPF 2025 - Ex-clientes")
4. Exporta CSV com: nome, telefone, email, empresa, score temperatura, stage
5. O sistema registra automaticamente o disparo e vincula todos os leads exportados
6. Na proxima exportacao, pode excluir quem ja recebeu esse disparo

### 5. Historico de disparos

Uma aba ou secao na pagina de Leads mostrando:
- Lista de disparos realizados (nome, data, quantidade)
- Possibilidade de ver quais leads estavam em cada disparo
- Re-exportar uma lista anterior

## Detalhes tecnicos

### Migracao SQL

```text
Tabela disparo_whatsapp:
  - id (uuid, PK)
  - id_empresa (uuid, FK empresa)
  - nome (text, NOT NULL)
  - descricao (text)
  - preset_usado (text) -- qual preset gerou
  - filtros_aplicados (jsonb) -- snapshot dos filtros
  - qtd_leads (integer)
  - created_at (timestamptz)
  - created_by (uuid, FK auth.users via profiles)
  - RLS: usuario deve ter acesso a empresa

Tabela disparo_whatsapp_lead:
  - id (uuid, PK)
  - id_disparo (uuid, FK disparo_whatsapp)
  - id_lead (uuid, FK lead)
  - UNIQUE(id_disparo, id_lead)
  - RLS: via join com disparo_whatsapp
```

### Componentes React

- **`ExportarListaModal.tsx`** - Modal principal com presets, filtros de exclusao e preview
- **`HistoricoDisparos.tsx`** - Listagem de disparos anteriores
- Integracao no botao existente de exportacao na pagina de Leads

### Logica de filtragem

A filtragem reutiliza a mesma logica do `lead-scoring.ts` (getPrioridade, calcularScoreTemperatura) para classificar leads como quentes/mornos/frios. Os presets sao combinados com os filtros de exclusao de disparos anteriores usando uma subquery:

```text
leads filtrados pelo preset
MINUS
leads que existem em disparo_whatsapp_lead 
  WHERE id_disparo IN (disparos selecionados para exclusao)
```

### Formato do CSV exportado

Colunas: Nome, Telefone, Email, Empresa, Temperatura (Quente/Morno/Frio), Score, Stage Atual, Data Entrada

O telefone sera formatado no padrao internacional (55 + DDD + numero) para compatibilidade direta com a API da Meta.

## O que NAO esta incluido neste plano

- Integracao direta com a API de disparos (o usuario exporta o CSV e importa no seu sistema "Mensageria")
- Webhook de retorno do Mensageria para o SGT (pode ser feito futuramente)
- Metricas de entrega/leitura dos disparos (depende do sistema externo)

Esses podem ser adicionados depois como evolucao natural.

