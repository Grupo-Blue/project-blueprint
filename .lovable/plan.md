

# Webhook para receber leads de Landing Pages (Elementor)

## Resumo

Criar a edge function `lp-lead-webhook` que recebe formularios de landing pages, cria ou atualiza leads e enriquece com dados de tracking (UTMs, Facebook Pixel, Google Ads).

## O que sera feito

1. **Nova edge function** `lp-lead-webhook` (publica, sem autenticacao)
2. **Migracoes de banco** para adicionar colunas de tracking e CPF no lead
3. **Mapeamento automatico de empresa** via `pipeline_id` (pipeline 5 = Blue, pipeline 9 = Tokeniza)

## Detalhes do processamento

### Parsing do payload

O payload vem no formato `fields[campo][value]`, sera parseado para extrair:
- Dados pessoais: `name`, `email`, `phone`, `cpf`
- Dados comerciais: `prefix`, `pipeline_id`, `stage_id`, `channel`, `value`
- UTMs: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Tracking: `fbp`, `fbc`, `fbclid`, `gclid`, `gbraid`, `gad_source`

### Mapeamento de empresa

Usar o `pipeline_id` para identificar a empresa:
- Consultar leads existentes que tem aquele `pipeline_id` e pegar o `id_empresa`
- Manter uma tabela de fallback (pipeline_id 5 = Blue, 9 = Tokeniza)
- Se nao encontrar, retornar erro 400

### Logica de lead (upsert)

1. Buscar lead por email ou telefone (nessa ordem) na empresa mapeada
2. Se existir: atualizar campos vazios (nome, UTMs, tracking, CPF, prefix)
3. Se nao existir: criar lead novo com:
   - `origem_tipo`: PAGO
   - `origem_canal`: OUTRO (sera ajustado conforme UTM se disponivel)
   - `stage_atual`: valor do `prefix` (ex: "LP-Prejuizo-Cripto")
   - `pipeline_id`: do payload
   - `valor_venda`: campo `value` do payload

### Enriquecimento

Todos os campos de tracking serao salvos no lead:
- UTMs nas colunas existentes (`utm_source`, `utm_medium`, etc.)
- `fbp`, `fbc`, `gclid`, `gbraid` em novas colunas dedicadas
- `cpf` em nova coluna

### Webhook SDR

Apos criar/atualizar, disparar `disparar-webhook-leads` para notificar o CRM (igual ao fluxo do Mautic webhook).

## Migracoes de banco

Adicionar colunas na tabela `lead`:
- `cpf` (text, nullable)
- `fbp` (text, nullable) - Facebook Browser ID do formulario
- `fbc` (text, nullable) - Facebook Click ID
- `gclid` (text, nullable) - Google Click ID
- `gbraid` (text, nullable) - Google Broad Match ID
- `lp_prefix` (text, nullable) - Identificador da LP/oferta

Criar tabela `pipeline_empresa_mapa` para mapeamento fixo:
- `pipeline_id` (text, PK)
- `id_empresa` (uuid, FK para empresa)

Inserir mapeamentos iniciais (pipeline 5 = Blue, 9 = Tokeniza).

## Detalhes tecnicos

### Arquivo novo

`supabase/functions/lp-lead-webhook/index.ts`

### Config

Adicionar ao `supabase/config.toml`:
```text
[functions.lp-lead-webhook]
verify_jwt = false
```

### Fluxo resumido

```text
POST /lp-lead-webhook
  |
  +-- Parsear fields[...][value] do body
  +-- Validar email ou phone presente
  +-- Mapear pipeline_id -> id_empresa (via pipeline_empresa_mapa)
  +-- Buscar lead existente por email/telefone
  +-- Criar ou atualizar lead com todos os dados
  +-- Disparar webhook SDR (se lead novo ou relevante)
  +-- Retornar { success, lead_id, is_novo }
```

### Seguranca

O endpoint e publico (sem auth) pois recebe submissions de formularios web. Para mitigar abuso:
- Validacao de campos obrigatorios (email ou telefone)
- Nenhuma operacao destrutiva (apenas insert/update)
- Service role key usado internamente para contornar RLS

### Resposta

```text
{ success: true, lead_id: "uuid", is_novo: true/false, empresa: "Blue" }
```
