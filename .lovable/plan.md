## Contexto

O SGT ainda tem Pipedrive como cidadão de primeira classe (7 edge functions, 2 tabelas, ~25 arquivos de UI, cron jobs, alertas, validador de integração). A Amélia CRM já é integrada via 4 edge functions do lado de lá (`sgt-sync`, `sgt-webhook`, `sgt-buscar-lead`, `sgt-enrichment-callback`) + do nosso lado `amelia-webhook` e `amelia-cadencia-proxy`. Vamos remover o Pipedrive e deixar a Amélia como CRM único.

## Mudanças

### 1. Edge functions a deletar
- `pipedrive-webhook`
- `sincronizar-pipedrive`
- `sincronizar-pipedrive-activities`
- `sincronizar-emails-pipedrive`
- `sincronizar-telefones-pipedrive`

Limpar referências em `supabase/config.toml`, `README.md`, `mcp-server` e `bot-admin-api`.

### 2. Banco de dados (migração)
- `DROP TABLE pipedrive_note, pipedrive_activity`
- `ALTER TABLE lead DROP COLUMN url_pipedrive`
- Remover qualquer enum/integracao tipo `PIPEDRIVE` da tabela `integracao`
- Remover cron jobs `pg_cron` que disparam funções Pipedrive

### 3. UI — substituir "Pipedrive" por "Amélia CRM"
Arquivos com lógica de exibição/links:
- `LeadIdentidades.tsx`, `LeadCardMobile.tsx` — remover badge/link Pipedrive
- `ConexoesGrid.tsx`, `IntegracaoForms.tsx` — remover card de conexão Pipedrive
- `WebhookDestinosManager.tsx` — remover destino Pipedrive
- `CronjobsMonitor.tsx`, `AlertasCriticos.tsx`, `LeadsOrfaos.tsx`, `PainelAtacarAgora.tsx`, `TempoCiclo.tsx`, `AtualizacaoProgressoModal.tsx`, `AtualizacaoProgressoFloat.tsx`, `DuplicadosLeadsTab.tsx` — remover linhas/cards Pipedrive
- Páginas `Alertas.tsx`, `DashboardTrafego.tsx`, `GuiaUTM.tsx`, `Index.tsx`, `Leads.tsx`, `Integracoes.tsx` — atualizar textos/menus para Amélia CRM

### 4. Integrações de funcionalidades
- `disparar-meta-capi-venda`, `disparar-webhook-leads`, `chatwoot-webhook`, `detectar-alertas-automaticos`, `validar-integracao`, `atualizar-dados-empresa`, `alertar-integracoes-email` — substituir checagens `PIPEDRIVE` por `AMELIA` (já existe enum/integração Amélia no projeto).

### 5. Não vou mexer
- Migrações históricas (.sql antigas) — ficam como estão para preservar histórico
- Secret `PIPEDRIVE_WEBHOOK_SECRET` — deletar via `delete_secret`

## Confirmação necessária

1. Posso **dropar as tabelas** `pipedrive_note` e `pipedrive_activity` (você perde o histórico bruto vindo do Pipedrive — mas leads continuam intactos)?
2. Posso **dropar a coluna** `lead.url_pipedrive`?
3. Quer manter algum atalho/badge legacy para clientes antigos que ainda têm `pipedrive_person_id` no `identidades`, ou pode remover tudo?

Confirma para eu executar?