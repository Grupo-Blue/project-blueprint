
ALTER TABLE public.lead 
  ADD COLUMN IF NOT EXISTS amelia_icp text,
  ADD COLUMN IF NOT EXISTS amelia_persona text,
  ADD COLUMN IF NOT EXISTS amelia_temperatura text,
  ADD COLUMN IF NOT EXISTS amelia_prioridade smallint,
  ADD COLUMN IF NOT EXISTS amelia_score smallint,
  ADD COLUMN IF NOT EXISTS amelia_disc text,
  ADD COLUMN IF NOT EXISTS amelia_health_score smallint,
  ADD COLUMN IF NOT EXISTS amelia_estado_funil text,
  ADD COLUMN IF NOT EXISTS amelia_framework text,
  ADD COLUMN IF NOT EXISTS amelia_updated_at timestamptz;
