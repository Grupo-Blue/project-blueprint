
-- Habilitar extensões necessárias para cronjobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Garantir que o pg_cron possa acessar pg_net
GRANT USAGE ON SCHEMA extensions TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres;

-- Limpar cronjobs existentes para evitar duplicação
DO $$ 
BEGIN
  PERFORM cron.unschedule(jobname) 
  FROM cron.job 
  WHERE jobname LIKE 'invoke-%';
END $$;

-- Importar campanhas Meta (diariamente às 5h)
SELECT cron.schedule(
  'invoke-importar-campanhas-meta',
  '0 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/importar-campanhas-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Importar campanhas Google (diariamente às 5h30)
SELECT cron.schedule(
  'invoke-importar-campanhas-google',
  '30 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/importar-campanhas-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar métricas Meta Ads (diariamente às 6h)
SELECT cron.schedule(
  'invoke-coletar-metricas-meta',
  '0 6 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar métricas Google Ads (diariamente às 6h15)
SELECT cron.schedule(
  'invoke-coletar-metricas-google',
  '15 6 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar criativos Meta (diariamente às 7h)
SELECT cron.schedule(
  'invoke-coletar-criativos-meta',
  '0 7 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-criativos-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar criativos Google (diariamente às 7h15)
SELECT cron.schedule(
  'invoke-coletar-criativos-google',
  '15 7 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-criativos-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Sincronizar Pipedrive (diariamente às 8h)
SELECT cron.schedule(
  'invoke-sincronizar-pipedrive',
  '0 8 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/sincronizar-pipedrive',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Enriquecer leads em lote (diariamente às 9h)
SELECT cron.schedule(
  'invoke-enriquecer-leads-lote',
  '0 9 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/enriquecer-leads-lote',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{"id_empresa": "4ab6f9be-aed2-4d25-a869-d7c51e0e6ee2"}'::jsonb
  );
  $$
);

-- Sincronizar Tokeniza (diariamente às 10h)
SELECT cron.schedule(
  'invoke-sincronizar-tokeniza',
  '0 10 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/sincronizar-tokeniza',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
