
-- 1) Add evidence columns
ALTER TABLE public.epi_signed_terms
  ADD COLUMN IF NOT EXISTS signed_at_server timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at_client timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS geo_lat numeric,
  ADD COLUMN IF NOT EXISTS geo_lng numeric,
  ADD COLUMN IF NOT EXISTS geo_accuracy numeric,
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS signer_employee_name text,
  ADD COLUMN IF NOT EXISTS signer_employee_cpf text,
  ADD COLUMN IF NOT EXISTS operator_user_id uuid,
  ADD COLUMN IF NOT EXISTS operator_name text,
  ADD COLUMN IF NOT EXISTS legal_basis text DEFAULT 'MP 2.200-2/2001 - Assinatura eletronica simples';

-- 2) Immutability trigger: only super_admin can update/delete
CREATE OR REPLACE FUNCTION public.protect_signed_term_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Termo assinado é imutável: alterações e exclusões não são permitidas (apenas Super Admin).';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signed_term_update ON public.epi_signed_terms;
CREATE TRIGGER trg_protect_signed_term_update
  BEFORE UPDATE ON public.epi_signed_terms
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_term_immutability();

DROP TRIGGER IF EXISTS trg_protect_signed_term_delete ON public.epi_signed_terms;
CREATE TRIGGER trg_protect_signed_term_delete
  BEFORE DELETE ON public.epi_signed_terms
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_term_immutability();

-- 3) Remove org_admin DELETE policy (kept only super_admin via existing ALL policy)
DROP POLICY IF EXISTS "OrgAdmins podem deletar termos" ON public.epi_signed_terms;

-- 4) Make signed-terms bucket private
UPDATE storage.buckets SET public = false WHERE id = 'signed-terms';

-- 5) Storage RLS for signed-terms (org-isolated read; super_admin all)
DROP POLICY IF EXISTS "Signed terms: read own org" ON storage.objects;
CREATE POLICY "Signed terms: read own org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signed-terms'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Signed terms: insert own org" ON storage.objects;
CREATE POLICY "Signed terms: insert own org"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signed-terms'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
  )
);

DROP POLICY IF EXISTS "Signed terms: super admin manage" ON storage.objects;
CREATE POLICY "Signed terms: super admin manage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'signed-terms' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'signed-terms' AND public.has_role(auth.uid(), 'super_admin'));
