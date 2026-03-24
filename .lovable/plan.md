

# Extração de Leads Frios via Apify

## O que será construído

Uma nova página **"Extração de Leads"** (`/extracao-leads`) no SGT que permite configurar e executar scrapers do Apify para gerar listas frias de leads. O usuário seleciona o tipo de extração, configura os parâmetros e recebe os resultados em uma tabela com opção de exportar CSV ou importar direto para a base de leads via `criar-lead-api`.

## Tipos de extração suportados (Apify Actors)

1. **Seguidores Instagram** — Actor `apify/instagram-profile-scraper` → extrai seguidores de um perfil (nome, bio, email se público)
2. **Seguidores LinkedIn Company** — Actor `anchor/linkedin-company-scraper` → extrai funcionários/seguidores de uma empresa
3. **Busca LinkedIn por cargo** — Actor `anchor/linkedin-people-search` → busca pessoas por cargo + localização + setor
4. **Seguidores Facebook Page** — Actor `apify/facebook-pages-scraper` → extrai curtidores/seguidores

## Arquitetura

```text
┌─────────────────────┐
│  Página Frontend    │
│  /extracao-leads    │
│                     │
│  [Tipo] [Params]    │
│  [Iniciar Extração] │
│        │            │
│        ▼            │
│  Edge Function      │
│  extrair-leads-apify│
│    ├─ Inicia Actor  │
│    ├─ Retorna runId │
│        │            │
│        ▼            │
│  Polling status     │
│  (mesmo padrão da   │
│   análise competit.)│
│        │            │
│        ▼            │
│  Tabela resultados  │
│  [Exportar CSV]     │
│  [Importar p/ SGT]  │
└─────────────────────┘
```

## Componentes

### 1. Tabela `extracao_lead_frio` (nova)
- `id` (uuid PK)
- `id_empresa` (uuid FK empresa)
- `criado_por` (uuid FK auth.users)
- `tipo_extracao` (text: INSTAGRAM_FOLLOWERS, LINKEDIN_SEARCH, LINKEDIN_COMPANY, FACEBOOK_PAGE)
- `parametros` (jsonb — perfil alvo, cargo, localização etc.)
- `status` (text: PENDENTE, EXECUTANDO, CONCLUIDO, ERRO)
- `apify_run_id` (text)
- `total_resultados` (int)
- `resultados` (jsonb — array de leads extraídos)
- `created_at`, `updated_at`
- RLS: usuário vê apenas suas extrações + admin vê todas

### 2. Edge Function `extrair-leads-apify`
- Recebe tipo + parâmetros
- Mapeia para o Actor correto do Apify
- Inicia o run e salva na tabela com status PENDENTE
- Retorna `id` da extração

### 3. Edge Function `verificar-extracao-leads` 
- Recebe `id` da extração
- Consulta status no Apify
- Se SUCCEEDED: parseia resultados, salva na tabela, retorna dados
- Mesmo padrão de polling já usado em `verificar-coleta-concorrentes`

### 4. Página `ExtracaoLeads.tsx`
- Formulário com select do tipo de extração
- Campos dinâmicos por tipo (ex: URL do perfil, cargo, localização)
- Histórico de extrações anteriores
- Tabela de resultados com nome, email, cargo, empresa
- Botões: **Exportar CSV** e **Importar para SGT** (chama `criar-lead-api` em lote)

### 5. Rota + Sidebar
- Rota `/extracao-leads` no App.tsx
- Link na sidebar em seção de ferramentas/leads

## Detalhes técnicos

- Os Actors do Apify são chamados com a `APIFY_API_TOKEN` já configurada
- O padrão assíncrono (start → poll → collect) reutiliza a mesma lógica do monitoramento de concorrentes
- Resultados ficam armazenados em JSONB para flexibilidade (cada actor retorna schema diferente)
- A importação para o SGT usa o endpoint `criar-lead-api` com `origem_canal = "SCRAPING"` e os UTMs zerados

