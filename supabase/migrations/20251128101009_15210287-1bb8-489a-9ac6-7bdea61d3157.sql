
-- Limpar cronjobs existentes
DO $$ 
BEGIN
  PERFORM cron.unschedule(jobname) 
  FROM cron.job 
  WHERE jobname LIKE 'invoke-%';
END $$;

-- Importar campanhas Meta (4h00)
SELECT cron.schedule(
  'invoke-importar-campanhas-meta',
  '0 4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/importar-campanhas-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Importar campanhas Google (4h15)
SELECT cron.schedule(
  'invoke-importar-campanhas-google',
  '15 4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/importar-campanhas-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar métricas Meta Ads (4h30)
SELECT cron.schedule(
  'invoke-coletar-metricas-meta',
  '30 4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar métricas Google Ads (4h45)
SELECT cron.schedule(
  'invoke-coletar-metricas-google',
  '45 4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-metricas-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar criativos Meta (5h00)
SELECT cron.schedule(
  'invoke-coletar-criativos-meta',
  '0 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-criativos-meta',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Coletar criativos Google (5h15)
SELECT cron.schedule(
  'invoke-coletar-criativos-google',
  '15 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/coletar-criativos-google',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Sincronizar Pipedrive (5h30)
SELECT cron.schedule(
  'invoke-sincronizar-pipedrive',
  '30 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/sincronizar-pipedrive',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Sincronizar Tokeniza (5h45)
SELECT cron.schedule(
  'invoke-sincronizar-tokeniza',
  '45 5 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/sincronizar-tokeniza',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Enriquecer leads em lote (6h00)
SELECT cron.schedule(
  'invoke-enriquecer-leads-lote',
  '0 6 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/enriquecer-leads-lote',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM"}'::jsonb,
    body:='{"id_empresa": "4ab6f9be-aed2-4d25-a869-d7c51e0e6ee2"}'::jsonb
  );
  $$
);
