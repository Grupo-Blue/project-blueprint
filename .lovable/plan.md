

# Vincular Vendas a Campanhas e Criativos

## Diagnostico Atual

Os numeros revelam o problema:

| Metrica | Quantidade |
|---|---|
| Total de leads com venda | 11.998 |
| Vinculados a criativo (id_criativo) | 21 (0,17%) |
| Com utm_campaign (sem criativo) | 39 (0,33%) |
| Sem vinculo algum | 11.938 (99,5%) |

A pagina de Analise de Campanhas calcula vendas e ROAS usando apenas leads que tem `id_criativo` preenchido. Com apenas 21 de 12 mil vendas visíveis, os cards mostram ROAS praticamente zero para todas as campanhas.

## Causa Raiz

Os leads entram no sistema via Pipedrive (webhook) e Chatblue, mas a maioria **nao carrega UTMs** nem passa pelo fluxo de atribuicao de criativos. O campo `id_criativo` so e preenchido quando o lead tem `utm_content` com o ID do anuncio -- o que raramente acontece para leads de Pipedrive.

## Solucao Proposta: Vinculacao por Campanha (via utm_campaign)

Criar um caminho alternativo de atribuicao: **lead -> campanha** (direto), sem depender do criativo como intermediario.

### Passo 1: Nova coluna na tabela lead

Adicionar `id_campanha_vinculada` (UUID, FK para campanha) na tabela `lead`. Isso permite vincular o lead diretamente a uma campanha, mesmo sem saber o criativo especifico.

### Passo 2: Funcao de vinculacao automatica

Criar uma funcao de banco (trigger ou edge function periodica) que tenta vincular leads sem campanha usando 3 estrategias em cascata:

1. **Via id_criativo** (ja existe): se o lead tem `id_criativo`, herda a campanha do criativo
2. **Via utm_campaign = id_campanha_externo**: match exato do utm com o ID externo da campanha (funciona para Google Ads que usa IDs numericos)  
3. **Via utm_campaign = nome da campanha**: match por nome (funciona para Meta que usa o nome da campanha no UTM)

### Passo 3: Atualizar a query da pagina de Analise

Modificar `RelatorioCreativos.tsx` para buscar vendas de duas fontes:
- Leads vinculados via `id_criativo` (atual)
- Leads vinculados via `id_campanha_vinculada` (novo)

Isso garante que vendas aparecam nos cards mesmo quando nao sabemos qual criativo especifico gerou a venda.

### Passo 4: Indicador visual de atribuicao

Nos cards, mostrar a "confianca" da atribuicao:
- Icone solido: venda atribuida ao criativo especifico
- Icone parcial: venda atribuida a campanha (sem criativo identificado)

---

## Detalhes Tecnicos

### Migracao SQL

```text
-- Nova coluna
ALTER TABLE lead ADD COLUMN id_campanha_vinculada UUID REFERENCES campanha(id_campanha);

-- Indice para performance
CREATE INDEX idx_lead_campanha_vinculada ON lead(id_campanha_vinculada);

-- Preencher retroativamente via criativo
UPDATE lead SET id_campanha_vinculada = cr.id_campanha
FROM criativo cr WHERE lead.id_criativo = cr.id_criativo 
AND lead.id_campanha_vinculada IS NULL;

-- Preencher via utm_campaign = id_campanha_externo
UPDATE lead SET id_campanha_vinculada = c.id_campanha
FROM campanha c WHERE lead.utm_campaign = c.id_campanha_externo
AND lead.id_campanha_vinculada IS NULL AND lead.utm_campaign IS NOT NULL;

-- Preencher via utm_campaign = nome
UPDATE lead SET id_campanha_vinculada = c.id_campanha
FROM campanha c WHERE lead.utm_campaign = c.nome
AND lead.id_campanha_vinculada IS NULL AND lead.utm_campaign IS NOT NULL;
```

### Trigger para novos leads

Criar trigger `AFTER INSERT OR UPDATE` na tabela `lead` que executa a mesma logica de vinculacao automaticamente quando um lead novo chega ou quando `utm_campaign` / `id_criativo` e atualizado.

### Arquivos a modificar

1. **Nova migracao SQL** -- coluna + backfill + trigger
2. **`src/pages/RelatorioCreativos.tsx`** -- alterar a query para buscar leads tambem por `id_campanha_vinculada`, nao so por `id_criativo`
3. **`src/components/campanhas/CampanhaSuperTrunfo.tsx`** -- adicionar indicador de confianca da atribuicao (ex: "12 vendas diretas + 45 vendas da campanha")

### Impacto esperado

- Dos 39 leads com venda que tem `utm_campaign`, cerca de 6-8 ja fazem match com campanhas cadastradas (Google Ads via ID numerico)
- Os 11.938 restantes continuarao sem vinculo ate que o fluxo de UTMs seja corrigido na origem (Meta/Google Ads)
- O ganho imediato e modesto, mas a infraestrutura fica pronta para crescer conforme a qualidade dos UTMs melhora

### Limitacao importante

A grande maioria das vendas (99,5%) nao tem nenhum rastro de campanha. Isso e um problema de **rastreamento na origem** (os links das campanhas nao estao com UTMs configurados, ou o CRM nao repassa essa informacao). A solucao tecnica resolve o que e possivel no banco, mas o salto real vira quando o fluxo de UTMs for padronizado nas campanhas.

