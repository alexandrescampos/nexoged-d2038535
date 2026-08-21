CREATE TABLE public.digital_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_type text NOT NULL CHECK (owner_type IN ('USUARIO','ORGANIZACAO')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  titular_nome text NOT NULL,
  titular_documento text,
  emissor text,
  serial_number text,
  valido_de timestamptz,
  valido_ate timestamptz NOT NULL,
  fingerprint text,
  status text NOT NULL DEFAULT 'valido' CHECK (status IN ('valido','vencido','revogado')),
  pfx_enc bytea NOT NULL,
  senha_enc bytea NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digital_certificates_owner_chk CHECK (
    (owner_type = 'USUARIO' AND user_id IS NOT NULL)
    OR (owner_type = 'ORGANIZACAO' AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX digital_certificates_user_uk
  ON public.digital_certificates (user_id) WHERE owner_type = 'USUARIO';
CREATE UNIQUE INDEX digital_certificates_org_uk
  ON public.digital_certificates (organization_id) WHERE owner_type = 'ORGANIZACAO';
CREATE INDEX digital_certificates_org_idx ON public.digital_certificates (organization_id);

GRANT SELECT (
  id, organization_id, owner_type, user_id, titular_nome, titular_documento,
  emissor, serial_number, valido_de, valido_ate, fingerprint, status,
  created_by, created_at, updated_at
) ON public.digital_certificates TO authenticated;
GRANT DELETE ON public.digital_certificates TO authenticated;
GRANT ALL ON public.digital_certificates TO service_role;

ALTER TABLE public.digital_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve o proprio certificado"
ON public.digital_certificates FOR SELECT TO authenticated
USING (
  (owner_type = 'USUARIO' AND user_id = auth.uid())
  OR (owner_type = 'ORGANIZACAO' AND organization_id = public.get_user_org_id(auth.uid()))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Usuario remove o proprio certificado"
ON public.digital_certificates FOR DELETE TO authenticated
USING (
  (owner_type = 'USUARIO' AND user_id = auth.uid())
  OR (owner_type = 'ORGANIZACAO'
      AND public.has_role_in_org(auth.uid(), 'org_admin', organization_id))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER digital_certificates_updated_at
BEFORE UPDATE ON public.digital_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grava o certificado cifrado (chamada pela edge function de upload)
CREATE OR REPLACE FUNCTION public.cert_upsert(
  p_user_id uuid,
  p_owner_type text,
  p_organization_id uuid,
  p_titular_nome text,
  p_titular_documento text,
  p_emissor text,
  p_serial_number text,
  p_valido_de timestamptz,
  p_valido_ate timestamptz,
  p_fingerprint text,
  p_pfx_b64 text,
  p_senha text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF p_owner_type NOT IN ('USUARIO','ORGANIZACAO') THEN
    RAISE EXCEPTION 'owner_type invalido';
  END IF;
  IF p_owner_type = 'ORGANIZACAO'
     AND NOT (public.has_role(p_user_id,'super_admin')
              OR public.has_role_in_org(p_user_id,'org_admin', p_organization_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_status := CASE WHEN p_valido_ate < now() THEN 'vencido' ELSE 'valido' END;

  DELETE FROM public.digital_certificates
   WHERE (p_owner_type = 'USUARIO' AND owner_type = 'USUARIO' AND user_id = p_user_id)
      OR (p_owner_type = 'ORGANIZACAO' AND owner_type = 'ORGANIZACAO' AND organization_id = p_organization_id);

  INSERT INTO public.digital_certificates (
    organization_id, owner_type, user_id, titular_nome, titular_documento,
    emissor, serial_number, valido_de, valido_ate, fingerprint, status,
    pfx_enc, senha_enc, created_by
  ) VALUES (
    p_organization_id, p_owner_type,
    CASE WHEN p_owner_type = 'USUARIO' THEN p_user_id ELSE NULL END,
    p_titular_nome, p_titular_documento, p_emissor, p_serial_number,
    p_valido_de, p_valido_ate, p_fingerprint, v_status,
    extensions.pgp_sym_encrypt(p_pfx_b64, public._app_enc_key()),
    extensions.pgp_sym_encrypt(p_senha, public._app_enc_key()),
    p_user_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.cert_upsert(uuid,text,uuid,text,text,text,text,timestamptz,timestamptz,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cert_upsert(uuid,text,uuid,text,text,text,text,timestamptz,timestamptz,text,text,text) TO service_role;

-- Material decifrado: exclusivo do serviço de assinatura
CREATE OR REPLACE FUNCTION public.cert_get_material(p_id uuid)
RETURNS TABLE(pfx_b64 text, senha text, titular_nome text, titular_documento text,
              emissor text, serial_number text, valido_ate timestamptz,
              owner_type text, user_id uuid, organization_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT extensions.pgp_sym_decrypt(c.pfx_enc, public._app_enc_key()),
         extensions.pgp_sym_decrypt(c.senha_enc, public._app_enc_key()),
         c.titular_nome, c.titular_documento, c.emissor, c.serial_number,
         c.valido_ate, c.owner_type, c.user_id, c.organization_id
  FROM public.digital_certificates c
  WHERE c.id = p_id
$$;

REVOKE ALL ON FUNCTION public.cert_get_material(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cert_get_material(uuid) TO service_role;

-- Metadados dos certificados que o usuário atual pode usar
CREATE OR REPLACE FUNCTION public.cert_list_available()
RETURNS TABLE(id uuid, owner_type text, titular_nome text, titular_documento text,
              emissor text, valido_de timestamptz, valido_ate timestamptz,
              status text, organization_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.owner_type, c.titular_nome, c.titular_documento, c.emissor,
         c.valido_de, c.valido_ate,
         CASE WHEN c.valido_ate < now() THEN 'vencido' ELSE c.status END,
         c.organization_id
  FROM public.digital_certificates c
  WHERE (c.owner_type = 'USUARIO' AND c.user_id = auth.uid())
     OR (c.owner_type = 'ORGANIZACAO' AND c.organization_id = public.get_user_org_id(auth.uid()))
  ORDER BY c.owner_type
$$;

GRANT EXECUTE ON FUNCTION public.cert_list_available() TO authenticated;