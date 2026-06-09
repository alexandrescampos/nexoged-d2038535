
-- 1. Add created_by to profiles
ALTER TABLE public.profiles ADD COLUMN created_by uuid;

-- 2. Create user_audit_log table
CREATE TABLE public.user_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  performed_by uuid,
  organization_id uuid,
  action text NOT NULL,
  source text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "SuperAdmins podem ver todos os logs"
ON public.user_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem ver logs da org"
ON public.user_audit_log FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Managers podem ver seus próprios logs"
ON public.user_audit_log FOR SELECT
TO authenticated
USING (target_user_id = auth.uid() AND has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "SuperAdmins podem inserir logs"
ON public.user_audit_log FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "OrgAdmins podem inserir logs da org"
ON public.user_audit_log FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- Service role bypass for edge functions (no policy needed, service role bypasses RLS)

-- 5. Indexes
CREATE INDEX idx_audit_log_target_user ON public.user_audit_log(target_user_id);
CREATE INDEX idx_audit_log_organization ON public.user_audit_log(organization_id);
CREATE INDEX idx_audit_log_created_at ON public.user_audit_log(created_at);

-- 6. Update handle_new_user() to log self-signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_audit_log (target_user_id, performed_by, action, source, details)
  VALUES (
    NEW.id,
    NEW.id,
    'created',
    'self-signup',
    jsonb_build_object('email', NEW.email, 'full_name', COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email))
  );

  RETURN NEW;
END;
$$;
