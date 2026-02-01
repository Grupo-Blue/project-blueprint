# Changelog - SGT (Sistema de Gestão de Tráfego)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Phase 2] - 2025-02-01

### Added

- **Pipedrive Activities Sync**: Nova edge function `sincronizar-pipedrive-activities`
  - Sincroniza activities do Pipedrive (GET /v1/deals/{id}/activities) para tabela `pipedrive_activity`
  - Sincroniza notes do Pipedrive (GET /v1/notes?deal_id={id}) para tabela `pipedrive_note`
  - Vincula automaticamente com leads via `id_lead_externo`
  - Rastreia status de conclusão e timestamps de atividades

- **Automated Alerts Engine**: Nova edge function `detectar-alertas-automaticos`
  - Detecta CPL acima do limite por 3+ dias → Alerta WARNING
  - Detecta CAC acima do limite por 2+ semanas → Alerta CRITICAL
  - Detecta campanhas sem impressões há mais de 24h → Alerta WARNING
  - Detecta leads sem follow-up há mais de 48h → Alerta INFO
  - Dispara automaticamente emails de alerta via `alertar-integracoes-email`
  - Salva todos os alertas na tabela `alerta_automatico`

### Changed

- **Meta Ads API Upgrade**: Atualizado de v18.0 para v22.0
  - Adicionados novos campos: `reach`, `frequency`, `video_play_actions`, `video_avg_time_watched_actions`, `website_ctr`, `inline_link_clicks`
  - Métricas expandidas para melhor análise de campanhas

- **Google Ads API Enhancement**: Campos extras adicionados na query GAQL
  - Novos campos: `average_cpc`, `search_impression_share`, `segments.device`, `segments.ad_network_type`, `segments.conversion_action_name`
  - Melhora na granularidade dos dados coletados

### Fixed

- **Schema Migration Alignment**: Todas as edge functions atualizadas para usar `integracao.id_empresa` (coluna real)
  - Antes: `config.id_empresa` (JSON)
  - Depois: `integracao.id_empresa` (coluna)
  - Funções afetadas (21 arquivos):
    - `atualizar-preview-criativos`
    - `chatwoot-webhook`
    - `coletar-criativos-google`
    - `coletar-criativos-meta`
    - `coletar-metricas-ga4`
    - `coletar-metricas-google-historico`
    - `coletar-metricas-google`
    - `coletar-metricas-meta-historico`
    - `coletar-metricas-meta`
    - `enriquecer-campanhas-metricool`
    - `enriquecer-lead-mautic`
    - `importar-campanhas-google`
    - `importar-campanhas-meta`
    - `monitorar-pasta-irpf`
    - `pipedrive-webhook`
    - `recoletar-criativos-historicos`
    - `sincronizar-emails-pipedrive`
    - `sincronizar-metricool`
    - `sincronizar-pipedrive`
    - `sincronizar-telefones-pipedrive`
    - `sincronizar-tokeniza`

## [Phase 1] - 2025-01-XX

### Added
- Migrações SQL aplicadas: `id_empresa` tornou-se coluna real na tabela `integracao`
- Sistema de email implementado com Resend

### Changed
- Estrutura do banco de dados otimizada para suportar filtros diretos por empresa
