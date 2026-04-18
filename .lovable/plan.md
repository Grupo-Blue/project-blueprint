

## Plano — Paginação na lista de leads + esclarecer o "Disparar WhatsApp"

### 1. O que o "Disparar WhatsApp" faz hoje (resposta direta)

Olhando a edge function `disparar-segmento-whatsapp` que é chamada pelo botão:

1. Pega o segmento e busca todos os membros com telefone válido (≥10 dígitos).
2. Cria um registro na tabela **`disparo_whatsapp`** com `enviado: false`, contendo nome, empresa, qtd de leads e os filtros aplicados.
3. Vincula os leads ao disparo na tabela **`disparo_whatsapp_lead`** (em lotes de 500).
4. Retorna sucesso com a contagem de leads com telefone.

**Importante:** ele **NÃO envia mensagens** pelo WhatsApp. Apenas **cria a fila de disparo** (`enviado: false`) que precisa ser consumida por um sistema externo (a edge function `whatsapp-disparo-webhook` recebe o callback `campaign.dispatched` desse sistema externo quando ele de fato envia).

Ou seja, o botão hoje funciona como "preparar lista de disparo" e não como "enviar agora". Vou deixar isso claro na UI ajustando o texto do toast e o label do botão (ex: "Preparar disparo WhatsApp") para evitar confusão.

### 2. Por que aparecem só 100 leads mesmo tendo 137

Em `src/pages/Segmentos.tsx`, linha 91:
```ts
.eq("id_segmento", selectedSegmento)
.is("removido_em", null)
.limit(100);   // ← cap fixo
```

A query da lista de membros está fixa em 100. O badge "X leads" no card vem de uma query separada com `count: "exact"` (137), mas a tabela só recebe 100. Por isso o descasamento.

### 3. Adicionar paginação na lista de leads do segmento

**Em `src/pages/Segmentos.tsx`:**

- Adicionar estado `paginaMembros` (default 1) e constante `PAGE_SIZE = 50`.
- Substituir `.limit(100)` por `.range((paginaMembros - 1) * PAGE_SIZE, paginaMembros * PAGE_SIZE - 1)`.
- Mudar a query para retornar `{ data, count }` usando `select(..., { count: 'exact' })`.
- Resetar `paginaMembros` para 1 sempre que `selectedSegmento` mudar.
- Renderizar o componente `Pagination` (já existe em `src/components/ui/pagination.tsx`) abaixo da tabela com:
  - Botões Anterior / Próxima
  - Indicador "Página X de Y" e "Mostrando A–B de N"
  - Desabilitar Anterior na página 1 e Próxima na última
- Atualizar o badge no `CardTitle` para mostrar o total real (`count`) em vez de `membros?.length`.

### 4. Esclarecer o fluxo do botão WhatsApp na UI

- Renomear o item no dropdown e botão de "Disparar WhatsApp" → **"Preparar Disparo WhatsApp"**.
- Atualizar o toast de sucesso para: *"Lista de disparo criada com X leads. Aguardando envio pelo sistema externo."*
- Adicionar um tooltip pequeno explicando: "Cria a lista na fila `disparo_whatsapp`. O envio efetivo é feito pelo sistema externo de mensageria."

### Arquivos alterados
- `src/pages/Segmentos.tsx` — paginação + textos do botão WhatsApp

### Não vai mudar
- Edge functions (`disparar-segmento-whatsapp` e `whatsapp-disparo-webhook`) — o fluxo backend já está correto, é só a UI que estava ambígua.

