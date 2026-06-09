
-- Extensions for scheduling the weekly sync
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Official CAEPI database mirror (global, shared by all organizations)
CREATE TABLE public.caepi_certificates (
  ca_number text PRIMARY KEY,
  expiration_date date,
  status text,
  equipment_name text,
  equipment_description text,
  protection_nature text,
  manufacturer_name text,
  manufacturer_cnpj text,
  process_number text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_caepi_certificates_expiration ON public.caepi_certificates(expiration_date);
CREATE INDEX idx_caepi_certificates_status ON public.caepi_certificates(status);

ALTER TABLE public.caepi_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read CAEPI"
  ON public.caepi_certificates
  FOR SELECT
  TO authenticated
  USING (true);

-- Sync log
CREATE TABLE public.caepi_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  total_records integer,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron'
);

CREATE INDEX idx_caepi_sync_log_started_at ON public.caepi_sync_log(started_at DESC);

ALTER TABLE public.caepi_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins can read sync log"
  ON public.caepi_sync_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
