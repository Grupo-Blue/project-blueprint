SELECT cron.schedule(
  'monitorar-pasta-irpf-batch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.service_url') || '/functions/v1/monitorar-pasta-irpf',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"batch_size": 5}'::jsonb
  ) AS request_id;
  $$
);