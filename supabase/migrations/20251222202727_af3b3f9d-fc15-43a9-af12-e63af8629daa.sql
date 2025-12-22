-- Renomear coluna existente para Account API Key
ALTER TABLE empresa_stape_config 
  RENAME COLUMN stape_api_key TO stape_account_api_key;

-- Adicionar coluna para Container API Key
ALTER TABLE empresa_stape_config 
  ADD COLUMN stape_container_api_key text;

-- Comentários para clareza
COMMENT ON COLUMN empresa_stape_config.stape_account_api_key IS 'Account API Key para acessar API v2 do Stape (estatísticas, containers) - formato: hash simples';
COMMENT ON COLUMN empresa_stape_config.stape_container_api_key IS 'Container API Key para enviar eventos (formato sar:container_id:hash)';