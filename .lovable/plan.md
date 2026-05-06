## Objetivo

Adicionar IA ao Gerador de UTMs em `/guia-utm` para autopreencher o formulário a partir de um link + descrição livre, e oferecer **autocomplete por empresa** com base nos UTMs já usados (histórico de `utm_link` da empresa).

## Mudanças

### 1. Edge function `sugerir-utm` (nova)
- Path: `supabase/functions/sugerir-utm/index.ts`
- Auth: JWT obrigatório (padrão), valida `id_empresa` contra `user_empresa` / role admin.
- Input: `{ id_empresa, url, descricao }`.
- Carrega histórico daquela empresa (últimos ~100 `utm_link`: source/medium/campaign/content/term/canal) para passar como contexto.
- Chama Lovable AI (`google/gemini-3-flash-preview`) via tool calling estruturado, retornando:
  ```
  { url_base, canal, utm_source, utm_medium, utm_campaign,
    utm_content, utm_term, nome_interno, observacoes,
    reaproveitados: { source?: bool, medium?: bool, campaign?: bool, ... } }
  ```
- Prompt instrui a IA a **reutilizar valores já existentes no histórico** quando fizer sentido (mesma campanha, mesmo canal etc.) e só inventar novos quando necessário, mantendo padrão snake_case.

### 2. Componente `GeradorUTM.tsx`
- Novo bloco "Preencher com IA" no topo do card de geração:
  - Campo `Input` para URL (opcional — se vazio, usa `url_base` do form).
  - `Textarea` "Descreva o link (canal, campanha, criativo, contexto…)".
  - Botão "Sugerir com IA" (loading state).
  - Ao receber resposta: aplica os campos no `form` e mostra toast "Sugestão aplicada — revise antes de salvar". Campos preenchidos via histórico ganham um pequeno badge "reaproveitado".
- Hook `useUtmHistorico(id_empresa)`:
  - Query `["utm-historico", id_empresa]` que extrai valores **distintos** de `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `canal` da tabela `utm_link` filtrada por `id_empresa` (já isolada por RLS).
- Trocar os `<Input>` de `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` por um **Combobox** (usando `Command` + `Popover` do shadcn já instalados) que:
  - Mostra a lista de valores já usados na empresa ao focar.
  - Permite digitar valor novo livremente.
  - Filtra conforme digitação.
- Manter validação Zod existente.

### 3. Config
- Adicionar bloco `[functions.sugerir-utm]` em `supabase/config.toml` (mantém `verify_jwt` padrão = true, então não precisa de bloco; só adiciono se necessário). **Não** desativar JWT.

## Notas técnicas

- A função roda dentro do contexto autenticado: inicializa `supabase` com header `Authorization` do request (padrão já usado no projeto) para que RLS de `utm_link` funcione na leitura de histórico.
- IA usa tool calling (`response_format` via `tools` + `tool_choice`) para garantir JSON válido. Tratamento de 429/402 com toast amigável.
- Não cria tabela nova: o "banco de UTMs já usadas" é a própria `utm_link` (já isolada por empresa).
- Sem alteração de schema, sem alteração de RLS.

## Fora de escopo

- Não adiciono página separada de "biblioteca de UTMs" — o autocomplete já cobre a necessidade.
- Não persisto a descrição/prompt do usuário.