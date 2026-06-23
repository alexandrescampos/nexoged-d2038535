
-- ============================================================
-- 1. APP ENCRYPTION KEY (Vault)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'app_encryption_key') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'app_encryption_key');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._app_enc_key()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_encryption_key' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._app_enc_key() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. ENCRYPT GOOGLE DRIVE TOKENS
-- ============================================================
ALTER TABLE public.organization_google_drive_connections
  ADD COLUMN IF NOT EXISTS access_token_enc bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_enc bytea;

UPDATE public.organization_google_drive_connections
SET access_token_enc = CASE WHEN access_token IS NOT NULL
        THEN extensions.pgp_sym_encrypt(access_token, public._app_enc_key()) END,
    refresh_token_enc = CASE WHEN refresh_token IS NOT NULL
        THEN extensions.pgp_sym_encrypt(refresh_token, public._app_enc_key()) END
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

ALTER TABLE public.organization_google_drive_connections
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;

-- RPCs (service_role only)
CREATE OR REPLACE FUNCTION public.gdrive_get_connection(p_org_id uuid)
RETURNS TABLE(
  organization_id uuid, status text, token_expires_at timestamptz,
  scope text, access_token text, refresh_token text,
  google_email text, google_display_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.organization_id, c.status, c.token_expires_at, c.scope,
         extensions.pgp_sym_decrypt(c.access_token_enc, public._app_enc_key()),
         extensions.pgp_sym_decrypt(c.refresh_token_enc, public._app_enc_key()),
         c.google_email, c.google_display_name
  FROM public.organization_google_drive_connections c
  WHERE c.organization_id = p_org_id
$$;
REVOKE ALL ON FUNCTION public.gdrive_get_connection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdrive_get_connection(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gdrive_upsert_connection(
  p_org_id uuid, p_connected_by uuid,
  p_google_email text, p_google_display_name text, p_google_photo_url text,
  p_access_token text, p_refresh_token text,
  p_token_expires_at timestamptz, p_scope text, p_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_google_drive_connections
    (organization_id, connected_by, google_email, google_display_name, google_photo_url,
     access_token_enc, refresh_token_enc, token_expires_at, scope, status, updated_at)
  VALUES (p_org_id, p_connected_by, p_google_email, p_google_display_name, p_google_photo_url,
     extensions.pgp_sym_encrypt(p_access_token, public._app_enc_key()),
     extensions.pgp_sym_encrypt(p_refresh_token, public._app_enc_key()),
     p_token_expires_at, p_scope, COALESCE(p_status,'active'), now())
  ON CONFLICT (organization_id) DO UPDATE SET
    connected_by = EXCLUDED.connected_by,
    google_email = EXCLUDED.google_email,
    google_display_name = EXCLUDED.google_display_name,
    google_photo_url = EXCLUDED.google_photo_url,
    access_token_enc = EXCLUDED.access_token_enc,
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    token_expires_at = EXCLUDED.token_expires_at,
    scope = EXCLUDED.scope,
    status = EXCLUDED.status,
    last_error = NULL,
    updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.gdrive_upsert_connection(uuid,uuid,text,text,text,text,text,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdrive_upsert_connection(uuid,uuid,text,text,text,text,text,timestamptz,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gdrive_update_access_token(
  p_org_id uuid, p_access_token text, p_token_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.organization_google_drive_connections
  SET access_token_enc = extensions.pgp_sym_encrypt(p_access_token, public._app_enc_key()),
      token_expires_at = p_token_expires_at,
      last_error = NULL,
      status = 'active',
      updated_at = now()
  WHERE organization_id = p_org_id;
END $$;
REVOKE ALL ON FUNCTION public.gdrive_update_access_token(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdrive_update_access_token(uuid,text,timestamptz) TO service_role;

-- ============================================================
-- 3. ENCRYPT organization_integrations.credentials
-- ============================================================
ALTER TABLE public.organization_integrations
  ADD COLUMN IF NOT EXISTS credentials_enc bytea;

UPDATE public.organization_integrations
SET credentials_enc = CASE WHEN credentials IS NOT NULL
  THEN extensions.pgp_sym_encrypt(credentials::text, public._app_enc_key()) END
WHERE credentials IS NOT NULL;

ALTER TABLE public.organization_integrations DROP COLUMN credentials;

CREATE OR REPLACE FUNCTION public.integrations_get_credentials(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_enc bytea;
BEGIN
  SELECT organization_id, credentials_enc INTO v_org, v_enc
    FROM public.organization_integrations WHERE id = p_id;
  IF v_org IS NULL THEN RETURN NULL; END IF;
  IF NOT (public.has_role(auth.uid(),'super_admin')
       OR public.has_role_in_org(auth.uid(),'org_admin', v_org)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_enc IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(v_enc, public._app_enc_key())::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.integrations_get_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integrations_get_credentials(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.integrations_set_credentials(p_id uuid, p_credentials jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.organization_integrations WHERE id = p_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.has_role(auth.uid(),'super_admin')
       OR public.has_role_in_org(auth.uid(),'org_admin', v_org)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.organization_integrations
  SET credentials_enc = CASE WHEN p_credentials IS NULL THEN NULL
       ELSE extensions.pgp_sym_encrypt(p_credentials::text, public._app_enc_key()) END,
      updated_at = now()
  WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.integrations_set_credentials(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integrations_set_credentials(uuid,jsonb) TO authenticated, service_role;

-- ============================================================
-- 4. ged_document_shares: hide password_hash from org members
-- ============================================================
REVOKE SELECT ON public.ged_document_shares FROM authenticated;
GRANT SELECT (id, organization_id, document_id, version_id, token,
              expires_at, max_downloads, download_count, revoked, created_by, created_at)
  ON public.ged_document_shares TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ged_document_shares TO authenticated;

-- ============================================================
-- 5. fluxo_aprovacao_etapa: tighten USING to admins
-- ============================================================
DROP POLICY IF EXISTS fluxo_etapa_all ON public.fluxo_aprovacao_etapa;
CREATE POLICY fluxo_etapa_select ON public.fluxo_aprovacao_etapa
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fluxo_aprovacao f
    WHERE f.id = fluxo_aprovacao_etapa.fluxo_id
      AND (public.has_role(auth.uid(),'super_admin')
           OR f.organization_id = public.get_user_org_id(auth.uid()))
  ));
CREATE POLICY fluxo_etapa_modify ON public.fluxo_aprovacao_etapa
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fluxo_aprovacao f
    WHERE f.id = fluxo_aprovacao_etapa.fluxo_id
      AND (public.has_role(auth.uid(),'super_admin')
           OR public.has_role_in_org(auth.uid(),'org_admin', f.organization_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fluxo_aprovacao f
    WHERE f.id = fluxo_aprovacao_etapa.fluxo_id
      AND (public.has_role(auth.uid(),'super_admin')
           OR public.has_role_in_org(auth.uid(),'org_admin', f.organization_id))
  ));

-- ============================================================
-- 6. ged_audit_log: only service_role can INSERT directly
-- ============================================================
DROP POLICY IF EXISTS "Only service role and admins can insert audit logs" ON public.ged_audit_log;
-- No INSERT policy for authenticated -> writes only via SECURITY DEFINER functions or service_role.
