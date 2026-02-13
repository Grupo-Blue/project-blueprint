

# Disparo de Leads Aquecidos para o CRM (com dados completos)

## Visao geral do fluxo

O lead entra no sistema (via Pipedrive, CSV ou Mautic) e o SGT vai enriquecendo ele em segundo plano a cada 10 minutos. Quando o lead atinge score >= 70 (QUENTE), o sistema dispara automaticamente um webhook para o CRM com TODOS os dados enriquecidos. O CRM recebe um pacote completo para iniciar cadencias de SDR sem precisar buscar nada a mais.

```text
Lead entra no SGT (frio, score ~10)
        |
  Cron roda a cada 10min
        |
  Enriquece com Mautic (score, tags, paginas visitadas)
  Enriquece com Tokeniza (investimentos, carrinho)
  Enriquece com LinkedIn (cargo, senioridade)
  Enriquece com Chatwoot (conversas, atendimento)
        |
  Calcula score de temperatura
  Persiste score na tabela lead
        |
  Score >= 70?
   |          |
  Nao        Sim
   |          |
  Aguarda    Monta payload completo com TODOS os dados
  proximo    Envia webhook ao CRM
  ciclo      Evento: MQL (primeiro envio) ou SCORE_ATUALIZADO
```

## O que o CRM vai receber (payload completo)

O CRM recebe um JSON unico com tudo que precisa para classificar e abordar o lead:

```text
{
  lead_id, evento, empresa, timestamp,
  score_temperatura: 85,
  prioridade: "QUENTE",

  dados_lead: {
    nome, email, telefone,
    pipedrive_deal_id, url_pipedrive, organizacao,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    origem_tipo, lead_pago,
    score, stage,
    data_criacao, data_mql, data_levantou_mao, data_reuniao, data_venda,
    valor_venda
  },

  dados_linkedin: {           <-- NOVO
    url, cargo, empresa,
    setor, senioridade,
    conexoes
  },

  dados_mautic: {
    contact_id, score, page_hits,
    last_active, first_visit,
    tags, segments,
    cidade, estado
  },

  dados_tokeniza: {
    valor_investido, qtd_investimentos, qtd_projetos,
    projetos[], ultimo_investimento_em,
    carrinho_abandonado, valor_carrinho
  },

  dados_blue: {
    qtd_compras_ir, ticket_medio,
    score_mautic, cliente_status
  },

  dados_chatwoot: {
    contact_id, conversas_total, mensagens_total,
    ultima_conversa, status_atendimento,
    tempo_resposta_medio, agente_atual, inbox
  },

  dados_notion: {
    cliente_id, cliente_status
  },

  event_metadata: {           <-- contexto do evento
    oferta_id, valor_simulado, pagina_visitada
  }
}
```

## Mudancas necessarias

### 1. Migration SQL (nova)

Adicionar coluna `score_temperatura` (INTEGER, default 0) na tabela `lead` para persistir o score calculado no backend. Adicionar coluna `score_minimo_crm` (INTEGER, default 70) na tabela `webhook_destino` para threshold configuravel por destino.

### 2. Edge Function: `monitorar-enriquecimento-leads/index.ts`

Mudancas na funcao que roda a cada 10 minutos:

- Apos enriquecer com Mautic e Tokeniza, calcular o score de temperatura usando a mesma logica de `src/lib/lead-scoring.ts` (replicada no backend)
- Persistir o score na coluna `score_temperatura`
- Comparar com o score anterior: se cruzou o threshold de 70 (era < 70, agora >= 70), invocar `disparar-webhook-leads` com o lead_id e evento `MQL`
- Se ja estava acima de 70 e o score mudou mais de 15 pontos, invocar com evento `SCORE_ATUALIZADO`
- Registrar no log do cronjob quantos leads cruzaram o threshold

### 3. Edge Function: `disparar-webhook-leads/index.ts`

Mudancas no payload e filtragem:

**Adicionar ao payload:**
- Campo `score_temperatura` (numero) no nivel raiz
- Campo `prioridade` (string: URGENTE/QUENTE/MORNO/FRIO) no nivel raiz
- Objeto `dados_linkedin` com os campos: `url` (linkedin_url), `cargo` (linkedin_cargo), `empresa` (linkedin_empresa), `setor` (linkedin_setor), `senioridade` (linkedin_senioridade), `conexoes` (linkedin_conexoes)

**Modificar filtragem no modo cron (sem lead_ids):**
- Adicionar `.gte('score_temperatura', 70)` na query para so buscar leads quentes
- Respeitar o `score_minimo_crm` de cada destino ao filtrar envios
- Manter comportamento atual quando `lead_ids` sao fornecidos (disparo manual forcado)

### 4. Interface: `src/components/WebhookDestinosManager.tsx`

Adicionar campo "Score minimo para envio ao CRM" na configuracao de cada destino de webhook. Input numerico com default 70 e tooltip explicando a escala (0-200, QUENTE a partir de 70, URGENTE a partir de 120).

### 5. Logica de score no backend

Replicar a funcao `calcularScoreTemperatura` dentro da edge function `monitorar-enriquecimento-leads`. Os fatores sao:

- Engajamento Mautic: score * 0.4 + page_hits * 5 + bonus recencia (ate 90 pts)
- Tags de intencao (clicou-whatsapp, pediu-contato, etc): +20 pts
- Sinais comerciais: levantou_mao (+30), reuniao (+50), MQL (+20)
- Dados Tokeniza: investidor (+40), investimentos (+10 cada, max 30), carrinho abandonado (+35)
- Atendimento Chatwoot: SLA violado (+25), conversas ativas (+30)
- LinkedIn: C-Level/Diretor (+25), Senior/Gerente (+15), Pleno (+8)
- Cliente Notion existente: +25 pts
- Penalidade: inatividade no stage > 7 dias (-2 pts/dia, max -30)

## Resultado esperado

- Leads frios/mornos ficam "cozinhando" no SGT sem incomodar o CRM
- Quando um lead esquenta (score >= 70), o CRM recebe um pacote completo com TODOS os dados enriquecidos
- O SDR do CRM sabe exatamente: quem e o lead, de onde veio, o que fez, quanto investiu, qual o cargo, e por que ele foi enviado naquele momento
- O threshold e configuravel por destino de webhook na interface
