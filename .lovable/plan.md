

# Replay de Webhooks Rejeitados + Mapeamento de origem_tipo

## Diagnostico

O CRM (Amelia) rejeitou **~44.600 webhooks** com status 400 pelos seguintes motivos:

| Motivo da rejeicao | Ocorrencias |
|---|---|
| `origem_tipo = 'MANUAL'` nao aceito | 32.366 |
| `origem_tipo = 'PAGO'` nao aceito | 11.438 |
| `origem_tipo = 'ORGANICO'` nao aceito | 754 |
| Outros erros (evento invalido, lead_id vazio) | 100 |

Sao **366 leads distintos** que tiveram pelo menos um envio com erro.

## Solucao em 2 partes

### Parte 1: Corrigir o mapeamento de `origem_tipo`

No arquivo `supabase/functions/disparar-webhook-leads/index.ts`, adicionar uma funcao de mapeamento antes de montar o payload:

```text
SGT (origem)        ->  CRM (destino)
-----------------------------------------
MANUAL              ->  OUTBOUND
PAGO                ->  INBOUND
ORGANICO            ->  INBOUND
INBOUND             ->  INBOUND (sem mudanca)
OUTBOUND            ->  OUTBOUND (sem mudanca)
REFERRAL            ->  REFERRAL (sem mudanca)
PARTNER             ->  PARTNER (sem mudanca)
qualquer outro      ->  INBOUND (fallback seguro)
```

A linha 330 que hoje envia `origem_tipo: lead.origem_tipo || undefined` passara a usar a funcao de mapeamento para garantir que apenas valores aceitos pelo CRM sejam enviados.

### Parte 2: Replay dos leads rejeitados

A funcao `disparar-webhook-leads` ja aceita o parametro `lead_ids` no body para disparo imediato (sem filtro de score). O plano e:

1. Consultar os leads distintos que tiveram erro 400 no log
2. Chamar a funcao com esses `lead_ids` em lotes de 50 (limite da funcao)
3. Os leads serao reenviados com o mapeamento corrigido

Para isso, sera criado um script de replay **temporario** dentro da propria funcao, acionavel via parametro `replay_erros: true` no body da requisicao. Ao receber esse parametro:
- Busca os `id_lead` distintos da tabela `lead_webhook_log` onde `status = 'erro'` e `status_code = 400`
- Processa em lotes de 50
- Envia cada lead com o mapeamento corrigido

### Arquivo alterado

- `supabase/functions/disparar-webhook-leads/index.ts`
  - Adicionar funcao `mapearOrigemTipo()` para converter valores do SGT para valores aceitos pelo CRM
  - Usar essa funcao na linha 330 ao montar `dados_lead.origem_tipo`
  - Adicionar logica de replay quando `body.replay_erros === true`

### Como executar o replay

Apos o deploy, basta chamar a funcao uma vez:

```text
POST disparar-webhook-leads
Body: { "replay_erros": true }
```

A funcao vai identificar automaticamente os leads com erro e reenviar todos com o payload corrigido.
