
CREATE TABLE public.ged_document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.ged_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.ged_document_versions(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INT,
  download_count INT NOT NULL DEFAULT 0,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ged_doc_shares_doc ON public.ged_document_shares(document_id);
CREATE INDEX idx_ged_doc_shares_org ON public.ged_document_shares(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ged_document_shares TO authenticated;
GRANT ALL ON public.ged_document_shares TO service_role;
ALTER TABLE public.ged_document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view shares" ON public.ged_document_shares
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Org members create shares" ON public.ged_document_shares
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Org members update own shares" ON public.ged_document_shares
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Org members delete shares" ON public.ged_document_shares
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.create_document_share(
  p_document_id UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_max_downloads INT DEFAULT NULL,
  p_password TEXT DEFAULT NULL
) RETURNS public.ged_document_shares
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_doc public.ged_documents;
  v_token TEXT;
  v_row public.ged_document_shares;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_doc FROM public.ged_documents WHERE id = p_document_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  IF v_doc.organization_id <> public.get_user_org_id(auth.uid())
     AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  IF p_password IS NOT NULL AND length(p_password) > 0 THEN
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  END IF;

  INSERT INTO public.ged_document_shares(
    organization_id, document_id, version_id, token, password_hash,
    expires_at, max_downloads, created_by
  ) VALUES (
    v_doc.organization_id, p_document_id, v_doc.current_version_id, v_token, v_hash,
    p_expires_at, p_max_downloads, auth.uid()
  ) RETURNING * INTO v_row;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_doc.organization_id, p_document_id, auth.uid(), 'share_link_created',
    jsonb_build_object('share_id', v_row.id, 'expires_at', p_expires_at, 'max_downloads', p_max_downloads));

  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.validate_document_share(p_token TEXT, p_password TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_share public.ged_document_shares;
  v_version public.ged_document_versions;
  v_doc public.ged_documents;
BEGIN
  SELECT * INTO v_share FROM public.ged_document_shares WHERE token = p_token;
  IF v_share.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF v_share.revoked THEN RETURN jsonb_build_object('ok',false,'error','revoked'); END IF;
  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN jsonb_build_object('ok',false,'error','expired');
  END IF;
  IF v_share.max_downloads IS NOT NULL AND v_share.download_count >= v_share.max_downloads THEN
    RETURN jsonb_build_object('ok',false,'error','limit_reached');
  END IF;
  IF v_share.password_hash IS NOT NULL THEN
    IF p_password IS NULL OR extensions.crypt(p_password, v_share.password_hash) <> v_share.password_hash THEN
      RETURN jsonb_build_object('ok',false,'error','password_required');
    END IF;
  END IF;

  SELECT * INTO v_doc FROM public.ged_documents WHERE id = v_share.document_id;
  SELECT * INTO v_version FROM public.ged_document_versions
    WHERE id = COALESCE(v_share.version_id, v_doc.current_version_id)
    LIMIT 1;
  IF v_version.id IS NULL THEN
    SELECT * INTO v_version FROM public.ged_document_versions
      WHERE document_id = v_share.document_id
      ORDER BY version_number DESC LIMIT 1;
  END IF;
  IF v_version.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_file'); END IF;

  UPDATE public.ged_document_shares SET download_count = download_count + 1 WHERE id = v_share.id;

  INSERT INTO public.ged_audit_log(organization_id, document_id, user_id, action, details)
  VALUES (v_share.organization_id, v_share.document_id, NULL, 'share_link_accessed',
    jsonb_build_object('share_id', v_share.id));

  RETURN jsonb_build_object(
    'ok', true,
    'file_path', v_version.file_path,
    'file_name', v_version.file_name,
    'mime_type', v_version.mime_type,
    'title', v_doc.title
  );
END $$;
