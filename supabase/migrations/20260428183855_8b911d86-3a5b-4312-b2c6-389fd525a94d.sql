CREATE TABLE public.organization_api_usage_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  api_key_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_log_org_created ON public.organization_api_usage_log (organization_id, created_at DESC);
CREATE INDEX idx_api_usage_log_created ON public.organization_api_usage_log (created_at);

ALTER TABLE public.organization_api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins podem ver logs de uso da API"
  ON public.organization_api_usage_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "SuperAdmins podem gerenciar logs de uso da API"
  ON public.organization_api_usage_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.cleanup_api_usage_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.organization_api_usage_log
  WHERE created_at < now() - interval '30 days';
$$;