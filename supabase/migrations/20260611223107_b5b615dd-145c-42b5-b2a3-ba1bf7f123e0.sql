
-- Table: organization_google_drive_connections
CREATE TABLE public.organization_google_drive_connections (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  google_email text NOT NULL,
  google_display_name text,
  google_photo_url text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NO grants to authenticated/anon — tokens are server-only.
GRANT ALL ON public.organization_google_drive_connections TO service_role;

ALTER TABLE public.organization_google_drive_connections ENABLE ROW LEVEL SECURITY;

-- Even though no grants are issued, add a deny policy for clarity.
CREATE POLICY "service_role only" ON public.organization_google_drive_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_org_gdrive_updated_at
  BEFORE UPDATE ON public.organization_google_drive_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OAuth state (CSRF protection + nonce store)
CREATE TABLE public.google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  redirect_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only states" ON public.google_oauth_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Status function for the UI (only safe fields). Admins of the org / super_admin.
CREATE OR REPLACE FUNCTION public.get_org_gdrive_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.organization_google_drive_connections;
  v_connector_name text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin')
          OR public.has_role_in_org(auth.uid(),'org_admin', p_org_id)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_row
    FROM public.organization_google_drive_connections
    WHERE organization_id = p_org_id;

  IF v_row.organization_id IS NULL THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  SELECT full_name INTO v_connector_name FROM public.profiles WHERE id = v_row.connected_by;

  RETURN jsonb_build_object(
    'connected', v_row.status = 'active',
    'status', v_row.status,
    'email', v_row.google_email,
    'display_name', v_row.google_display_name,
    'photo_url', v_row.google_photo_url,
    'scope', v_row.scope,
    'connected_by_name', v_connector_name,
    'connected_at', v_row.created_at,
    'last_used_at', v_row.last_used_at,
    'last_error', v_row.last_error,
    'token_expires_at', v_row.token_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_gdrive_status(uuid) TO authenticated;

-- Lightweight check for any authenticated user of the org
CREATE OR REPLACE FUNCTION public.org_has_active_gdrive(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_google_drive_connections
    WHERE organization_id = p_org_id AND status = 'active'
  ) AND (
    public.get_user_org_id(auth.uid()) = p_org_id
    OR public.has_role(auth.uid(),'super_admin')
  )
$$;

GRANT EXECUTE ON FUNCTION public.org_has_active_gdrive(uuid) TO authenticated;
