
CREATE OR REPLACE FUNCTION public.sign_document_adhoc(
  p_documento_id uuid,
  p_versao_id uuid,
  p_hash text,
  p_certificado jsonb,
  p_intent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid := auth.uid();
  v_next_ordem integer;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.ged_documents
  WHERE id = p_documento_id AND status <> 'deleted';

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'document-not-found';
  END IF;

  IF NOT (
    public.has_role(v_user, 'super_admin'::app_role)
    OR public.get_user_org_id(v_user) = v_org
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_next_ordem
  FROM public.documento_assinatura
  WHERE documento_id = p_documento_id;

  INSERT INTO public.documento_assinatura (
    organization_id, documento_id, versao_id, ordem,
    perfil_assinante_id, assinante_id,
    tipo_assinatura, assinatura_obrigatoria, status,
    assinado_em, hash_evidencia, certificado_info
  ) VALUES (
    v_org, p_documento_id, p_versao_id, v_next_ordem,
    NULL, v_user,
    'QUALIFICADA'::tipo_assinatura, false, 'ASSINADA'::status_assinatura,
    now(),
    p_hash,
    COALESCE(p_certificado, '{}'::jsonb) || jsonb_build_object('intent', p_intent, 'adhoc', true)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_document_adhoc(uuid, uuid, text, jsonb, text) TO authenticated;
