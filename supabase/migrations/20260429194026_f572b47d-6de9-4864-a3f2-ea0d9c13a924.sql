SELECT cron.unschedule('monitorar-pasta-irpf-batch');

SELECT cron.schedule(
  'monitorar-pasta-irpf-batch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/monitorar-pasta-irpf',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuc3puYm1tcWhpaHdjdGd1dnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTk1MDEsImV4cCI6MjA3OTI5NTUwMX0.9q-LOyqhnhk-Ns3rbFJWA3pEUBg3CDPsW3KjTWPuvpM'
    ),
    body := '{"batch_size": 5}'::jsonb
  ) AS request_id;
  $$
);